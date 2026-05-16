# SEP-2663: 任务扩展

- **状态**: Final
- **类型**: Extensions Track
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
- [SEP-2575: 使 MCP 无状态](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)

## 动机

实验性的 [tasks](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) 功能曾作为工具调用、询问与采样的一种替代执行模式，允许接收方返回一个轮询句柄，而不是阻塞直到最终结果就绪。实现经验暴露出若干挑战：

1. **握手过程脆弱。** 目前的 Tasks 既暴露方法级能力（`tasks.requests.tools.call` 声明 `tools/call` **MAY** 可被 task 增强），又有工具级的 `execution.taskSupport` 字段，用于声明某个特定工具是否接受该增强。客户端通过在请求中传递 `task` 参数来表达自己对 tasks 的支持，但如果方法/工具不支持 tasks，则 **MUST NOT** 包含该参数。因此，想要启用 tasks 的客户端必须先调用 `tools/list` 来预热状态，然后再发起任何 task 增强请求；并且不能为了让工具处理方式统一而盲目地给每个请求都附加 `task` 参数。这种方式令人困惑、隐式，而且很容易出错。

2. **`tasks/result` 是一个阻塞陷阱。** 在当前流程中，客户端一旦观察到 `input_required`，就被要求过早调用 `tasks/result`，以便服务器拥有一个 SSE 流，可在其上旁路发送询问或采样请求。随后 `tasks/result` 会一直阻塞，直到整个操作完成。这迫使客户端和服务器实现长连接持久连接，而很多实现并不想这样做；同时它也与 [SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 冲突，因为该提案完全禁止未经请求的服务器到客户端请求。在 SEP-2260 下，先前用来正当化阻塞行为的 SSE 语义不再适用。

3. **`tasks/list` 的作用域无法定义。** 为避免客户端取消或获取其无权访问的任务结果，所有任务都应绑定到某种“授权上下文”，其具体实现留给各服务器根据自身的权限模型决定。然而，在许多情况下，这种绑定无法实现，此时任务 ID 就成了防止污染的唯一防线。在这种情况下，服务器支持 `tasks/list` 是不安全的。虽然任务也可以绑定到一个会话，但 [SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567) 正在把会话从协议中移除。服务器无法单方面定义其他自然作用域——任务 ID 可以是服务器可逐个识别的不可猜测句柄，但若没有额外状态，服务器无法可靠地将两个互不相关的句柄关联到同一个调用方。

除实现挑战之外，tasks 还面临另一个结构性问题：**客户端托管的任务已不再可表达。** [SEP-1686](./1686-tasks.md) 允许客户端托管用于询问和采样的任务，部分原因是为了避免将 tasks 与工具调用耦合起来。[SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 使任何未经请求的服务器到客户端请求都无效；而客户端托管 tasks 下的每一个服务器到客户端轮询请求，从定义上说都会是未经请求的。

本提案旨在通过重设计功能的某些方面，并将 tasks 迁移为官方扩展，来解决上述问题。将 tasks 重新定义为官方扩展，可让该功能有更多时间独立于核心规范孵化和演进，从而促进采用。作为重设计的一部分，本提案将轮询生命周期整合到 `tasks/get` 和新的 `tasks/update` 中，以移除阻塞式的 `tasks/result` 方法。该重设计允许服务器在未经请求的情况下返回任务（以响应普通的、未标记 `task` 的请求），从而消除每个请求的显式启用和 `tools/list` 预热，转而依赖扩展能力作为唯一握手点。最后，本提案为符合 [SEP-2260](./2260-Require-Server-requests-to-be-associated-with-Client-requests.md) 而移除了客户端托管的询问和采样任务。

## 规范

MCP Tasks 扩展允许某些请求被 **tasks** 增强。Tasks 是持久化状态机，承载所增强请求底层执行状态的信息，旨在供客户端轮询和延迟获取结果。每个 task 都由服务器生成的 **task ID** 唯一标识。

Tasks 适用于表示昂贵计算和批处理请求，并可自然映射到外部作业 API。

### 扩展标识符

该扩展的标识符为：`io.modelcontextprotocol/tasks`。

### 能力协商

客户端和服务器分别在各自的 capabilities 对象中声明对 tasks 扩展的支持（使用 [SEP-2575: 使 MCP 无状态](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575) 中更新后的形式）：

```jsonc
// Client to server, in per-request capabilities
{
  // Other request parameters...
  "params": {
    "_meta": {
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {},
        },
      },
    },
  },
}
```

```jsonc
// Server to client, in response to server/discover
{
  "result": {
    // Other response parameters...
    "capabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {},
      },
    },
  },
}
```

目前未定义任何扩展专属设置；空对象表示支持。

已协商该扩展的服务器 **MAY** 在其自行决定且按单个请求的基础上，用 `CreateTaskResult` 替代标准结果（例如 `CallToolResult`），用于响应任何受支持的请求。是否创建任务完全由服务器决定；客户端不会在请求本身中表达对任务的偏好。客户端声明该扩展能力并不意味着它要求对该请求返回 `CreateTaskResult`。

服务器 **MUST NOT** 向未在请求中包含该扩展能力的客户端返回 `CreateTaskResult`，不论此前是否已声明。已协商该扩展的客户端 **MUST** 准备好在其发出的任何受支持请求中，接收 `CallToolResult` 或 `CreateTaskResult` 中的任一种。若客户端收到对不受支持请求类型返回的 `CreateTaskResult`，**MUST** 将其解释为该请求的无效响应。

如果服务器无法在不给客户端返回 `CreateTaskResult` 的情况下为未声明该扩展能力的客户端提供服务，则服务器 **MUST** 返回代码为 `-32003`（缺少必需的客户端能力）的错误，并在错误响应中指明所需扩展：

```jsonl
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    // MISSING_REQUIRED_CLIENT_CAPABILITY
    "code": -32003,
    // Message provided for example purposes only. The content of this example message is non-normative.
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

### 支持的方法

以下方法目前支持 task 增强执行：

- `tools/call`

本规范未来可能扩展以支持其他请求类型上的 tasks；实现 **SHOULD** 设计为能够适配本规范未来修订中增加的请求类型。

### 多态结果

符合 task 增强条件的请求可以返回两种不同的结果形状之一——该请求的标准结果，或 `CreateTaskResult`。判别字段是由 [SEP-2322](./2322-MRTR.md) 引入的结果对象上的 `resultType` 字段：

```typescript
// "task" is introduced by this extension.
type ResultType = "complete" | "input_required" | "task";
```

服务器在返回 `CreateTaskResult` 时 **MUST** 将 `resultType` 设为 `"task"`，以便客户端将其与标准结果区分开。除 `CreateTaskResult` 之外的结果类型，服务器 **MUST NOT** 将 `resultType` 设为 `"task"`。

建议客户端实现者注意：现有返回固定形状的代码（例如返回 `CallToolResult` 的 `tools/call` 方法）无需改变其公开契约——它们可以在内部透明地驱动轮询流程，并仅向外暴露最终的、已完成的结果。新的实现层面 **MAY** 直接暴露 task 生命周期，以便应用程序加以利用。

### Task

`Task` 承载关于正在进行工作的操作元数据。

```typescript
interface Task {
  /** 此 task 的稳定标识符。 */
  taskId: string;

  /** 当前 task 状态。 */
  status: "working" | "input_required" | "completed" | "cancelled" | "failed";

  /**
   * 描述当前 task 状态的可选消息。
   * 这可以为任何状态提供上下文，例如（非规范性）：
   * - "working" 的进度描述
   * - 被 "input_required" 阻塞的工作
   * - "cancelled" 状态的原因
   * - "completed" 状态的摘要
   * - "failed" 状态的附加信息（例如错误详情、出了什么问题）
   *
   * 这 MAY 向终端用户或模型显示。
   */
  statusMessage?: string;

  /** task 创建时的 ISO 8601 时间戳。 */
  createdAt: string;

  /** task 最近一次更新时的 ISO 8601 时间戳。 */
  lastUpdatedAt: string;

  /**
   * 自创建起的生存时间（TTL），以整数毫秒表示；若无限则为 null。
   * TTL 到期后服务器可以丢弃该 task。此值 MAY 在 task 生命周期内变化。
   */
  ttlMs: number | null;

  /**
   * 建议的轮询间隔，以整数毫秒表示。客户端 SHOULD 遵守该值以避免压垮服务器。
   * 此值 MAY 在 task 生命周期内变化。
   */
  pollIntervalMs?: number;
}
```

#### Task 状态

Task 可以处于以下状态之一：

- `working`: 请求当前正在处理中。
- `input_required`: 在 task 继续之前，服务器需要来自客户端的输入。`tasks/get` 响应将会在 `inputRequests` 字段中包含未完成的请求。客户端 **MUST** 检查该字段，并 **SHOULD** 在后续的 `tasks/update` 请求中通过 `inputResponses` 字段提供响应。
- `completed`: 请求已成功完成，结果可在 `result` 字段中获得。这包括返回结果且 `isError: true` 的工具调用。
- `failed`: 请求在执行过程中因 JSON-RPC 错误而失败。task 会在 `error` 字段中包含 JSON-RPC 错误详情。此状态 **MUST NOT** 用于非 JSON-RPC 错误。
- `cancelled`: 请求在完成前被取消。

`Task` 的派生形状会内联状态特定负载字段，并用于 `tasks/get` 响应和 `notifications/tasks` 通知：

```ts
/**
 * 处于正常工作状态的 task。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface WorkingTask extends Task {
  status: "working";
}

/**
 * 正在等待客户端输入的 task。
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
 * 已成功完成的 task。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface CompletedTask extends Task {
  status: "completed";
  /**
   * task 的最终结果。
   * 其结构与原始请求的结果类型一致。
   * 例如，CallToolRequest task 会返回 CallToolResult 结构。
   */
  result: JSONObject;
}

/**
 * 因 JSON-RPC 错误而失败的 task。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface FailedTask extends Task {
  status: "failed";
  /**
   * 导致 task 失败的 JSON-RPC 错误。
   */
  error: JSONObject;
}

