# SEP-2260: 要求服务器请求必须与客户端请求关联。

- **状态**：最终版
- **类型**：标准轨道
- **创建于**：2026-02-16
- **作者**：MCP 传输工作组
- **赞助者**：@CaitieM20 - Caitie McCaffrey
- **PR**: https://github.com/modelcontextprotocol/specification/pull/2260

## 摘要

本 SEP 澄清：`roots/list`、`sampling/createMessage` 和
`elicitation/create` 请求 **必须** 与一个发起的
客户端到服务器请求相关联（例如，在 `tools/call`、`resources/read` 或
`prompts/get` 处理期间）。这些类型的独立服务器发起请求
如果不在通知之外出现，**不得** 实现。

尽管在当前 MCP 数据层中未强制执行，但从逻辑上讲，这些请求
**必须** 与一个有效的客户端到服务器 JSON-RPC 请求 Id 关联。

操作性的服务器到客户端 **Ping** 不受此限制。

## 动机

### 当前规范

当前规范在传输层使用了 **应当** 语言：

在 Streamable HTTP 传输中响应 POST 请求的上下文里 [(2025-11-25/basic/transports.mdx:121-L123)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/2025-11-25/docs/specification/2025-11-25/basic/transports.mdx?plain=1#L121-L123)：

> - “服务器 **可以** 在发送 JSON-RPC _响应_ 之前发送 JSON-RPC _请求_ 和 _通知_。这些消息 **应当** 与发起的客户端 _请求_ 相关。”

对于可选的 GET SSE 流 [(2025-11-25/basic/transports.mdx:146-L148)](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/2025-11-25/docs/specification/2025-11-25/basic/transports.mdx?plain=1#L146C1-L148C32)：

> - “服务器 **可以** 在流上发送 JSON-RPC _请求_ 和 _通知_。”
> - “这些消息 **应当** 与客户端当前运行中的任何 JSON-RPC _请求_ 无关。”

尽管 GET 流允许“未经请求”的请求，但它的使用完全是可选的，MCP 服务器作者不能依赖它。

### 设计意图

MCP 服务器请求的设计意图是在其他 MCP 操作内部**嵌套地**、响应式地运行：

- **采样** 使服务器能够在处理工具调用、资源请求或提示时请求 LLM 协助
- **诱导** 使服务器能够收集完成操作所需的额外用户输入
- **列出根目录** 使服务器能够识别共享存储位置

**Ping** 具有特殊地位，因为它主要用于保活/健康检查机制。

对于 Streamable HTTP 服务器，这使得如果没有可发送的通知或请求，SSE 流可以保持较长时间。对于客户端到服务器的请求，它们是可关联的。未来的传输实现将不再需要脱离上下文的 Ping。

当前规范已经描述了这种模式：

> “MCP 中的采样允许服务器通过使 LLM 调用在其他 MCP 服务器功能内部_嵌套_发生，从而实现智能体行为。”

然而，规范性要求并未强制执行这一约束。

### 简化收益

使这一约束显式化：

1. **简化传输实现** - 传输不需要支持任意的服务器发起请求/响应流程，这类流程需要从服务器到客户端的持久连接；它们只需要请求范围内的双向通信
2. **澄清用户体验** - 用户能够理解，采样/诱导之所以发生，是因为他们发起了某个动作，而不是无缘无故发生的
3. **减少安全暴露面** - 确保客户端了解额外请求的信息将用于什么范围。这使客户端能够更明智地决定是否提供所请求的信息。
4. **与实践一致** - 基于对 GitHub 的扫描，所有现有实现都已遵循这一模式，除了一个由 SEP 作者拥有、且场景刻意构造的仓库。

## 规范变更

### 1. 为功能文档添加警告块

**在 `client/sampling.mdx` 中（在现有安全警告之后）：**

```markdown
<Warning>

**请求关联要求**

服务器 **必须** 仅在与发起的客户端请求关联时发送 `sampling/createMessage` 请求（例如，在 `tools/call`、`resources/read` 或 `prompts/get` 处理期间）。

在独立通信流上进行独立的服务器发起采样（与任何客户端请求无关）不受支持，且 **不得** 实现。未来的传输实现不需要支持这种模式。

</Warning>
```

**在 `client/elicitation.mdx` 中（在现有安全警告之后）：**

```markdown
<Warning>

**请求关联要求**

服务器 **必须** 仅在与发起的客户端请求关联时发送服务器到客户端请求（例如 `roots/list`、
`sampling/createMessage` 或 `elicitation/create`）。

在独立通信流上进行这些类型的独立服务器发起请求（与任何客户端请求无关）不受支持，且
**不得** 实现。未来的传输实现不需要支持这种模式。

</Warning>
```

**在 `client/roots.mdx` 中（在 `User Interaction Model` 章节中）：**

```markdown
<Warning>

服务器 **必须** 仅在与发起的客户端请求关联时发送服务器到客户端请求（例如 `roots/list`、
`sampling/createMessage` 或 `elicitation/create`）。

在独立通信流上进行这些类型的独立服务器发起请求（与任何客户端请求无关）不受支持，且
**不得** 实现。未来的传输实现不需要支持这种模式。

</Warning>
```

**在 `basic/utilities/ping.mdx` 中（在 `Overview` 章节中）：**

```markdown
<Warning>

`ping` 是一种 MCP 级别的存活检查，并且 **可以** 由任一方在已建立的会话/连接上
随时发送。

在 Streamable HTTP 中，实现 **应当** 优先使用传输层 SSE
keepalive 机制来维护空闲连接；`ping` 仍可用于协议级响应性检查。

对 `roots/list`、`sampling/createMessage`
和 `elicitation/create` 的请求关联要求不适用于 `ping`。

</Warning>
```

### 2. 澄清传输层约束

**在 `basic/transports.mdx` 中，POST 触发的 SSE 流（约第 121 行）：**

```diff
- The server **MAY** send JSON-RPC _requests_ and _notifications_ before sending the
- JSON-RPC _response_. These messages **SHOULD** relate to the originating client
- _request_.
+ The server **MAY** send JSON-RPC _requests_ and _notifications_ before sending the
+ JSON-RPC _response_. These messages **MUST** relate to the originating client
+ _request_.
```

**在 `basic/transports.mdx` 中，GET 触发的独立 SSE 流（约第 147 行）：**

```diff
- The server **MAY** send JSON-RPC _requests_ and _notifications_ on the stream.
- These messages **SHOULD** be unrelated to any concurrently-running JSON-RPC
- _request_ from the client.
+ The server **MAY** send JSON-RPC _notifications_ and _pings_ on the stream.
+ These messages **SHOULD** be unrelated to any concurrently-running JSON-RPC
+ _request_ from the client, **except** that `roots/list`,
+ `sampling/createMessage`, and `elicitation/create` requests **MUST NOT** be
+ sent on standalone streams.
```

## 向后兼容性

### 影响评估

预计此变更对现有实现的影响 **极小或没有影响**：

1. **保留常见使用模式** - 工具执行、资源读取和提示处理中的采样/诱导将继续完全受支持
2. **未发现已知受影响实现** - 对 GitHub 的研究显示，只有一个实现使用了这种模式。这个单一实现归 SEP 作者所有。

### 被禁止的内容

以下这种模式此前从未被明确记录或推荐，现在被明确禁止：

```python
# ❌ 被禁止：独立的服务器推送
async def background_task():
    while True:
        await asyncio.sleep(60)
        # 尝试在没有任何客户端请求上下文的情况下发起采样
        await session.create_message(...)  # 不允许
```

### 仍然受支持的内容

规范模式仍然完全受支持：

```python
# ✅ 受支持：在工具执行期间进行采样
@mcp.tool()
async def analyze_data(data: str, ctx: Context) -> str:
    # 在处理工具调用时请求 LLM 分析
    result = await ctx.session.create_message(
        messages=[SamplingMessage(role="user", content=...)]
    )
    return result.content.text
```

## 实现指南

### 对服务器实现者

如果你的服务器满足以下条件，则**无需更改**：

- 仅在工具处理器内使用服务器到客户端请求
- 仅在资源/提示处理器内使用服务器到客户端请求
- 将服务器到客户端请求作为处理客户端请求的一部分同步使用

如果你的服务器满足以下条件，则**需要更改**：

- 试图在独立的 HTTP GET 流上发起服务器到客户端请求
- 试图发送独立于客户端操作的服务器到客户端请求请求
- 存在试图调用服务器到客户端请求的后台任务

对于“需要更改”的情况，需要实现替代设计。

对于在初始化后立即执行未经请求的服务器到客户端请求（通常是 URL 诱导）的实现者，建议将这些请求懒加载地放入需要客户端提供该信息的客户端到服务器请求范围内执行。

### 超时考虑

当 MCP 服务器在客户端请求内部发起一个“嵌套”请求时，父请求的持续时间会延长，以包含用户的响应时间。

实现者 **必须** 确保：

1. 传输超时（例如 HTTP 请求超时）足以容纳“人机协同”延迟，这类延迟可能是无界的。
2. 基础设施强制的短超时（例如负载均衡器）可能导致
   在用户响应前连接终止。对于 Streamable HTTP，应当
   使用传输层 SSE keepalive 机制来保持连接存活并重置计时器；`ping` 请求
   **可以** 额外用于协议级响应性检查。

### 对客户端实现者

**无需更改** - 客户端应该已经在自身的出站请求上下文中处理采样/诱导请求。如果当前支持带外请求，这里有简化实现的潜力。

收到没有关联出站请求的服务器到客户端请求的客户端 **应当** 返回 `-32602`（无效参数）错误。

### 对传输实现者

未来的传输实现可以依赖以下保证：

- 采样/诱导请求只会在客户端发起请求的范围内发生
- 传输不需要支持在独立通道上的任意服务器发起请求/响应流程
- 请求关联和生命周期管理得到简化

## 时间线

（本 SEP 旨在作为一项公开通知，告知在未来与此用法不兼容的协议版本之前将进行的更改）

## 备选方案考虑

### 1. 软性弃用

使用 **SHOULD NOT** 语言来劝阻但不禁止这种模式。

**被拒绝，因为：** 该行为从未被有意支持，且保持其含糊不清会阻碍传输层简化。

### 2. 保持当前歧义

保持现有的 **SHOULD** 语言不变。

**被拒绝，因为：** 这会阻碍未来的传输实现，并使实现者无法确定该模式是否受支持。

### 3. 创建能力标志

为希望支持此行为的服务器添加 `sampling.standalone` 或类似的能力。

**被拒绝，因为：** 这为一个已知没有需求的用例增加了复杂性，并且与“嵌套”设计原则相矛盾。

## 参考资料

- 当前采样文档：`/specification/draft/client/sampling.mdx`
- 当前提示文档：`/specification/draft/client/elicitation.mdx`
- 传输规范：`/specification/draft/basic/transports.mdx`
- 客户端概念文档中的用户交互模型讨论
