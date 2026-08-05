# SEP-2663: 任务扩展

- **状态**: 最终
- **类型**: 扩展轨道
- **创建时间**: 2026-04-27
- **作者**: Luca Chang (@LucaButBoring), Caitie McCaffrey (@CaitieM20); 代表 Agents Working Group
- **赞助人**: Caitie McCaffrey (@CaitieM20)
- **扩展标识符**: `io.modelcontextprotocol/tasks`
- **PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663

## 摘要

本 SEP 定义了一项扩展，允许服务器在响应 `tools/call` 请求时返回一个异步 _任务句柄_，而不是最终结果，从而使客户端能够通过轮询获取最终结果。该扩展引入了三种方法：`tasks/get`、`tasks/update` 和 `tasks/cancel`；一个多态结果判别字段（`resultType: "task"`）；以及一个 `Task` 结构，用于携带任务状态、进行中的服务器到客户端请求，以及最终结果或错误。任务的创建由服务器决定：客户端通过在每个请求的能力声明中包含该扩展来表明支持，服务器则按请求决定是否将其实例化为任务。

任务将成为 MCP 的基础构件，并预计会在未来的协议版本中得到支持。`2025-11-25` 规范中的实验性 `tasks` 功能曾作为协议扩展机制尚不可用时的过渡方案。如今 [扩展](https://modelcontextprotocol.io/extensions/overview) 已经被 [正式化](./2133-extensions.md)，将 tasks 迁移为官方扩展可以让该功能有时间在更多真实世界实现反馈的基础上孵化与演进，而不必受限于核心规范的发布节奏。一旦该扩展稳定并获得广泛采用，预期会将其提升回核心协议。

本提案将 `2025-11-25` 版本中定义的 [tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) 从核心协议中 _移除_ 并将其迁移为扩展。同时，本提案还根据自该版本以来的实现反馈，以及 `2026-06-30` 规范中包含的若干基础协议变更，对 Tasks 提出更新：

- [SEP-2260: 要求服务器请求必须关联到客户端请求](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md)
- [SEP-2322: 多轮往返请求](./2322-MRTR.md)
- [SEP-2243: 流式 HTTP 传输的 HTTP 头标准化](./2243-http-standardization.md)
- [SEP-2567: 通过显式状态句柄实现无会话 MCP](./2567-sessionless-mcp.md)
- [SEP-2575: 使 MCP 无状态](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)。

## 动机

实验性的 [tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) 功能曾作为工具调用、询问与采样的一种替代执行模式，允许接收方返回一个轮询句柄，而不是阻塞直到最终结果就绪。实现经验暴露出若干挑战：

1. **握手过程脆弱。** 目前的 Tasks 既暴露方法级能力（`tasks.requests.tools.call` 声明 `tools/call` **MAY** 可被 task 增强），又有工具级的 `execution.taskSupport` 字段，用于声明某个特定工具是否接受该增强。客户端通过在请求中传递 `task` 参数来表达自己对 tasks 的支持，但如果方法/工具不支持 tasks，则 **MUST NOT** 包含该参数。因此，想要启用 tasks 的客户端必须先调用 `tools/list` 来预热状态，然后再发起任何 task 增强请求；并且不能为了让工具处理方式统一而盲目地给每个请求都附加 `task` 参数。这种方式令人困惑、隐式，而且很容易出错。

2. **`tasks/result` 是一个阻塞陷阱。** 在当前流程中，客户端一旦观察到 `input_required`，就被要求过早调用 `tasks/result`，以便服务器拥有一个 SSE 流，可在其上旁路发送询问或采样请求。随后 `tasks/result` 会一直阻塞，直到整个操作完成。这迫使客户端和服务器实现长连接持久连接，而很多实现并不想这样做；同时它也与 [SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 冲突，因为该提案完全禁止未经请求的服务器到客户端请求。在 SEP-2260 下，先前用来正当化阻塞行为的 SSE 语义不再适用。

3. **`tasks/list` 的作用域无法定义。** 为避免客户端取消或获取其无权访问的任务结果，所有任务都应绑定到某种“授权上下文”，其具体实现留给各服务器根据自身的权限模型决定。然而，在许多情况下，这种绑定无法实现，此时任务 ID 就成了防止污染的唯一防线。在这种情况下，服务器支持 `tasks/list` 是不安全的。虽然任务也可以绑定到一个会话，但 [SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567) 正在把会话从协议中移除。服务器无法单方面定义其他自然作用域——任务 ID 可以是服务器可逐个识别的不可猜测句柄，但若没有额外状态，服务器无法可靠地将两个互不相关的句柄关联到同一个调用方。

除实现挑战之外，tasks 还面临另一个结构性问题：**客户端托管的任务已不再可表达。** [SEP-1686](./1686-tasks.md) 允许客户端托管用于询问和采样的任务，部分原因是为了避免将 tasks 与工具调用耦合起来。[SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 使任何未经请求的服务器到客户端请求都无效；而客户端托管 tasks 下的每一个服务器到客户端轮询请求，从定义上说都会是未经请求的。

本提案旨在通过重设计功能的某些方面，并将 tasks 迁移为官方扩展，来解决上述问题。将 tasks 重新定义为官方扩展，可让该功能有更多时间独立于核心规范孵化和演进，从而促进采用。作为重设计的一部分，本提案将轮询生命周期整合到 `tasks/get` 和新的 `tasks/update` 中，以移除阻塞式的 `tasks/result` 方法。该重设计允许服务器在未经请求的情况下返回任务（以响应普通的、未标记 `task` 的请求），从而消除每个请求的显式启用和 `tools/list` 预热，转而依赖扩展能力作为唯一握手点。最后，本提案为符合 [SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 而移除了客户端托管的询问和采样任务。

## 规范

MCP Tasks 扩展允许某些请求被 **任务** 增强。任务是持久化状态。

## 理由

### 非请求任务 vs. 立即结果

[另一项提案](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1905)会分别处理立即结果的情况，并采用略有不同的前置条件：_如果_ 支持任务，_并且_ 客户端支持立即任务结果，_那么_ 服务器可以针对带任务增强的请求返回常规结果。当时，这种立即结果方案看起来像是更好的选择，因为它在最初的任务规范之上似乎不会带来破坏性变更。

然而，随着我们希望[摆脱](https://blog.modelcontextprotocol.io/posts/2025-12-19-mcp-transport-future/)有状态的协议交互，并且考虑到当前任务整体仍处于实验阶段，提出一种更激进一些的变更似乎是值得的，这样可以降低整体规范的复杂性，并在当前让任务更“原生”地融入 MCP。尤其是，允许非请求任务（_除了_ 立即结果之外）意味着将任务提升为面向所有持久操作的一等概念，而不是一个平行且略带专门性质的概念。

这与提议中的 [SEP-2322](./2322-MRTR.md) 相一致，但两者彼此并不耦合。

### 拆分读取（`tasks/get`）和写入（`tasks/update`）

该重设计的早期草案曾让 `tasks/get` 携带 `inputResponses`，这样一次往返就可以既提交响应又观察最终状态。将这两者混在一起是有代价的：它会使读取路径变得非幂等（重试一次 `tasks/get` 可能会重新提交响应），它迫使读取路径共享写入的最终一致性模型，并且会使希望缓存或去重读取的中介层变得更复杂。将这些方法拆分后，`tasks/get` 保持为纯粹、幂等的读取，任何层都可以安全地缓存或重放它，而写入语义——包括其最终一致性窗口——则被限定在 `tasks/update` 中。

`tasks/update` 只返回 ack 的响应形状也源于同样的分离：服务器没有必须返回、而客户端又无法通过后续 `tasks/get` 获取不到的读取数据；如果强行在响应中嵌入一个 `Task`，就会重新引入我们试图避免的非幂等性。其代价是每轮输入需要额外一次往返——但只有在任务确实需要客户端请求时才会付出这个代价。

### 任务创建一致性

引入如下新要求：

如果服务器无法为未声明此扩展能力的客户端处理请求，且不返回 `CreateTaskResult`，则服务器 **MUST** 返回错误代码为 `-32021`（缺少所需客户端能力）的错误，并在错误响应中指出所需的扩展：

```jsonl
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    // 缺少所需客户端能力
    "code": -32021,
    // 此消息仅用于示例。示例消息的内容不具有规范性。
    "message": "Missing required client capability",
    "data": {
      "requiredCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

以下方法当前支持任务增强执行：

- `tools/call`

本规范未来可能扩展为支持其他请求类型上的任务；实现 **SHOULD** 设计为能够在本规范未来的修订版中适应额外的请求类型。

### 多态结果

符合任务增强条件的请求可能返回两种不同的结果形态之一——该请求的标准结果，或一个 `CreateTaskResult`。判别字段是结果对象上的 `resultType` 字段，该字段由 [SEP-2322](./2322-MRTR.md) 引入：

```typescript
// "task" 由此扩展引入。
type ResultType = "complete" | "input_required" | "task" | string;
```

当返回 `CreateTaskResult` 时，服务器 **MUST** 将 `resultType` 设为 `"task"`，以便客户端能够将其与标准结果区分开。对于除 `CreateTaskResult` 之外的结果类型，服务器 **MUST NOT** 将 `resultType` 设为 `"task"`。

建议客户端实现者注意：现有返回固定形态的代码（例如返回 `CallToolResult` 的 `tools/call` 方法）不必更改其公共契约——它们可以在内部透明地驱动轮询流程，并仅向外暴露最终完成的结果。新的实现接口 **MAY** 直接暴露任务生命周期，以便应用程序加以利用。

### 任务

`Task` 携带有关正在进行工作的运行元数据。

```typescript
interface Task {
  /** 此任务的稳定标识符。 */
  taskId: string;

  /** 当前任务状态。 */
  status: "working" | "input_required" | "completed" | "cancelled" | "failed";

  /**
   * 描述当前任务状态的可选消息。
   * 这可以为任何状态提供上下文，例如（非规范性）：
   * - "working" 的进度描述
   * - 被 "input_required" 阻塞的工作
   * - "cancelled" 状态的原因
   * - "completed" 状态的摘要
   * - "failed" 状态的附加信息（例如，错误详情、出错原因）
   *
   * 这 MAY 向终端用户或模型公开。
   */
  statusMessage?: string;

  /** 任务创建时的 ISO 8601 时间戳。 */
  createdAt: string;

  /** 任务最后更新时间的 ISO 8601 时间戳。 */
  lastUpdatedAt: string;

  /**
   * 从创建时起的生存时间，单位为整数毫秒；若为无限则为 null。
   * 服务器可能在 TTL 到期后丢弃该任务。该值 MAY 在任务生命周期内变更。
   */
  ttlMs: number | null;

  /**
   * 建议的轮询间隔，单位为整数毫秒。客户端 SHOULD 遵守
   * 该值以避免压垮服务器。该值 MAY 在任务生命周期内变更。
   */
  pollIntervalMs?: number;
}
```

#### 任务状态

任务可以处于以下状态之一：

- `working`：请求当前正在处理中。
- `input_required`：服务器在任务继续之前需要来自客户端的输入。`tasks/get` 响应将在 `inputRequests` 字段中包含未完成的请求。客户端 **MUST** 检查此字段，并且 **SHOULD** 在后续 `tasks/update` 请求中通过 `inputResponses` 字段提供响应。
- `completed`：请求已成功完成，结果可在 `result` 字段中获取。这包括返回 `isError: true` 的工具调用。
- `failed`：请求在执行过程中因 JSON-RPC 错误而失败。任务将包含带有 JSON-RPC 错误详情的 `error` 字段。此状态 **MUST NOT** 用于非 JSON-RPC 错误。
- `cancelled`：请求在完成前被取消。

`Task` 的派生结构体将状态特定的有效负载字段内联，并用于 `tasks/get` 响应和 `notifications/tasks` 通知：

```ts
/**
 * 处于正常工作状态的任务。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface WorkingTask extends Task {
  status: "working";
}

/**
 * 正在等待客户端输入的任务。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface InputRequiredTask extends Task {
  status: "input_required";
  /**
   * 任务执行期间需要完成的服务器到客户端请求。
   * 键是用于将请求与响应匹配的任意标识符。
   */
  inputRequests: InputRequests;
}

/**
 * 已成功完成的任务。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface CompletedTask extends Task {
  status: "completed";
  /**
   * 任务的最终结果。
   * 其结构与原始请求的结果类型相匹配。
   * 例如，CallToolRequest 任务将返回 CallToolResult 结构。
   */
  result: JSONObject;
}

/**
 * 因 JSON-RPC 错误而失败的任务。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface FailedTask extends Task {
  status: "failed";
  /**
   * 导致任务失败的 JSON-RPC 错误。
   */
  error: JSONObject;
}

/**
 * 已被取消的任务。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface CancelledTask extends Task {
  status: "cancelled";
}

/**
 * 表示一个带有可选内联 result/error/inputRequests 字段的任务的联合类型。
 * 此类型用于 tasks/get 和 notifications/tasks，以提供完整的任务状态，
 * 包括终止结果或待处理的输入请求。
 */
export type DetailedTask =
  WorkingTask | InputRequiredTask | CompletedTask | FailedTask | CancelledTask;
```

### 任务创建

当服务器针对某个请求返回 `CreateTaskResult` 时，表示该请求将以异步方式处理，而不是使用标准结果结构。

```typescript
// resultType: "task"
type CreateTaskResult = Result & Task;
```

**示例请求（CallToolRequest）：**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "city": "New York"
    }
  }
}
```

**示例响应（CreateTaskResult）：**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "working",
    "statusMessage": "操作现已开始进行。",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:40:00Z",
    "ttlMs": 60000,
    "pollIntervalMs": 5000
  }
}
```

嵌入的 `task` 是该任务的初始状态，通常（但不一定）其 `status` 为 `"working"`。客户端会使用 `task.taskId` 来进行后续所有 `tasks/get`、`tasks/update` 和 `tasks/cancel` 调用。

服务器 **不得** 在任务已被持久化创建之前返回 `CreateTaskResult`——也就是说，直到针对返回的 `taskId` 执行 `tasks/get` 能够成功解析时，才可以返回。对于最终一致性环境，服务器 **必须** 在响应之前等待一致性达成。此要求消除了客户端推测性轮询任务创建的需要。

在与任务创建结合使用多轮往返请求（multi round-trip requests，MRTR）的服务器实现中（例如，一个工具在创建任务之前需要通过 `InputRequiredResult` 进行交互确认），**应当** 在返回 `CreateTaskResult` 之前，**同步**完成所有 MRTR 交换。

### 任务轮询

客户端通过发送 `tasks/get` 请求来轮询任务完成情况。

在确定轮询频率时，客户端**应当**遵守响应中提供的 `pollIntervalMs`。`pollIntervalMs` **可能**会在任务生命周期内发生变化。对于轮询频率高于记录的 `pollIntervalMs` 的客户端，服务器**可以**进行限流。

客户端**应当**持续轮询，直到任务达到终止状态，或直到调用 `tasks/cancel`。客户端**应当**将任务 ID 持久化到可靠存储，以便在崩溃或重启后可以恢复轮询。

#### 请求

### 仅 Ack 的取消

在 `2025-11-25` 的任务设计中，`tasks/cancel` 会返回一个描述取消尝试之后任务状态的 task。该返回形状意味着一次同步读取——服务器必须查询任务状态才能填充它——但在许多应用中，取消本质上是异步的（由单独的 worker 决定是否以及何时接受它），因此返回的 task 对象在很多情况下只是重复下一次 `tasks/get` 会显示的内容。将 `tasks/cancel` 简化为一个 ack 更符合该操作的实际语义：该请求是一个信号，而不是一次状态查询。想要知道取消后的状态的客户端，可以通过对同一路径上的 `tasks/get` 来获取，就像它们对所有其他状态观察一样。

ack 上的最终一致性与 `tasks/update` 的情形相同：服务器可以先记录取消请求并在 worker 实际转换任务状态之前就响应，而不会让客户端把这个 ack 误解为强一致结果。

尽管出于上述原因，`tasks/update` 和 `tasks/cancel` 使用仅 ack 的响应形状，服务器 **SHOULD** 仍然对明显无效的请求返回错误——例如未知的 `taskId`。仅 ack 的设计是为了避免在成功路径中同步读取任务状态，而不是为了抑制服务器在请求时就能检测到的错误。对无效输入返回错误，可以让客户端更快地知道出了问题，而不必强行通过后续 `tasks/get` 轮询间接发现。

### 与多轮往返请求的组合

引入如下新要求：

> 与任务创建结合使用多轮往返请求的服务器实现（例如，一个工具在创建任务之前需要通过 `InputRequiredResult` 进行询问）**SHOULD** 在返回 `CreateTaskResult` 之前，_同步_ 解决所有 MRTR 交互。

支持 MRTR（[SEP-2322](./2322-MRTR.md)）以及此扩展的 `tools/call` 可以按顺序使用它们：先发送一个或多个 `InputRequiredResult` 交互以同步收集输入，然后再通过 `CreateTaskResult` 交接给异步执行。这种组合是 `resultType` 判别器的直接结果——每个响应都各自有类型，客户端会根据接收到的值切换行为，_而不_ 在两种模式之间维护任何状态。禁止这种做法将需要施加一种人为限制，而协议层并没有机制去强制它，因为客户端并不知道服务器会提前创建任务。

尽管字段名相同，这两个流程仍保持各自独立的状态。MRTR 阶段在服务器返回任何非 `"input_required"` 的 `resultType` 时结束，此时其 `inputRequests` 键被消费。任务阶段从 `CreateTaskResult` 开始，并独立维护_自己的_ `inputRequests` 键。任务 `inputRequests` 的键唯一性仅限定于任务的生命周期，不会延伸到前一个 MRTR 阶段的键。客户端无需在两个流程之间做去重。

## 向后兼容性

`2025-11-25` 版本中的实验性任务功能与此扩展 **不** 具备线缆兼容性。需要同时与两种表面交互的实现，可以在 SDK 层通过并行实现实验性流程和扩展流程，并根据协商出的协议版本以及对端声明的客户端能力进行分发来进行适配。下表总结了每种组合下的预期行为：

| 协议版本 | `tasks.*`（旧版）                                                                                                                                                                                                                                                                                                                                                                                                   | `io.modelcontextprotocol/tasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2025-11-25`     | 按 `2025-11-25` 规范提供的旧版实验性任务。客户端通过 `CallToolRequest` 上的 `task` 参数按请求选择启用任务增强；服务器按照该规范使用 `tasks/result`、`tasks/get`、`tasks/cancel`，以及（在支持的情况下）`tasks/list`。此扩展不适用。                                                                                                                 | 此扩展在 `2025-11-25` 协议版本下未定义。服务器 **MUST NOT** 将此能力视为在该协议版本下启用任务；请求应当继续执行，仿佛客户端根本没有声明任何任务能力。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `2026-06-30`     | 旧版能力不是此扩展的一部分。服务器 **MUST** 将仅声明旧版能力的客户端视为未就此扩展声明能力。若服务器同时支持 `2025-11-25` Tasks 规范和此扩展，**SHOULD** 继续允许此类客户端通过 `tasks/get` 和 `tasks/cancel` 请求操作在该流程下创建的任务。 | 规范中的标准情形。完整的任务生命周期如本文所定义，但与 `2025-11-25` 实验性功能在线缆层存在以下差异：<ul><li>`tasks/result` 被移除；调用它的客户端 **MUST** 收到 `-32601`（Method Not Found）。</li><li>`CallToolRequest` 上的 `task` 参数被移除；服务器 **MUST** 忽略它（将该字段视为未知字段），而不是把它当作显式启用选项。</li><li>`tasks.requests.*`、`tasks.cancel` 和 `tasks.list` 这些能力声明不属于此扩展。此前声明这些能力的服务器 **MUST** 迁移为声明 `io.modelcontextprotocol/tasks`，并且 **MUST NOT** 在任何包含此扩展的协议版本下继续声明旧版能力。</li></ul> |

返回标准 `CallToolResult` 形状——即从不选择创建任务——的服务器在此扩展下仍然完全符合规范。已协商该扩展的客户端 **MUST** 处理任何增强请求的两种结果形状。

## 安全影响

- **Task ID 不可猜测性。** 服务器 **MAY** 将 task ID 作为其存储状态的 bearer token 使用。服务器 **MUST** 生成具有足够熵的 ID，以防第三方枚举或猜测它们。
- **认证绑定。** 服务器 **MUST** 对每个与任务相关的请求执行身份验证和授权检查，以确保客户端有权限访问该任务。
- **跨调用方关联。** 由于不存在 `tasks/list`，服务器不会无意中向另一个调用方泄露某个调用方任务的存在。这比 `2025-11-25` 的任务规范有所改进，后者中范围不当的列表可能暴露无关的 task ID。
- **输入请求信任模型。** `inputRequests` 会将 elicitation 和 sampling 载荷从服务器经由客户端传递给用户或模型。宿主 **MUST** 对这些载荷应用与标准 elicitation/sampling 请求相同的信任模型。任务不是更高信任级别的通道。

## 参考实现

```typescript
type UpdateTaskResult = Result; // 空确认
```

成功时，服务器**必须**使用空结果确认该请求。该确认是_最终一致的_：服务器**可以**接受这些响应，并在任务的可观察状态（通过 `tasks/get` 或 `notifications/tasks`）反映这些响应之前返回确认。若 `taskId` 不对应已知任务，服务器**应**返回 JSON-RPC 错误。客户端**应**跟踪 `inputRequests` 的键，以避免对请求进行多次响应。

服务器**应**忽略映射到当前任务中不存在的待处理键的任何 `inputResponses` 响应——包括从未发出过的键、已经得到回答的键，以及其对应请求已被取代的键。服务器**可以**接受部分响应集合（当前待处理键的严格子集）；

`resultType` 字段在 `UpdateTaskResult` 上**必须**设置为 `"complete"`，因为这是 `tasks/update` 请求的标准结果结构。

### 任务取消

客户端发送 `tasks/cancel` 请求，以表示其取消正在进行的任务的意图。**不得**使用 `notifications/cancelled` 通知来取消任务。

#### 请求

```typescript
interface CancelTaskRequest extends JSONRPCRequest {
  method: "tasks/cancel";
  params: {
    taskId: string;
  };
}
```

#### 响应

```typescript
type CancelTaskResult = Result; // 空确认
```

服务器**必须**使用空结果确认该请求。如果 `taskId` 不对应已知任务，服务器**应该**返回 JSON-RPC 错误。取消处理是_最终一致的_——确认后，任务的可观察状态**可能**仍为 `working`（或其他非终止状态）；如果任务在取消生效前已经完成，其最终状态**可能**是除 `cancelled` 之外的其他终止状态。

取消是**协作式的**：该请求表示取消意图，服务器决定是否以及何时执行取消。服务器没有义务实际停止工作；它只需确认该请求即可。最终转变为 `cancelled` 状态并无保证。

客户端**可以**在发送取消请求后立即删除与任务关联的所有状态（例如，不再需要保留其已经响应过的 `inputRequests` 键列表）。客户端无需再次轮询 `tasks/get` 来等待任务进入 `cancelled` 状态。

`CancelTaskResult` 上的 `resultType` 字段**必须**设置为 `"complete"`，因为这是 `tasks/cancel` 请求的标准结果形状。

### 任务状态通知

服务器除了响应客户端轮询之外，**可以**通过 `notifications/tasks` 通知推送状态更新：

```typescript
export type TaskStatusNotificationParams = NotificationParams & Task;