/**
 * 已被取消的 task。
 * 用于 tasks/get 和 notifications/tasks。
 */
export interface CancelledTask extends Task {
  status: "cancelled";
}

/**
 * 表示一个包含可选内联 result/error/inputRequests 字段的 task 的联合类型。
 * 此类型用于 tasks/get 和 notifications/tasks，以提供完整的 task 状态，
 * 包括终态结果或待处理输入请求。
 */
export type DetailedTask =
  | WorkingTask
  | InputRequiredTask
  | CompletedTask
  | FailedTask
  | CancelledTask;
```

### Task 创建

服务器会以 `CreateTaskResult` 替代某个请求的标准结果形状，以表明该请求将被异步处理。

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

内嵌的 `task` 是该任务的种子状态，通常（但不一定）为 `status: "working"`。客户端在后续所有 `tasks/get`、`tasks/update` 和 `tasks/cancel` 调用中都使用 `task.taskId`。

服务器 **MUST NOT** 在任务已被持久化创建之前返回 `CreateTaskResult` —— 也就是说，直到返回的 `taskId` 对应的 `tasks/get` 可以成功解析时才可以返回。在最终一致的环境中，服务器 **MUST** 等待一致性达成后再响应。该要求消除了客户端对任务创建进行推测性轮询的需要。

将多轮往返请求与任务创建结合使用的服务器实现（例如，在创建任务前需要先通过 `InputRequiredResult` 进行询问的工具）**SHOULD** 在返回 `CreateTaskResult` 之前 _同步_ 解决所有 MRTR 往返。

### Task 轮询

客户端通过发送 `tasks/get` 请求来轮询任务完成情况。

在决定轮询频率时，客户端 **SHOULD** 遵守响应中提供的 `pollIntervalMs`。`pollIntervalMs` **MAY** 在 task 生命周期内变化。若客户端轮询频率高于记录的 `pollIntervalMs`，服务器 **MAY** 对客户端进行限流。

客户端 **SHOULD** 持续轮询，直到 task 达到终态或调用 `tasks/cancel`。客户端 **SHOULD** 将 task ID 持久化到可靠存储中，以便在崩溃或重启后能够恢复轮询。

#### 请求

```typescript
interface GetTaskRequest extends JSONRPCRequest {
  method: "tasks/get";
  params: {
    /** 要查询的 task 标识符。 */
    taskId: string;
  };
}
```

#### 响应

收到 `tasks/get` 请求后，服务器 **MUST** 检查 task 的状态并作出相应响应：

1. 如果状态是 `working`，服务器 **MUST** 返回一个状态为 `working` 的 `Task` 对象。
2. 如果状态是 `input_required`，服务器 **MUST** 返回一个状态为 `input_required` 的 `Task` 对象，并带有在 [多轮往返请求](./2322-MRTR.md) 中定义的 `inputRequests` 字段。`inputRequests` 字段 **MUST** 包含所有尚未完成、需要在 task 继续前由服务器发送给客户端并得到满足的请求。
3. 如果状态是 `completed`，服务器 **MUST** 返回一个状态为 `completed` 的 `Task` 对象，并带有包含任务最终结果的 `result` 字段。
4. 如果状态是 `cancelled`，服务器 **MUST** 返回一个状态为 `cancelled` 的 `Task` 对象。
5. 如果状态是 `failed`，服务器 **MUST** 返回一个状态为 `failed` 的 `Task` 对象，并带有执行期间发生的错误。

```typescript
type GetTaskResult = Result & DetailedTask;
```

响应会携带适用于任务当前状态的响应变体（见 [Task 状态](#task-状态)）。由于这是 `tasks/get` 请求的标准结果形状，该对象上的 `resultType` 字段 **MUST** 设为 `"complete"`。

如果 task 的 `ttlMs` 非空，客户端 **MAY** 将 TTL 视为最后保障：如果 task 的可观测状态在 `createdAt` 加上 `ttlMs` 经过后仍未反映更新，则客户端 **MAY** 认为该 task 不再可用。反过来，服务器 **MAY** 在 TTL 到期后的任意时刻将 task 标记为 `failed`，并且之后可以随时删除它。`ttlMs` 的值 **MAY** 在 task 生命周期内变化。

### Task 更新请求

当 task 需要来自客户端的输入时（由 `input_required` 状态指示），服务器会在 `tasks/get` 响应的 `inputRequests` 字段中包含未完成请求（见 [多轮往返请求](./2322-MRTR.md)）。客户端通过一个或多个后续的 `tasks/update` 请求中的 `inputResponses` 字段提供响应。

当客户端观察到 `status: "input_required"` 的 `tasks/get` 响应（或 `notifications/tasks` 通知）时，客户端 **SHOULD** 通过发送一个或多个包含相应 `inputResponses` 的 `tasks/update` 请求来完成 `inputRequests` 中未完成的请求。发送 `tasks/update` 后，客户端 **SHOULD** 继续通过轮询（`tasks/get`）或通知（`notifications/tasks`）观察 task 状态，直到其达到终态。

客户端 **MUST** 像处理对应的独立服务器到客户端请求一样处理 `inputRequests` 中的每一项——例如，通过 `inputRequests` 暴露出来的询问请求，其信任模型和面向用户的行为与直接的 `elicitation/create` 请求相同。客户端 **SHOULD** 在连续轮询之间对 `inputRequests` 的键进行去重，以避免多次向用户或模型展示同一请求。

`inputRequests` 中的每个请求键在单个 task 的生命周期内 **MUST** 唯一。服务器 **MUST NOT** 在某个键对应的响应已发送后，将该键用于后续的服务器到客户端请求，也 **MUST NOT** 在 task 生命周期中用同一个键指代两个不同请求。这保证了按同一标识符键入的 `inputResponses` 始终对应客户端预期的请求，消除了客户端跨轮询去重时的歧义，并使服务器能够忽略未知或已满足请求的 `inputResponses`。

#### 请求

```typescript
interface UpdateTaskRequest extends JSONRPCRequest {
  method: "tasks/update";
  params: {
    /** 要更新的 task 标识符。 */
    taskId: string;

    /**
     * 对先前由服务器暴露的尚未完成的 inputRequests 的响应。
     * 形状遵循 MRTR。每个键 MUST 对应当前仍未完成的 inputRequest 键。
     */
    inputResponses: InputResponses;
  };
}
```

#### 响应

```typescript
type UpdateTaskResult = Result; // empty acknowledgement
```

成功时，服务器 **MUST** 以空结果确认该请求。该确认是 _最终一致_ 的：服务器 **MAY** 接受这些响应并在任务的可观测状态（通过 `tasks/get` 或 `notifications/tasks`）反映它们之前就返回 ack。若 `taskId` 不对应已知 task，服务器 **SHOULD** 返回 JSON-RPC 错误。客户端 **SHOULD** 跟踪 `inputRequests` 的键，以避免对同一请求响应多次。

服务器 **SHOULD** 忽略任何映射到当前 task 中并非未完成状态的键的 `inputResponses` 响应——包括从未发出过的键、已经答复过的键，以及其对应请求已被取代的键。服务器 **MAY** 接受当前未完成键的部分响应集合（严格子集）；

`UpdateTaskResult` 上的 `resultType` 字段 **MUST** 设为 `"complete"`，因为这是 `tasks/update` 请求的标准结果形状。

### Task 取消

客户端发送 `tasks/cancel` 请求以表明其希望取消一个进行中的 task。`notifications/cancelled` 通知 **MUST NOT** 用于 task 取消。

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
type CancelTaskResult = Result; // empty acknowledgement
```

