# SEP-2575: 使 MCP 无状态化

- **状态**: Final
- **类型**: Standards Track
- **创建时间**: 2025-06-18
- **作者**: Jonathan Hefner (@jonathanhefner), Mark Roth (@markdroth),
  Shaun Smith (@evalstate), Harvey Tuch (@htuch), Kurtis Van Gent (@kurtisvg)
- **赞助人**: Kurtis Van Gent (@kurtisvg)
- **PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575

## 摘要

一个真正无状态的协议，其中每个请求都是自包含的，并且可以独立理解，因其内在的简洁性、可扩展性和可靠性而极具吸引力。当前的 Model Context Protocol（MCP）默认并非无状态。该规范要求进行一次初始化握手，在客户端和服务器之间建立会话状态，并在连接期间持续存在。

这种固有的有状态特性使 MCP 很难大规模运行。例如，将 MCP 服务器放在标准负载均衡器后面会很困难，因为客户端的会话与持有其状态的特定服务器实例绑定在一起。

本提案概述了一系列变更，以**默认启用无状态 MCP**，并采用一种协议复杂性和状态的“按需付费”模型。在这种模型下，我们默认提供简单、无状态的特性，只在真正需要该功能的场景中，才引入有状态、长连接的开销。

具体而言，本 SEP 提议移除建立状态的初始化握手，并用离散、无状态的替代方案取而代之。这一初始步骤允许每个请求独立处理，简化服务器端逻辑，并为稳健、可扩展的部署铺平道路。

## 动机

Model Context Protocol（MCP）规范目前要求进行有状态的初始化握手。这一设计选择给可扩展性、可靠性和实现简洁性带来了重大挑战。本 SEP 的动机是解决这些不足。

### 有状态性的问题

核心问题在于：服务器必须保留前面请求的会话状态，才能理解后续请求。这与现代云原生系统的设计理念直接相悖，后者更倾向于无状态服务，因为它们更具韧性和可扩展性。

1. **可扩展性的阻碍：** 最关键的问题是难以对有状态 MCP 做负载均衡。简单的无状态负载均衡器（例如 L4/L7 轮询）无法使用，因为它会将客户端请求路由到不同的后端服务器，而这些服务器都不会拥有正确的会话状态。运维人员不得不实现复杂且脆弱的方案，例如黏性会话，将客户端绑定到特定服务器。这会使基础设施复杂化，可能导致负载分配不均，并使服务的水平扩展变得非平凡。
2. **韧性和容错性差：** 在有状态模型中，如果处理某个客户端会话的特定服务器实例发生故障，该会话状态就会丢失。客户端必须检测连接失败，重新建立连接（通常会通过负载均衡器连接到新的服务器实例），并再次执行整个初始化握手。这个过程具有破坏性且效率低下，还增加了围绕“可恢复性”的复杂性。
3. **实现复杂度增加：** 当前模型给开发者带来了显著负担。
   - **服务器端：** 开发者必须实现逻辑来创建、管理并最终回收每个客户端的会话状态。这是常见的漏洞和内存泄漏来源。
   - **客户端：** 开发者必须编写复杂代码来管理持久连接，并处理不可避免的网络故障和重连，包括在断开后重新同步状态的逻辑。

## 设计原则

本提案为协议复杂性建立了“按需付费”模型，并按优先级遵循以下原则：

1. **优先无状态性：** 尽可能让请求保持自包含，提供服务器处理请求所需的全部信息，而不依赖前序请求的状态。
2. **优先使用状态引用：** 如果完全无状态的交互不可行，则应在每个请求中传递对状态的引用。
3. **将有状态性视为最后手段：** 只有在不存在更简单的替代方案来解决关键用例时，才应接受有状态逻辑和长生命周期流连接的复杂性。

### 传输一致性

至关重要的是，这些无状态原则应在所有传输方式中一致应用。保持 `stdio` 和 `http` 实现同步，确保了**统一的开发者体验**，使核心协议语义只需学习一次，就能应用于各处。这种一致性简化了传输无关库和工具的创建，并防止协议碎片化，即不同传输以根本不同的方式运行。一个单一且一致的协议模型对健康的生态系统至关重要。

## 规范

### 概述

本规范从根本上重构了 MCP 的交互模型，使其变为**以无状态为先**。目前，MCP 要求在交换任何资源之前必须进行强制性的三方初始化握手。该握手会协商并建立若干关键信息：