export interface TaskStatusNotification extends JSONRPCNotification {
  method: "notifications/tasks";
  params: TaskStatusNotificationParams;
}
```

要开始监听任务状态通知，客户端向服务器发送 `subscriptions/listen` 请求，其中包含客户端感兴趣的任务 ID 列表（参见 [SEP-2575](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)）：

```typescript
export interface SubscriptionsListenRequest extends Request {
  method: "subscriptions/listen";
  params: {
    // 其他现有字段...
    notifications: {
      taskIds?: string[];
      // 其他现有字段...
    };
  };
}
```

在其确认通知中，服务器会包含其同意发送任务状态通知的任务 ID 列表（如果有）：

```typescript
export interface SubscriptionsAcknowledgedNotification extends Notification {
  method: "notifications/subscriptions/acknowledged";
  params: {
    notifications: {
      /**
       * 订阅特定任务 ID 的 notifications/tasks 通知。
       */
      taskIds?: string[];
      // 其他现有字段...
    };
  };
}
```

如果客户端请求任务状态通知，但未声明 `io.modelcontextprotocol/tasks` 扩展能力，服务器**必须**返回一个 JSON-RPC 错误，指出缺失的能力：

```jsonl
{
  "jsonrpc": "2.0",
  "id": 12,
  "error": {
    // 缺少必需的客户端能力
    "code": -32021,
    // 此消息仅用于示例。示例消息的内容不具有规范性。
    "message": "Missing required client capability",
    "data": {
      "requiredCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

每个通知都携带当前状态的完整 `DetailedTask`，与此时调用 `tasks/get` 所返回的内容相同。

**通知：**

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tasks",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "completed",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 60000,
    "pollIntervalMs": 5000,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "Operation completed successfully."
        }
      ],
      "isError": false
    }
  }
}
```

该通知包含完整的任务对象，使客户端无需轮询 `tasks/get` 方法即可访问完整的任务状态和最终结果。客户端**可以**在订阅任务状态通知的同时继续轮询 `tasks/get`，但不必这样做。

`notifications/progress` 和 `notifications/message` 通知**不得**在任务的 `subscriptions/listen` 流上发送，并且根据本规范，任务通常也不支持这些通知。

### Streamable HTTP：路由标头

当通过 Streamable HTTP 传输发送 `tasks/get`、`tasks/update` 或 `tasks/cancel` 时，客户端**必须**将 `Mcp-Name` 标头（由 [SEP-2243](./2243-http-standardization.md) 定义）设置为 `params.taskId` 的值。这样，传输中间件和负载均衡器便可将同一任务的后续请求路由到保存其状态的服务器实例，这通常是确保正确性所必需的。根据 [SEP-2243](./2243-http-standardization.md)，`Mcp-Method` 标头设置为 JSON-RPC 方法名称。

### 示例消息流程

考虑一个简单的工具调用 `hello_world`，该调用需要通过 elicitation 请求用户提供姓名。工具本身不接受任何参数。

要调用此工具，客户端按如下方式发送 `CallToolRequest`：

```jsonc
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello_world",
    "arguments": {},
    "_meta": {
      // 其他元数据...
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {},
        },
      },
    },
  },
}
```

服务器通过定制逻辑判断需要创建一个任务来表示此工作，并立即返回 `CreateTaskResult`：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resultType": "task",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "working",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000
  }
}
```