服务器 **MUST** 以空结果确认该请求。若 `taskId` 不对应已知 task，服务器 **SHOULD** 返回 JSON-RPC 错误。取消处理是 _最终一致_ 的——在 ack 之后，task 的可观测状态 **MAY** 仍保持 `working`（或其他非终态），并且如果工作在取消生效前就已完成，则 **MAY** 最终到达一个非 `cancelled` 的终态。

取消是 **协作式** 的：请求表达的是意图，服务器决定是否以及何时接受它。服务器没有义务真正停止工作；它只需确认该请求。最终转变为 `cancelled` 并不保证发生。

客户端在发送取消请求后 **MAY** 立即删除与该 task 相关的所有状态（例如，它不再需要保留已经回复过的 `inputRequests` 键列表）。客户端无需再次轮询 `tasks/get` 等待 task 到达 `cancelled` 状态。

`CancelTaskResult` 上的 `resultType` 字段 **MUST** 设为 `"complete"`，因为这是 `tasks/cancel` 请求的标准结果形状。

### Task 状态通知

服务器 **MAY** 除了响应客户端轮询之外，还通过 `notifications/tasks` 通知推送状态更新：

```typescript
export type TaskStatusNotificationParams = NotificationParams & Task;

export interface TaskStatusNotification extends JSONRPCNotification {
  method: "notifications/tasks";
  params: TaskStatusNotificationParams;
}
```