1. MCP 协议版本
2. 服务器能力和 `serverInfo`
3. 客户端能力和 `clientInfo`

这一初始化握手的要求**强制建立了一种状态**，并预期在客户端与服务器之间的后续通信期间持续存在。此外，通过将这些协商打包到单一初始化阶段，规范在它们之间建立了隐含联系，尤其是能力交换与强制性的连接生命周期之间。

本提案旨在**移除初始化握手**，并将其功能“拆分”成离散的无状态组件。我们将为客户端和服务器提供新的、定义更清晰的机制，以便在不需要强制状态创建周期的情况下交换这些信息。

> **注意：** 会话管理（包括传输层和应用层）由 [SEP-2322][SEP-2322] 和 [SEP-2567][SEP-2567] 单独处理。此 SEP 仅专注于移除初始化握手，并为版本协商、发现和能力提供无状态替代方案。

### 协议版本

为了使请求自包含，先前在握手期间协商的元数据现在必须包含在**每个请求**中。

#### HTTP

对于 HTTP 传输，协议版本 MUST 通过 **HTTP 头**传递。头部值 MUST 与请求负载 `_meta` 字段中提供的值一致；否则服务器 MUST 返回 `400 Bad Request`（见 [SEP-2243][SEP-2243]）。

- `MCP-Protocol-Version: 2025-06-18`
  - **目的**：告知服务器客户端在此特定请求中使用的是 MCP 规范的哪个版本。
  - **要求**：此头部是**强制性的**。服务器应拒绝缺少版本或版本不受支持的请求。
  - 该头部 MUST 与下文请求中指定的值一致。

#### 每请求版本

`protocol-version` MUST 直接嵌入到请求负载的 `_meta` 字段中。对于 HTTP，\_meta MUST 与对应的 HTTP 头一致，否则服务器应返回 400 Bad Request。

以下 diff 展示了 `RequestMetaObject` 所需的更改：

```ts
export interface RequestMetaObject extends MetaObject {
  progressToken?: ProgressToken;
+ /**
+  * 此请求正在使用的 MCP 协议版本。
+  */
+ "io.modelcontextprotocol/protocolVersion": string;
  // 下面“每请求客户端能力”部分引入了额外的每请求字段
  // （clientInfo、clientCapabilities、logLevel）。
}
```

#### 不支持的协议版本

如果服务器收到其未实现的协议版本请求（无论该版本对服务器而言是未知版本，还是已知但服务器选择不支持的版本，例如实验版或草案版），它 MUST 返回 JSON-RPC 错误响应。对于 HTTP，响应状态码 MUST 为 `400 Bad Request`。该错误 MUST 符合以下结构：

```ts
export const UNSUPPORTED_PROTOCOL_VERSION = -32004;

export interface UnsupportedProtocolVersionError extends Omit<
  JSONRPCErrorResponse,
  "error"
> {
  error: Error & {
    code: typeof UNSUPPORTED_PROTOCOL_VERSION;
    data: {
      /**
       * 服务器支持的协议版本字符串数组。
       */
      supported: string[];
      /**
       * 客户端请求的协议版本。
       */
      requested: string;
    };
  };
}
```

#### 版本协商流程

在没有初始化握手的情况下，版本协商会在线完成：

1. 客户端发送请求时，在 `MCP-Protocol-Version` 头和 `io.modelcontextprotocol/protocolVersion` `_meta` 字段中提供其首选协议版本。
2. 如果服务器支持该版本，则正常处理请求。
3. 如果服务器不支持所请求的版本，则返回一个 `UnsupportedProtocolVersionError`，其中包含其 `supported` 版本列表。
4. 客户端从该列表中选择一个双方都支持的版本并重试。

或者，客户端 **MAY** 先调用 `server/discover`，在发送其他请求之前了解服务器支持的版本。

### 服务器能力发现

为了让客户端适配不同的服务器实现，本规范引入了一个**发现 RPC**。它为服务器公布其支持的协议版本和能力提供了标准机制。

服务器 **MUST** 实现 `server/discover`。客户端 **MAY** 调用它，但不是必需的——客户端可以在不先调用发现端点的情况下自由发起任何 RPC。如果客户端调用了不支持的 RPC，服务器 **MUST** 返回 `Method not found` 的 JSON-RPC 错误（`-32601`）。对于 HTTP，响应状态码 MUST 为 `404 Not Found`。