客户端收到 `CreateTaskResult` 后，开始轮询 `tasks/get`：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tasks/get",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840"
  }
}
```

当任务处于 `"working"` 状态时，服务器会针对每次请求返回常规任务响应：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "resultType": "complete",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "working",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000
  }
}
```

最终，服务器执行到需要向用户发送 elicitation 的阶段。它将任务状态设置为 `"input_required"`，以发出此信号。在客户端下一次发送 `tasks/get` 请求时，服务器通过 `inputRequests` 字段发送 elicitation 负载。请注意，虽然任务的 `inputRequests` 在结构上与 [SEP-2322](./2322-MRTR.md) 多轮往返请求相似，但它们是不同的机制：任务的 `inputRequests` 通过 `tasks/get` 展示，并通过 `tasks/update` 完成，而不是通过重试原始方法完成。服务器如果需要在返回 `CreateTaskResult` **之前**获取客户端输入（例如决定是否继续），应在原始请求上使用多轮往返请求流程；服务器如果需要在任务执行**期间**获取客户端输入，则应使用此处描述的 `inputRequests`/`inputResponses` 机制。

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/get",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840"
  }
}
```

```json
{
  "id": 4,
  "jsonrpc": "2.0",
  "result": {
    "resultType": "complete",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "input_required",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000,
    "inputRequests": {
      "name": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "请输入您的姓名。",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "name": { "type": "string" }
            },
            "required": ["name"]
          }
        }
      }
    }
  }
}
```

为完整起见，我们来考虑这样一种情况：客户端恰好在用户完成 elicitation 请求**之前**再次轮询 `tasks/get`。由于 `inputRequests` 实际上是与该任务关联的所有待处理服务器到客户端请求在某个时间点的快照，因此即使客户端已经看过这些信息，服务器仍会再次包含相同的请求（建议客户端为改善用户体验，对具有相同键的 `inputRequests` 进行去重）：

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/get",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840"
  }
}
```