要开始接收 task 状态通知，客户端发送一个 `subscriptions/listen` 请求给服务器，并在其中包含客户端感兴趣的 task ID 列表（见 [SEP-2575](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)）：

```typescript
export interface SubscriptionsListenRequest extends Request {
  method: "subscriptions/listen";
  params: {
    // Other existing fields...
    notifications: {
      taskIds?: string[];
      // Other existing fields...
    };
  };
}
```

在其确认通知中，服务器会包含其同意发送 task 状态通知的 task ID 列表（如果有）：

```typescript
export interface SubscriptionsAcknowledgedNotification extends Notification {
  method: "notifications/subscriptions/acknowledged";
  params: {
    notifications: {
      /**
       * 订阅针对特定 task ID 的 notifications/tasks。
       */
      taskIds?: string[];
      // Other existing fields...
    };
  };
}
```

如果客户端请求 task 状态通知，但未声明 `io.modelcontextprotocol/tasks` 扩展能力，服务器 **MUST** 返回一个指明缺失能力的 JSON-RPC 错误：

```jsonl
{
  "jsonrpc": "2.0",
  "id": 12,
  "error": {
    // MISSING_REQUIRED_CLIENT_CAPABILITY
    "code": -32003,
    // Message provided for example purposes only. The content of this example message is non-normative.
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

每条通知都会携带当前状态的完整 `DetailedTask`，与当时 `tasks/get` 将会返回的内容完全一致。

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
          "text": "操作成功完成。"
        }
      ],
      "isError": false
    }
  }
}
```