#### `server/discover` RPC

- **目的**：允许客户端查询服务器支持的协议版本、能力以及其他元数据。

**请求模式：**

```ts
export interface DiscoverRequest extends Request {
  method: "server/discover";
  params?: {};
}
```

**响应模式：**

```ts
export interface DiscoverResult extends Result {
  /**
   * 该服务器支持的 MCP 协议版本字符串列表。
   * 客户端应从该列表中选择一个版本用于后续请求。
   */
  supportedVersions: string[];

  /**
   * 描述服务器能力的对象。
   */
  capabilities: ServerCapabilities;

  /**
   * 有关服务器软件实现的信息。
   */
  serverInfo: Implementation;

  /**
   * 描述如何使用服务器及其功能的自然语言说明。
   * 客户端可用它来提升 LLM 对可用工具的理解
   * （例如，将其包含在 system prompt 中）。
   */
  instructions?: string;
}
```

### 每请求客户端能力

为了完成与初始握手的解耦，客户端能力不再仅在初始化时协商一次。相反，客户端 **MUST** 在每个请求中都指定其能力。这确保服务器始终充分了解该特定事务中客户端可处理的可选特性。空的能力对象表示客户端不支持任何可选能力——服务器 **MUST NOT** 从之前的请求中推断能力。

#### 每请求元数据模式

每个请求的 `_meta` 都携带一小组此前存在于初始化握手中的字段。完整的 `RequestMetaObject` 结构如下：

```ts
export interface RequestMetaObject extends MetaObject {
  progressToken?: ProgressToken;
  /**
   * 此请求正在使用的 MCP 协议版本。
   */
  "io.modelcontextprotocol/protocolVersion": string;
  /**
   * 标识客户端软件。
   */
  "io.modelcontextprotocol/clientInfo": Implementation;
  /**
   * 此特定请求中客户端的能力。
   */
  "io.modelcontextprotocol/clientCapabilities": ClientCapabilities;
  /**
   * 此请求所需的日志级别。
   */
  "io.modelcontextprotocol/logLevel"?: LoggingLevel;
}
```

字段语义：

- `"io.modelcontextprotocol/protocolVersion"`：`string` — MCP 协议版本。**必需。** 协商细节见上文“协议版本”部分。
- `"io.modelcontextprotocol/clientInfo"`：`Implementation` — 标识客户端软件。**必需。** `Implementation` 模式要求 `name` 和 `version`；其他字段可选。
- `"io.modelcontextprotocol/clientCapabilities"`：`ClientCapabilities` — 此请求中客户端的能力。**必需。**
- `"io.modelcontextprotocol/logLevel"`：`LoggingLevel` — 此请求所需的日志级别。**可选。** 若缺失，服务器 **MUST NOT** 为此请求发送任何日志通知。客户端通过显式设置级别来选择接收日志消息。替代 `logging/setLevel` RPC。

根目录（Roots）不会故意作为每请求 `_meta` 字段包含在内。需要客户端 roots 的服务器 **MUST** 通过 MRTR `ListRootsRequest` 机制请求它们（见 [SEP-2322][SEP-2322]），这样可避免在每个请求中携带可能很大的 root 列表，并遵循“按需付费”原则。

如果请求缺少任何必需字段，则该请求是格式错误的；服务器 **MUST** 使用 `INVALID_PARAMS` 拒绝它（对于 HTTP，则返回 `400 Bad Request`）。

#### 响应流式传输

这些声明的能力决定服务器可在响应流中包含什么。[SEP-2322][SEP-2322]（MRTR）定义了服务器到客户端的交互如何通过 `IncompleteResult` 内联嵌入到响应中；本 SEP 指定这些交互由 `RequestMetaObject` 中声明的每请求 `clientCapabilities` 进行约束。

对于 HTTP，任何请求的响应 **MAY** 通过 SSE 流（`Content-Type: text/event-stream`）而不是单个 JSON 对象返回。只有通知（例如 `notifications/progress`、`notifications/message`）会作为该流中的独立消息传输，之后是最终结果。服务器到客户端的交互（sampling、elicitation、listRoots）**不是**作为独立请求发送——它们作为输入请求嵌入在特定请求路径返回的 `IncompleteResult` 中（例如 `CallTool`、`GetPrompt`、`ListResources`）。客户端处理这些输入请求并重试原始请求。