```json
{
  "id": 5,
  "jsonrpc": "2.0",
  "result": {
    "resultType": "complete",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "input_required",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000,
    "inputRequests": {
      "name": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "请输入您的姓名。",
          "requestedSchema": {
            "type": "object",
            "properties": {
              "name": { "type": "string" }
            },
            "required": ["name"]
          }
        }
      }
    }
  }
}
```

用户输入姓名后，客户端发送包含已满足信息的 `tasks/update` 请求：

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tasks/update",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "inputResponses": {
      "name": {
        "action": "accept",
        "content": {
          "input": "Luca"
        }
      }
    }
  }
}
```

服务器确认该请求：

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "resultType": "complete"
  }
}
```

服务器异步处理该请求，并将任务重新置于 `working` 状态：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tasks/get",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840"
  }
}
```

```json
{
  "id": 7,
  "jsonrpc": "2.0",
  "result": {
    "resultType": "complete",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "working",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000
  }
}
```

最终，服务器完成该请求，因此它存储最终的 `CallToolResult`，并将任务置于 `"completed"` 状态。在下一次 `tasks/get` 请求中，服务器将最终工具结果内联到任务对象中：

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tasks/get",
  "params": {
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840"
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {
    "resultType": "complete",
    "taskId": "786512e2-9e0d-44bd-8f29-789f320fe840",
    "status": "completed",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:50:00Z",
    "ttlMs": 3600000,
    "pollIntervalMs": 5000,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "你好，Luca！"
        }
      ],
      "isError": false
    }
  }
}
```