该通知包含完整的 task 对象，使客户端无需轮询 `tasks/get` 方法即可访问完整的 task 状态和最终结果。客户端 **MAY** 在订阅 task 状态通知的同时继续轮询 `tasks/get`，但并非必须。

`notifications/progress` 和 `notifications/message` 通知 **MUST NOT** 在 task 的 `subscriptions/listen` 流上发送，并且本规范中一般也不支持将它们用于 tasks。

### 流式 HTTP：路由头

当 `tasks/get`、`tasks/update` 或 `tasks/cancel` 通过 Streamable HTTP 传输发送时，客户端 **MUST** 将 `Mcp-Name` 头（由 [SEP-2243](./2243-http-standardization.md) 定义）设置为 `params.taskId` 的值。这使得传输中介和负载均衡器能够将针对同一 task 的后续请求路由到持有其状态的服务器实例，这通常是正确运行所必需的。`Mcp-Method` 头则按 [SEP-2243](./2243-http-standardization.md) 设置为 JSON-RPC 方法名。

### 示例消息流

考虑一个简单的工具调用 `hello_world`，它需要向用户询问其姓名。该工具本身不接受任何参数。

要调用此工具，客户端按如下方式发起 `CallToolRequest`：

```jsonc
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello_world",
    "arguments": {},
    "_meta": {
      // Other metadata...
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {},
        },
      },
    },
  },
}
```