#### 请求取消

客户端如何取消正在进行中的请求取决于传输方式：

- **HTTP。** 关闭 SSE 响应流 MUST 被服务器视为取消该请求。由于每个请求都有自己的响应流，传输层断开是明确无歧义的。
- **STDIO。** 客户端 MUST 发送一个引用该请求 ID 的 `notifications/cancelled` 通知。STDIO 只有一个共享通道，因此不存在可关闭的每请求流。

服务器 **SHOULD** 尽快停止处理已取消的请求，并且 **MUST NOT** 再为其发送任何后续消息。

##### 可恢复流已移除

由于连接中断现在会隐式取消请求，因此可恢复的 SSE 流（通过 `Last-Event-ID` 重连）被移除。它们与“默认无状态”范式相矛盾：恢复流会要求服务器在连接失败后保留每请求状态。

需要持久性或可恢复性的工作负载 **MUST** 改用 tasks 原语，它提供了在连接中断后获取结果的显式机制。

#### 缺少必需能力

服务器 **MUST NOT** 依赖客户端未声明的能力。如果处理请求需要某项客户端未在 `clientCapabilities` 中声明的能力，服务器 **MUST** 返回一个说明缺失能力的 JSON-RPC 错误。对于 HTTP，响应状态码 MUST 为 `400 Bad Request`。

```ts
export const MISSING_REQUIRED_CLIENT_CAPABILITY = -32003;

export interface MissingRequiredClientCapabilityError extends Omit<
  JSONRPCErrorResponse,
  "error"
> {
  error: Error & {
    code: typeof MISSING_REQUIRED_CLIENT_CAPABILITY;
    data: {
      /**
       * 服务器处理该请求所需的客户端能力。
       */
      requiredCapabilities: ClientCapabilities;
    };
  };
}
```

### `subscriptions/listen` RPC

本 SEP 引入一个新的 `subscriptions/listen` RPC，用于替代先前的 HTTP GET 端点，并确保 HTTP 与 STDIO 之间行为一致。客户端使用它来打开一个长生命周期通道，以接收特定请求上下文之外的通知。

用于 Streamable HTTP 的服务器到客户端消息的 HTTP GET 端点在本版本协议中**移除**。所有通信都使用 POST。

根据 [SEP-2260][SEP-2260]，只有通知（不是请求）会在该通道上传输；服务器发起的请求使用 MRTR（见上文“响应流式传输”）并限定于某个特定客户端请求。

#### 请求模式

```ts
export interface SubscriptionsListenRequest extends Request {
  method: "subscriptions/listen";
  params: {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": string;
      "io.modelcontextprotocol/clientInfo": Implementation;
      "io.modelcontextprotocol/clientCapabilities": ClientCapabilities;
      // ... 其他 meta 字段
    };

    /**
     * 客户端希望在此流上接收的通知。
     * 每种通知类型都需要显式启用；服务器 **MUST NOT** 发送
     * 客户端未在此处明确请求的通知类型。
     */
    notifications: {
      /**
       * 如果为 true，接收 notifications/tools/list_changed。
       */
      toolsListChanged?: boolean;

      /**
       * 如果为 true，接收 notifications/prompts/list_changed。
       */
      promptsListChanged?: boolean;

      /**
       * 如果为 true，接收 notifications/resources/list_changed。
       */
      resourcesListChanged?: boolean;

      /**
       * 为特定资源 URI 订阅 notifications/resources/updated。
       * 替代 resources/subscribe RPC。
       */
      resourceSubscriptions?: string[];
    };
  };
}
```

`notifications` 字段是**必需的**，且客户端 **MUST** 明确选择加入其希望接收的每种通知类型。如果 `notifications` 内的某个字段被省略（或设置为 `false`），服务器 **MUST NOT** 发送该类型的通知。

#### 确认通知

服务器首先发送此通知，以确认订阅已建立。该订阅是长生命周期的，没有自然的“完成结果”；它在以下情况结束：