### 错误处理

任务使用两种错误报告机制：

1. **协议错误**：针对协议级问题的标准 JSON-RPC 错误
2. **任务执行错误**：底层请求执行中的错误，通过任务状态报告

#### 协议错误

对于以下协议错误情况，服务器 **必须** 返回标准 JSON-RPC 错误：

- 无效或不存在的 `taskId`：`-32602`（无效参数）
  - 对于 `tasks/get`，服务器 **必须** 返回此错误。
  - 对于 `tasks/update` 和 `tasks/cancel`，服务器 **应该** 返回此错误。
- 内部错误：`-32603`（内部错误）
- 缺少必需的客户端能力：`-32021`（缺少必需的客户端能力）
  - 对于未声明能力的客户端在 `subscriptions/listen` 上请求任务通知，服务器 **必须** 返回此错误。
  - 对于未声明能力的客户端发出 `tasks/get`、`tasks/update` 和 `tasks/cancel` 请求，服务器 **必须** 返回此错误。

服务器 **应该** 提供信息丰富的错误消息来描述错误原因。

**示例：未找到任务**

```json
{
  "jsonrpc": "2.0",
  "id": 70,
  "error": {
    "code": -32602,
    "message": "Failed to retrieve task: Task not found"
  }
}
```

**示例：任务已过期**