服务器（通过自定义逻辑）判定其希望创建一个 task 来表示这项工作，并立即返回一个 `CreateTaskResult`：

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

一旦客户端收到 `CreateTaskResult`，它就开始轮询 `tasks/get`：

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

当 task 处于 `"working"` 状态时，每次请求服务器都会返回一个常规 task 响应：

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

最终，服务器到达需要向用户发送询问的时刻。它将 task 状态设为 `"input_required"` 以表明这一点。在客户端下一次 `tasks/get` 请求中，服务器通过 `inputRequests` 字段发送询问负载。请注意，虽然 task 的 `inputRequests` 与 [SEP-2322](./2322-MRTR.md) 多轮往返请求在结构上相似，但它们是不同的机制：task 的 `inputRequests` 通过 `tasks/get` 暴露，并通过 `tasks/update` 完成，而不是通过重试原始方法。需要在返回 `CreateTaskResult` _之前_ 获取客户端输入的服务器（例如为了决定是否继续）应在原始请求上使用多轮往返请求流程；而在 task 执行 _期间_ 需要客户端输入的服务器，则使用此处描述的 `inputRequests`/`inputResponses` 机制。

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
          "message": "请输入你的名字。",
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

为了完整起见，假设客户端碰巧在用户尚未完成询问请求之前又轮询了一次 `tasks/get`。由于 `inputRequests` 实际上是与该 task 相关的所有未完成服务器到客户端请求的某一时刻快照，服务器会再次包含同一个请求，尽管客户端已经看过这些信息（建议客户端为 UX 目的对相同键的 `inputRequests` 做去重）：

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
          "message": "请输入你的名字。",
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

用户输入自己的名字后，客户端带着已满足的信息发起 `tasks/update` 请求：

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

随后，服务器异步处理它，并将 task 重新置回 `working` 状态：

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

最终，服务器完成该请求，因此它保存最终的 `CallToolResult` 并将 task 置为 `"completed"` 状态。在下一次 `tasks/get` 请求中，服务器会把最终工具结果内联到 task 对象中发送：

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

Tasks 使用两种错误报告机制：

1. **协议错误**：用于协议层问题的标准 JSON-RPC 错误
2. **任务执行错误**：底层请求执行中的错误，通过 task 状态报告

#### 协议错误

对于以下协议错误情况，服务器 **MUST** 返回标准 JSON-RPC 错误：

- 无效或不存在的 `taskId`：`-32602`（无效参数）
  - 服务器 **MUST** 在 `tasks/get` 中返回此错误。
  - 服务器 **SHOULD** 在 `tasks/update` 和 `tasks/cancel` 中返回此错误。
- 内部错误：`-32603`（内部错误）

服务器 **SHOULD** 提供信息充分的错误消息来描述错误原因。

**示例：找不到任务**

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

服务器不要求无限期保留任务。如果服务器在清理过期任务后返回一条说明任务无法找到的错误，这是符合规范的行为。

#### 任务执行错误