- 客户端显式取消它（在 HTTP 上关闭 SSE 流，或在 STDIO 上发送 `notifications/cancelled`）；
- 底层连接关闭（HTTP 超时、TCP 断开、STDIO 进程退出）；或
- 服务器将其拆除（例如关闭），在这种情况下它 **MUST** 关闭 SSE 流（HTTP）或发送引用该订阅请求 ID 的 `notifications/cancelled`（STDIO）。

```ts
export interface SubscriptionsAcknowledgedNotification extends Notification {
  method: "notifications/subscriptions/acknowledged";
  params: {
    /**
     * 服务器同意遵守的通知订阅。
     * 仅包含服务器实际支持的通知类型。
     * 如果客户端请求了不支持的通知类型
     * （例如，服务器没有 prompts 但请求了 promptsListChanged），
     * 则会从该集合中省略。
     */
    notifications: {
      toolsListChanged?: boolean;
      promptsListChanged?: boolean;
      resourcesListChanged?: boolean;
      resourceSubscriptions?: string[];
    };
  };
}
```

#### 多个并发订阅

客户端 **MAY** 同时拥有多个活动订阅（例如，一个监听工具列表变更，另一个监听资源更新）。每个订阅由其 `SubscriptionsListenRequest` 的 JSON-RPC 请求 ID 标识。