```json
{
  "jsonrpc": "2.0",
  "id": 71,
  "error": {
    "code": -32602,
    "message": "Failed to retrieve task: Task has expired"
  }
}
```

服务器不要求永久保留任务。如果服务器已清除过期任务，则返回说明找不到该任务的错误属于符合规范的行为。

#### 任务执行错误

当底层请求在执行期间遇到 JSON-RPC 协议错误时，任务将转为 `failed` 状态。`tasks/get` 响应 **应该** 包含带有故障诊断信息的 `statusMessage` 字段，并且 **必须** 包含带有 JSON-RPC 错误的 `error` 字段。

`failed` 状态 **不得** 用于表示非 JSON-RPC 错误，例如结果以 `isError: true` 完成的工具调用。协议方法结果上下文中的错误 **必须** 使用 `completed` 状态，并将错误详情放在 `result` 字段中。这样可以明确区分协议级故障（使用 `failed` 状态）和其他故障。

**示例：带有 JSON-RPC 执行错误的任务**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "task",
    "taskId": "786512e2-9e0d-44bd-8f29-789f820fe840",
    "status": "failed",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:40:00Z",
    "ttlMs": 3600000,
    "statusMessage": "Tool execution failed: API rate limit exceeded",
    "error": {
      "code": -32603,
      "message": "API rate limit exceeded"
    }
  }
}
```

**示例：工具调用完成但出现工具错误（isError: true）**

对于在协议层面成功完成但返回工具级错误的工具调用（由工具结果中的 `isError: true` 指示），任务将达到 `completed` 状态，并在 `result` 字段中包含工具结果：

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "resultType": "task",
    "taskId": "786512e2-9e0d-44bd-8f29-789f820fe840",
    "status": "completed",
    "createdAt": "2025-11-25T10:30:00Z",
    "lastUpdatedAt": "2025-11-25T10:40:00Z",
    "ttlMs": 3600000,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "Failed to process request: invalid input"
        }
      ],
      "isError": true
    }
  }
}
```