当底层请求在执行过程中遇到 JSON-RPC 协议错误时，task 会进入 `failed` 状态。`tasks/get` 响应 **SHOULD** 包含一个 `statusMessage` 字段，用于提供有关失败的诊断信息，并且 **MUST** 包含带有 JSON-RPC 错误的 `error` 字段。

`failed` 状态 **MUST NOT** 用于表示非 JSON-RPC 错误，例如工具结果以 `isError: true` 完成。协议方法结果上下文中的错误 **MUST** 使用 `completed` 状态，并在 `result` 字段中包含错误详情。这样可以保持协议层故障（使用 `failed` 状态）与其他故障之间的清晰分离。

**示例：带有 JSON-RPC 执行错误的 task**

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
    "statusMessage": "工具执行失败：API 速率限制已超出",
    "error": {
      "code": -32603,
      "message": "API rate limit exceeded"
    }
  }
}
```

**示例：工具调用已完成但带有工具错误（isError: true）**

对于在协议层面成功完成、但返回工具级错误（工具结果中以 `isError: true` 表示）的工具调用，task 会以 `completed` 状态结束，工具结果位于 `result` 字段中：

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
          "text": "请求处理失败：输入无效"
        }
      ],
      "isError": true
    }
  }
}
```

`tasks/get` 端点返回的内容与底层请求本应返回的内容完全一致：

- 如果底层请求导致了 JSON-RPC 错误，则 task 使用 `failed` 状态，且 `error` 字段 **MUST** 包含该 JSON-RPC 错误。
- 如果请求返回了结果（即使工具结果中 `isError: true`），则 task 使用 `completed` 状态，且 `result` 字段 **MUST** 包含该结果。

### 保留项

- `tasks/` 方法前缀和 `notifications/tasks/` 通知前缀保留给此扩展使用。
- `resultType` 的结果判别值 `"task"` 保留给此扩展使用。
- 标识 `io.modelcontextprotocol/tasks` 保留给此扩展使用。

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

> 服务器 **MUST NOT** 在任务持久创建完成之前返回 `CreateTaskResult`——也就是说，直到对返回的 `taskId` 发起一次 `tasks/get` 能够成功解析为止。在最终一致的环境中，服务器 **MUST** 等待一致性达成后再响应。此要求消除了客户端对任务创建进行推测性轮询的需要。

与 `tasks/update` 和 `tasks/cancel` 不同，任务创建是强一致的。必须如此，才能避免请求方对 `tasks/get` 发起推测性请求，否则它们将无法知道某个任务是被悄然丢弃了，还是只是尚未创建完成。相反，`tasks/update` 和 `tasks/cancel` 中的最终一致性是可行的，因为客户端行为并不取决于这些操作的结果（无论哪种结果，客户端都可以继续轮询）。虽然在原本并非如此工作的分布式系统中，引入一致性任务创建确实会增加延迟成本，但明确加入这一要求可以简化客户端实现，并消除一种未定义行为的来源。

这也与一般的长时间运行操作 API 相一致，后者通常要求一旦操作被确认，就必须能通过轮询端点找到它。

### 仅 Ack 的取消

在 `2025-11-25` 的任务设计中，`tasks/cancel` 会返回一个描述取消尝试之后任务状态的 task。该返回形状意味着一次同步读取——服务器必须查询任务状态才能填充它——但在许多应用中，取消本质上是异步的（由单独的 worker 决定是否以及何时接受它），因此返回的 task 对象在很多情况下只是重复下一次 `tasks/get` 会显示的内容。将 `tasks/cancel` 简化为一个 ack 更符合该操作的实际语义：该请求是一个信号，而不是一次状态查询。想要知道取消后的状态的客户端，可以通过对同一路径上的 `tasks/get` 来获取，就像它们对所有其他状态观察一样。

ack 上的最终一致性与 `tasks/update` 的情形相同：服务器可以先记录取消请求并在 worker 实际转换任务状态之前就响应，而不会让客户端把这个 ack 误解为强一致结果。

尽管出于上述原因，`tasks/update` 和 `tasks/cancel` 使用仅 ack 的响应形状，服务器 **SHOULD** 仍然对明显无效的请求返回错误——例如未知的 `taskId`。仅 ack 的设计是为了避免在成功路径中同步读取任务状态，而不是为了抑制服务器在请求时就能检测到的错误。对无效输入返回错误，可以让客户端更快地知道出了问题，而不必强行通过后续 `tasks/get` 轮询间接发现。