为了让 STDIO 客户端能够在单一共享通道上解复用属于不同订阅的通知，作为活动订阅一部分传递的每个通知 **MUST** 在 `_meta` 中包含该订阅的请求 ID：

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "<original listen request id>"
    }
  }
}
```

这种相同的关联模式也适用于其他需要与特定请求关联的服务器到客户端通知，例如 `notifications/progress`（它使用原始请求的 ID）。

#### 停止订阅

- **HTTP。** 关闭 SSE 响应流即可停止订阅。
- **STDIO。** 客户端发送引用 listen 请求 ID 的 `notifications/cancelled`。服务器 **MUST** 停止向该订阅发送通知。

#### 传输行为

**HTTP。** 客户端通过 `POST` 发送 `SubscriptionsListenRequest`。服务器的响应是一个打开的 SSE 流（`Content-Type: text/event-stream`），且该流中的第一条 JSON-RPC 消息 **MUST** 是 `SubscriptionsAcknowledgedNotification`。

**STDIO。** 客户端可在任意时刻发送 `SubscriptionsListenRequest`。服务器 **MUST** 通过发送 `SubscriptionsAcknowledgedNotification` 来确认它。后续通知在双向 STDIO 通道上传输，每条通知都按照上文所述带有订阅请求 ID 标记。如果连接终止（例如服务器崩溃并重启），客户端 **MUST** 重新发送 `SubscriptionsListenRequest` 以重新建立其订阅。

### 已弃用和移除的 RPC

为简化协议并与按请求能力的迁移保持一致，以下 RPC 方法和通知被移除：

- `initialize` / `notifications/initialized`：初始化握手已移除。版本协商通过 `MCP-Protocol-Version` 头和 `_meta` 字段按请求处理。能力发现由 `server/discover` 处理。
- `logging/setLevel`：已移除。日志级别现在通过 `'io.modelcontextprotocol/logLevel'` `_meta` 字段按请求指定。没有替代 RPC。
- `roots/list`：作为顶层服务器到客户端 RPC 已移除。需要客户端 roots 的服务器 **MUST** 通过 MRTR `ListRootsRequest` 机制请求它们（见 SEP-2322）。
- `notifications/roots/list_changed`：已移除。Roots 通过 MRTR 按需获取，因此不需要变更通知。
- `resources/subscribe` / `resources/unsubscribe`：这些方法已移除。资源订阅本质上是有状态的——服务器必须记住每个客户端订阅了哪些资源。相反，客户端在 `subscriptions/listen` 请求的 `notifications` 参数中声明他们希望接收更新的资源。服务器会针对匹配的资源在 listen 流上发送 `notifications/resources/updated`。
- `ping`：在**双向**都已移除。服务器到客户端的 ping 被移除，因为服务器不再能够独立发送请求。客户端到服务器的 ping 也被移除，因为任何正常的 RPC 调用已经足以证明服务器存活，而传输层机制（HTTP keep-alives、SSE 注释、STDIO 进程状态）更适合处理连接健康检查。

## 理由

### 默认采用无状态优先

本 SEP 的主要设计决策是移除强制性的初始化握手，使无状态交互成为该协议的默认模型。这个选择根植于“按需付费”原则，并希望让 MCP 与现代云原生架构保持一致。通过将最简单的交互模型设为默认，我们降低了入门门槛，并减少了最常见使用场景下的实现复杂度。这也立即支持了直接的水平扩展并提升了弹性，因为任何请求都可以由任意服务器实例处理。

#### 备选方案：可选握手

我们考虑过的另一种方案是保留现有的有状态握手，但将其设为可选。在这种模型下，客户端可以选择执行握手来建立持久会话，也可以跳过握手并发送自包含请求。

#### 为什么被否决：

支持两种并行交互模型会极大增加协议以及每个实现的复杂度。服务器和客户端都需要构建、测试和维护两套独立的逻辑路径，从而扩大 bug 的产生面。这也违背了“完成核心功能只应有一种清晰、显而易见的方式”这一设计原则。通过做出明确切换，我们确保整个生态系统能够向前发展，并受益于一个更简单、更具可扩展性且更稳健的基础。

### 显式会话管理

该提案最初包含专门用于管理逻辑会话生命周期的 `sessions/create` 和 `sessions/delete` RPC。

会话管理现已由 [SEP-2567][SEP-2567] 单独处理，该提案建议完全移除会话，并以显式状态句柄替代。这与核心维护者作出的 [sessions-vs-sessionless 决策][sessions-decision] 保持一致。

### 职责分离

本提案的核心原则之一，是将单一的初始化握手“解耦”为一组离散的、单用途的 RPC。原始握手将协议协商与能力发现这两个职责混杂在一次复杂交互中。新设计明确将它们分离为：

- **发现**：专门由 `server/discover` 处理。
- **能力**：通过 `_meta` 字段或 `subscriptions/listen` RPC 按请求处理。

这样做的理由是为了创建一个更模块化、更灵活且更易理解的协议。现在每个组件都有了单一、明确定义的职责。这使得客户端只使用其所需的协议部分，遵循我们的“按需付费”原则。

#### 备选方案：单体式握手

我们本可以保留一个单一的、包罗万象的握手 RPC，并仅为其添加更多参数和更复杂的逻辑，以支持无状态优先模型。

#### 为什么被否决：

一个“什么都做”的 RPC 很难实现、测试和演进。它迫使所有客户端，即使是最简单的客户端，也必须了解协议中最复杂的特性。通过分离这些职责，我们让协议更易于学习和正确实现，同时也使其未来更灵活、更具扩展性。

## 向后兼容性

尽管本提案尝试保留现有功能和使用场景，但它引入了一个**根本性的、向后不兼容的变更**。因此，它将需要协议的新版本。

### 支持多个版本

虽然该 SEP 移除了 `initialize` 握手，但希望同时支持新旧客户端的服务器**可以**这样做。此类服务器可以继续实现旧的 `initialize` RPC 来处理遗留客户端，同时为更新后的客户端暴露新的无状态 RPC（`server/discover` 等）。

服务器和客户端都应能够适当地处理版本变更。下面列出了两个示例场景，其中 vPrev 表示该 SEP 之前的版本，vAfter 表示之后的版本。

#### 客户端（支持 vPrev）→ 服务器（vPrev, vPost）

1. 客户端发送初始化
2. 服务器支持 vPrev，因此会按规范返回初始化
3. 客户端与服务器按 `vPrev` 通信。

#### 客户端（支持 vPrev, vPost）→ 服务器（vPrev）

对于 HTTP，客户端可以尝试任何 vPost 请求（例如，带有 MCP 协议版本头的 `tools/list`）。服务器返回 `400 Bad Request`（或 `Unsupported protocol version`）；客户端随后为后续请求回退到 vPrev（并执行初始化）。

对于 STDIO，客户端不能依赖单次请求错误来检测服务器版本。一个同时支持 vPost（不需要初始化）**以及**需要 `initialize` 的遗留版本的客户端**应该**首先通过探测 `server/discover` 来确定使用哪个版本：

1. 客户端发送 `server/discover`，并将 MCP Protocol Version `_meta` 字段设置为其首选的 vPost。
2. 如果服务器支持 vPost（或客户端也支持的任何 vPost 风格版本），客户端会在后续请求中使用发现到的版本。
3. 如果服务器返回 `Unsupported protocol version` 或 `Method not found`，客户端会回退到其支持的遗留版本，并执行 `initialize` 握手。

只支持 vPost 风格版本的客户端无需进行探测——它只需使用其首选版本，并正常处理 `Unsupported protocol version` 错误即可。

## 安全影响

在没有会话握手的情况下，每个请求都必须独立进行身份验证和授权。实现**必须**确保不会因为移除初始化阶段而绕过身份验证。

除了按请求认证之外，本提案没有引入额外的安全问题。

## 参考实现

// TODO

## 常见问题

### 什么是协议层面的无状态性？

[Wikipedia](https://en.wikipedia.org/wiki/Stateless_protocol) 将无状态协议定义为：

> 无状态协议是一种通信协议，其中接收方不得保留来自先前请求的会话状态。发送方会以一种方式将相关会话状态传递给接收方，使得每个请求都可以独立理解，也就是说，无需参考接收方保留的先前请求中的会话状态。

这并不意味着你不能在无状态协议之上构建有状态应用。HTTP 就是无状态协议的一个例子，而当今大多数 Web 都构建在它之上。然而，这确实意味着状态不能存在于协议本身中，而应当在请求中指定状态（如果做不到，则应提供一个供服务器或客户端跟踪的状态引用）。

### 这是否意味着 MCP 会成为一个完全无状态的协议？

并不完全是（因此是“默认如此”）。取决于你对“请求”的解释，文中提到的 SSE 流（无论是客户端发起还是服务器发起）往往会在一个流的上下文中包含多个请求。然而，这些流被限制在单个 HTTP 请求之内，并且是可选使用的，这意味着复杂性既受限，也只会在场景需要时才使用。

### 为什么 STDIO 也必须是无状态的？

MCP 所使用的传输层应该只是一种实现细节。如果协议的某个版本支持的功能无法顺畅映射到协议的另一个版本，那么它们实际上就是两个不同的协议。

这使开发者更容易在不同传输之间切换服务，而无需对应用行为做出重大更改；同时也更容易在不同传输之间正确地进行代理。否则，这些不同实现之间将持续存在功能缺口和割裂，从而导致混淆和不兼容。

### `server/discover` 与 MCP Server Card 有什么关系？

`server/discover` RPC 与 [MCP Server Card][SEP-2127] 提案存在重叠，该提案定义了一个用于基于 HTTP 发现的 `.well-known/mcp.json` 文档。两种机制都被有意保留：Server Card 更适合 HTTP（无需认证、可缓存、可索引），而 `server/discover` 提供了一个统一的 RPC 接口，可在 HTTP 和 STDIO 传输之间一致工作。在适用的情况下，两者在内容上应保持一致。

## 未决问题

### `_meta` 中应包含哪些内容，哪些应作为顶层协议字段？

本 SEP 将若干先前通过握手协商的值（`protocolVersion`、`clientInfo`、`roots`、`logLevel`、`clientCapabilities`）放入 `io.modelcontextprotocol/` 命名空间下的按请求 `_meta` 字段中。这符合规范对于“特定用途元数据”的允许，这些元数据由 schema 中的定义保留。

然而，这也存在 `_meta` 被逐渐过度使用的风险——到什么时候我们还要重新添加顶层字段？一种可能的区分方式是：必需的协议级字段（例如 `protocolVersion`）可能更适合放在顶层字段中，而可选或由扩展提供的值则保留在 `_meta` 中。在该 SEP 最终定稿之前，这个问题值得更广泛的讨论。

### `clientInfo` 应该成为 `ClientCapabilities` 的一部分吗？

目前，`clientInfo`（`Implementation` 类型）和 `clientCapabilities`（`ClientCapabilities` 类型）是分开的字段。在按请求模型中，将所有客户端元数据放入一个字段可以降低开销。然而，`clientInfo` 的用途（身份/UI）与能力（特性协商）不同。`clientInfo` 是否应并入 `ClientCapabilities`、保留为单独的按请求 `_meta` 字段，还是完全通过其他机制处理（例如仅通过 `subscriptions/listen` 发送）？

[SEP-2127]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
[SEP-2243]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2243
[SEP-2260]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2260
[SEP-2322]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322
[SEP-2567]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567
[sessions-decision]: https://github.com/modelcontextprotocol/transports-wg/blob/main/docs/sessions-vs-sessionless-decision.md