`tasks/get` 端点返回的内容与底层请求本应返回的内容完全一致：

- 如果底层请求产生了 JSON-RPC 错误，任务将使用 `failed` 状态，并且 `error` 字段 **必须** 包含该 JSON-RPC 错误。
- 如果请求返回了结果（即使工具结果中的 `isError: true`），任务将使用 `completed` 状态，并且 `result` 字段 **必须** 包含该结果。

### 保留项

- `tasks/` 方法前缀和 `notifications/tasks/` 通知前缀为此扩展保留。
- `resultType` 的结果判别值 `"task"` 为此扩展保留。
- 标签 `io.modelcontextprotocol/tasks` 为此扩展保留。

## 设计 rationale

### 非请求任务与即时结果

一个[替代提案](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1905)会单独处理即时结果的情况，并采用略有不同的前提条件：_如果_支持任务，_并且_客户端支持即时任务结果，_那么_服务器可以针对附加了任务的请求返回常规结果。这个版本的即时结果在当时看起来是更好的选择，因为它意味着无需在初始任务规范之上引入破坏性变更。

然而，随着我们寻求[逐步摆脱](https://blog.modelcontextprotocol.io/posts/2025-12-19-mcp-transport-future/)有状态的协议交互，并鉴于任务整体上仍处于当前的实验性阶段，现在似乎值得提出一项更为激进的变更，以降低整体规范的复杂性，并使任务在此时更加“原生”地融入 MCP。具体而言，允许非请求任务（_以及_即时结果）意味着将任务提升为一等概念，使其面向所有持久化操作，而不是作为一种并行且有些专门化的概念存在。

这恰好与提议中的 [SEP-2322](./2322-MRTR.md) 保持一致，但两者并不相互耦合。

### 分离读取（`tasks/get`）与写入（`tasks/update`）

这一重设计的早期草案允许 `tasks/get` 携带 `inputResponses`，从而通过一次往返同时提交响应并观察由此产生的状态。这种混合会带来一些代价：它使读取路径变得非幂等（重试 `tasks/get` 可能会重新提交响应），迫使读取路径采用与写入相同的最终一致性模型，并使希望缓存或去重读取操作的中间层变得更加复杂。分离这些方法后，`tasks/get` 成为纯粹的幂等读取，任何层都可以安全地缓存或重放；而包括最终一致性窗口在内的写入语义则被限制在 `tasks/update` 中。

`tasks/update` 仅返回确认的响应形式同样源于这种分离：服务器无需返回任何客户端无法通过后续 `tasks/get` 获取的读取数据，而强行在响应中嵌入 `Task` 会重新引入我们试图避免的非幂等性。代价是每轮输入增加一次往返——且仅当任务确实需要客户端请求时才会产生这一开销。

### 任务创建的一致性

引入了以下新要求：

> 服务器**不得**在任务持久创建之前返回 `CreateTaskResult`——也就是说，在返回的 `taskId` 对应的 `tasks/get` 能够成功解析之前不得返回。在最终一致性的环境中，服务器**必须**在响应前等待一致性达成。此要求消除了客户端为任务创建而进行推测性轮询的必要。

与 `tasks/update` 和 `tasks/cancel` 不同，任务创建具有强一致性。必须如此，才能避免请求方发出推测性的 `tasks/get` 请求，因为请求方无法判断任务是被静默丢弃了，还是仅仅尚未创建。相反，`tasks/update` 和 `tasks/cancel` 中的最终一致性之所以可行，是因为客户端行为并不取决于这些操作的结果（无论哪种情况，客户端都可以继续轮询）。虽然在原本并不具备这种行为的分布式系统中，一致的任务创建确实会增加延迟成本，但明确引入这一要求可以简化客户端实现，并消除一个未定义行为来源。

这也与一般的长时间运行操作 API 保持一致：这类 API 通常要求，一旦某个操作得到确认，就必须能够通过轮询端点找到它。

### 仅确认式取消

在 `2025-11-25` 的任务设计中，`tasks/cancel` 会返回一个描述取消尝试后任务状态的任务对象。这种返回形式意味着同步读取——服务器必须查询任务状态以填充该对象——但在许多应用中，取消本质上是异步的（由独立的工作线程决定是否以及何时执行取消），因此返回的任务对象在许多情况下只会简单重复下一次 `tasks/get` 所显示的内容。将 `tasks/cancel` 简化为确认响应，更符合该操作的实际语义：请求是一种信号，而不是状态查询。希望了解取消后状态的客户端，可以通过 `tasks/get` 获取，使用的代码路径与其他所有状态观察操作相同。

确认响应所具有的最终一致性，与 `tasks/update` 中的分离原则相同：服务器可以记录取消请求并在工作线程实际转换任务状态之前作出响应，但不允许客户端将该确认解读为强一致性的结果。

虽然 `tasks/update` 和 `tasks/cancel` 基于上述原因采用仅确认式响应形式，但服务器**仍应**针对明显无效的请求返回错误——例如未知的 `taskId`。仅确认式设计旨在避免在成功路径中同步读取任务状态，而不是抑制服务器能够在请求时检测到的错误。针对无效输入返回错误，可以更快地向客户端发出问题信号，而不必迫使客户端通过后续的 `tasks/get` 轮询间接发现问题。

### 与多次往返请求的组合

引入了以下新要求：

> 将多次往返请求与任务创建结合使用的服务器实现（例如，在创建任务之前需要通过 `InputRequiredResult` 进行询问的工具）**应该**在返回 `CreateTaskResult` 之前，同步完成所有 MRTR 交互。

同时支持 MRTR（[SEP-2322](./2322-MRTR.md)）和此扩展的 `tools/call` 可以按顺序使用它们：先发送一个或多个 `InputRequiredResult` 交互以同步收集输入，然后通过 `CreateTaskResult` 将执行交接给异步流程。这种组合是 `resultType` 判别字段的结果——每个响应都具有独立的类型，客户端根据接收到的值切换行为，_而不会_在两种模式之间维护任何状态。禁止这种组合将需要施加一项人为约束，但协议层面没有机制可以强制执行该约束，因为客户端并不知道服务器会预先创建任务。

尽管共享字段名，这两个流程仍维护着彼此独立的状态。当服务器返回任何非 `"input_required"` 的 `resultType` 时，MRTR 阶段结束，此时其 `inputRequests` 的键即被消耗。任务阶段从 `CreateTaskResult` 开始，并独立维护_自身的_ `inputRequests` 键。任务 `inputRequests` 的键唯一性仅限于任务的生命周期，不延伸至前一个 MRTR 阶段中的键。客户端无需在两个流程之间进行去重。

## 向后兼容性

`2025-11-25` 版本中的实验性任务功能与本扩展**不具备线路兼容性**。需要同时与这两种接口互操作的实现，可以在 SDK 层进行适配：并行实现实验性流程和扩展流程，并根据协商的协议版本以及对端声明的客户端能力进行分派。下表总结了每种组合下的预期行为：

| 协议版本 | `tasks.*`（旧版）                                                                                                                                                                                                                                                                                                                                                                                               | `io.modelcontextprotocol/tasks`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2025-11-25`     | 遵循 `2025-11-25` 规范的旧版实验性任务。客户端通过 `CallToolRequest` 上的 `task` 参数，按请求选择启用任务增强；服务器根据该规范使用 `tasks/result`、`tasks/get`、`tasks/cancel`，以及（在支持的情况下）`tasks/list`。本扩展不适用。                                                                                           | 此扩展未定义于 `2025-11-25` 协议版本下。服务器**不得**将此能力视为在该协议版本下启用任务；请求应按照客户端未声明任何任务能力的情况进行处理。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `2026-06-30`     | 旧版能力不属于本扩展。对于仅声明旧版能力的客户端，服务器**必须**将其视为未就本扩展声明能力。若服务器在支持本扩展的同时还支持 `2025-11-25` Tasks 规范，**应**继续允许此类客户端发送 `tasks/get` 和 `tasks/cancel` 请求，以操作通过该流程创建的任务。 | 规范中的标准情况。完整的任务生命周期如本文档所述，但与 `2025-11-25` 实验性功能存在以下线路层面的差异：<ul><li>`tasks/result` 已移除；客户端调用该方法时**必须**收到 `-32601`（方法未找到）。</li><li>`CallToolRequest` 上的 `task` 参数已移除；服务器**必须**忽略该参数（将其视为未知字段），而不能将其用作选择启用的依据。</li><li>`tasks.requests.*`、`tasks.cancel` 和 `tasks.list` 能力声明不属于本扩展。此前曾声明这些能力的服务器**必须**改为声明 `io.modelcontextprotocol/tasks`，并且在包含本扩展的任何协议版本下**不得**继续声明旧版能力。</li></ul> |

返回标准 `CallToolResult` 形状的服务器——即从不选择创建任务——在本扩展下仍完全符合规范。已协商使用本扩展的客户端，对于任何增强请求，**必须**同时处理这两种结果形状。

## 安全影响

- **任务 ID 的不可猜测性。** 服务器**可以**使用任务 ID 作为服务器存储状态的持有者令牌。服务器**必须**以足够的熵生成任务 ID，使第三方无法枚举或猜测这些 ID。
- **身份验证绑定。** 服务器**必须**对每个与任务相关的请求执行身份验证和授权检查，以确保客户端有权访问某个任务。
- **跨调用方关联。** 由于不存在 `tasks/list`，服务器不会意外地将一个调用方的任务存在性泄露给另一个调用方。与 `2025-11-25` 任务规范相比，这是一个改进；在后者中，范围定义不当的列表可能会暴露无关的任务 ID。
- **输入请求信任模型。** `inputRequests` 携带从服务器经由客户端传递给用户或模型的引导和采样负载。主机**必须**对这些负载应用与标准引导/采样请求相同的信任模型。任务并不是更高信任级别的通道。

## 参考实现

已在 [mcpkit](https://github.com/panyam/mcpkit/blob/02cfbe0d2cada8167b9043b9130804c8638b0aa5/core/task_v2.go) 中实现（参见[用法示例](https://github.com/panyam/mcpkit/tree/02cfbe0d2cada8167b9043b9130804c8638b0aa5/examples/tasks-v2)）。