### 与多轮往返请求的组合

引入如下新要求：

> 与任务创建结合使用多轮往返请求的服务器实现（例如，一个工具在创建任务之前需要通过 `InputRequiredResult` 进行 elicitation）**SHOULD** 在返回 `CreateTaskResult` 之前，_同步_ 解决所有 MRTR 交互。

支持 MRTR（[SEP-2322](./2322-MRTR.md)）以及此扩展的 `tools/call` 可以按顺序使用它们：先发送一个或多个 `InputRequiredResult` 交互以同步收集输入，然后再通过 `CreateTaskResult` 交接给异步执行。这种组合是 `resultType` 判别器的直接结果——每个响应都各自有类型，客户端会根据接收到的值切换行为，_而不_ 在两种模式之间维护任何状态。禁止这种做法将需要施加一种人为限制，而协议层并没有机制去强制它，因为客户端并不知道服务器会提前创建任务。

尽管字段名相同，这两个流程仍保持各自独立的状态。MRTR 阶段在服务器返回任何非 `"input_required"` 的 `resultType` 时结束，此时它的 `inputRequests` 键被消费。任务阶段从 `CreateTaskResult` 开始，并独立维护_自己的_ `inputRequests` 键。任务 `inputRequests` 的键唯一性仅限定于任务的生命周期，不会延伸到前一个 MRTR 阶段的键。客户端无需在两个流程之间做去重。

## 向后兼容性

`2025-11-25` 版本中的实验性任务特性与此扩展 **不具备线缆兼容性**。具体而言：

- `tasks/result` 已被移除。客户端对支持该扩展的服务器调用 `tasks/result` 时，在 `2026-06-30` 规范下 **MUST** 收到 `-32601`（Method Not Found）。
- `CallToolRequest` 上的 `task` 参数已被移除。服务器在 `2026-06-30` 规范下收到带有 `task` 参数的请求时，**MUST** 忽略它（将该字段视为未知字段），而不是将其用作显式启用开关。
- `tasks.requests.*` 以及 `tasks.cancel`/`tasks.list` 能力声明不属于此扩展。此前声明这些能力的服务器 **MUST** 在 `2026-06-30` 规范下迁移为声明 `io.modelcontextprotocol/tasks`，并且在任何包含此扩展的协议版本下 **MUST NOT** 继续声明这些旧能力。

需要兼容旧客户端的实现可以在 SDK 层进行适配：服务器可以并行实现实验性接口和扩展接口，并根据客户端协商出的能力与协议版本进行分发。

返回标准 `CallToolResult` 形状——即从不选择创建任务——的服务器在此扩展下仍然完全符合规范。已协商该扩展的客户端 **MUST** 处理任何增强请求的两种结果形状。

## 安全影响

- **Task ID 不可猜测性。** 服务器 **MAY** 将 task ID 作为其存储状态的 bearer token 使用。服务器 **MUST** 生成具有足够熵的 ID，以防第三方枚举或猜测它们。
- **认证绑定。** 服务器 **MUST** 对每个与任务相关的请求执行身份验证和授权检查，以确保客户端有权限访问该任务。
- **跨调用方关联。** 由于不存在 `tasks/list`，服务器不会无意中向另一个调用方泄露某个调用方任务的存在。这比 `2025-11-25` 的任务规范有所改进，后者中范围不当的列表可能暴露无关的 task ID。
- **输入请求信任模型。** `inputRequests` 会将 elicitation 和 sampling 载荷从服务器经由客户端传递给用户或模型。宿主 **MUST** 对这些载荷应用与标准 elicitation/sampling 请求相同的信任模型。任务不是更高信任级别的通道。

## 参考实现

已在 [mcpkit](https://github.com/panyam/mcpkit/blob/02cfbe0d2cada8167b9043b9130804c8638b0aa5/core/task_v2.go) 中实现（参见[使用示例](https://github.com/panyam/mcpkit/tree/02cfbe0d2cada8167b9043b9130804c8638b0aa5/examples/tasks-v2)）。
