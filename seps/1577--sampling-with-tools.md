# SEP-1577: 使用工具进行采样

- **状态**: 最终版
- **类型**: 标准跟踪
- **创建时间**: 2025-09-30
- **作者**: Olivier Chafik (@ochafik)
- **问题**: #1577

| SEP 编号          | #1577                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **标题**          | 使用工具进行采样                                                                                                              |
| **作者**          | Olivier Chafik                                                                                                                |
| **赞助者**        | @bhosmer-ant                                                                                                                  |
| **状态**          | 草案                                                                                                                         |
| **创建时间**      | 2025-09-29                                                                                                                    |
| **规范**          | MCP 2025-06-18                                                                                                                |
| **原型**          | https://github.com/modelcontextprotocol/typescript-sdk/pull/991                                                               |
| **PR**            | https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1796                                                        |
| **SDK**           | https://github.com/modelcontextprotocol/python-sdk/pull/1594 https://github.com/modelcontextprotocol/typescript-sdk/pull/1101 |

**更新**：

- _10 月 1 日_：将 `tool_choice` 重命名为 `toolChoice`（新增 `"none"` 值）；移除特殊的 `stopReason` 值 `"refusal"` 和 `"other"`；允许 `{CreateMessageResult,SamplingMessage}.content` 为单个内容或内容数组；
- _10 月 6 日_：使 `ToolResultContent` 与 `CallToolResult` 保持一致（支持图像/音频）；新增“可能的后续操作”章节。
- _10 月 10 日_：更新参考实现示例，加入简单的工具注册表（将 MCP 工具与工具循环工具统一，参见[下方评论](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1577#issuecomment-3389273471)），以及一个使用工具采样和信息征询的“选择你自己的冒险”游戏。
- _10 月 27 日_：使 `ToolResultContent.content` 与 `CallToolResult.content` 保持一致（使用 [ContentBlock](https://modelcontextprotocol.io/specification/2025-06-18/schema#contentblock)）；新增 `ToolResultContent._meta`
- _11 月 5 日_：
  - 保留 `stopReason` 作为开放字符串，但额外提供显式枚举以便查看
  - 移除在 `includeContext` 与声明的 `ClientCapabilities.sampling.context` 不匹配时必须抛出异常的要求
  - 缓解 `CreateMessageResult.content` 可以是内容数组或单个内容这一向后兼容性问题：规定在早期规范版本中，采样 _不得_ 返回数组（同时承认，更新包含采样功能的 SDK 代码时需要进行少量代码修改）
- _11 月 7 日_：将类型 `ToolCallContent` 重命名为 `ToolUseContent`（以匹配其 `tool_use` 类型和 `toolUse` `stopReason`）。SEP 已获批准！
- _11 月 10 日_：移除 `disable_parallel_tool_use`，将其留待后续更新，因为 Gemini API 目前无法实现此功能。
- _11 月 11 日_：补充关于 Gemini API 函数调用模式和角色的说明；要求包含工具结果内容的 SamplingMessage 不得与其他内容类型混合使用

## 摘要

本 SEP 为 `sampling/createMessage` 引入了 `tools` 和 `toolChoice` 参数，并将 `includeContext` 软弃用（将 `thisServer` 和 `allServers` 置于某项能力之下）。这使得 MCP 服务器能够使用客户端的 tokens 运行自己的 agentic 循环（仍然处于用户监督之下），并降低客户端实现的复杂性（上下文支持变为显式可选）。

## 动机

- [采样](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling) 不支持工具调用，尽管这是现代代理式行为的基石。若没有对其的显式支持，使用采样的 MCP 服务器要么尝试通过复杂提示词 / 对输出进行自定义解析来模拟工具调用，要么只能处理更简单、非代理式的请求。增加对工具调用的支持，可能会在 MCP 生态中解锁许多新的用例。

- 上下文包含的定义存在歧义（参见[此文档](https://docs.google.com/document/d/1KUsloHpsjR4fdXdJuofb9jUuK0XWi88clbRm9sWE510/edit?tab=t.0#heading=h.edw7oyac2e87)）：这使得完整实现采样变得特别棘手，而这再加上采样所需的其他预防措施（不受本 SEP 影响），可能促成了[客户端对该特性的低采用率](https://modelcontextprotocol.io/clients#feature-support-matrix)（该特性在 MCP 2024 年 11 月规范中引入）。

请注意一些相关工作：

- [MCP Sampling](https://docs.google.com/document/d/1KUsloHpsjR4fdXdJuofb9jUuK0XWi88clbRm9sWE510/edit?tab=t.0#heading=h.5diekssgi3pq)（@jerome3o-anthropic）：一个极其相似的提案：
  - 增加相同的工具语义，
  - 废弃 `includeContext`（文档解释了为什么其语义是模糊的）
  - （进一步建议显式上下文共享，但这超出了本提案的范围）
- [允许 Prompt/Sampling Messages 包含多个内容块。 #198](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/198)
  - 在这个 PR 中，我们让 `{CreateMessageResult,SamplingMessage}.content` 接受单个内容或内容数组。`result.content` 的变更与旧版本不兼容，但支持并行工具调用是必需的。随后 `SamplingMessage.content` 的变更使编写工具循环变得更加自然（参见参考实现中的示例：[toolLoopSampling.ts](https://github.com/modelcontextprotocol/typescript-sdk/blob/ochafik/sep1577/src/examples/server/toolLoopSampling.ts)）

在下面的“可能的后续工作”部分中，我们给出了一些超出本 SEP 范围但我们注意使其与本 SEP 保持合理兼容的功能示例。

## 规范

### 概述

- 在 [CreateMessageRequest](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest) 中添加传统工具调用支持，增加 `tools`（带 JSON schema）和 `toolChoice` 参数，并要求服务端工具循环
  - 采样现在可能返回 ToolCallBlock 响应
  - 服务端需要自行调用工具
  - 服务端再次调用采样，并通过 ToolResultParamBlock 注入工具结果
  - `toolChoice.mode` 可以是 `“auto" | "required" | "none"`，以支持常见的结构化输出用例（关于可能的后续改进见下文）
  - 由新的 capability（`sampling { tools {} }`）进行限制
- 修正/更新 [CreateMessageResult](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult) 中定义不够明确的字符串：
  - `stopReason: “endTurn" | “stopSequence" | “toolUse" | “maxToken" | string`（显式枚举 + 开放字符串以兼容）
  - `role: “assistant”`
- 对 [CreateMessageRequest.params.includeContext](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest) != ‘none’ 进行软弃用（现在由 capability 限制）
  - 鼓励实现无上下文采样

### 协议变更

- `sampling/createMessage`
  - ~~当 `includeContext is “thisServer” | “allServers”` 且 `clientCapabilities.sampling.context` 缺失时，MUST 抛出错误~~
  - 当定义了 `tool` 或 `toolChoice` 但 `clientCapabilities.sampling.tools` 缺失时，MUST 抛出错误
  - 服务端 SHOULD 避免使用 `[includeContext](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest)` != ‘none’`as values`“thisServer”`and`“allServers” 作为值，因为它们可能会在未来的规范版本中被移除。
  - `CreateMessageRequest.messages` MUST 将任何带 `ToolUseContent` 的 “assistant” 消息（以及 `id: $id1`）与一个带 `ToolResultContent` 的 “user” 消息（以及 `tool_result_id: $id1`）配对平衡
    - 注：这是 Claude API 实现的要求（并行工具调用必须一次性全部响应）
  - 带工具结果内容块的 SamplingMessage MUST NOT 包含其他内容类型。

### Schema 变更

- [ClientCapabilities](https://modelcontextprotocol.io/specification/2025-06-18/schema#clientcapabilities)

  ```typescript
  interface ClientCapabilities {
    ...
    sampling?: {
      context?: object; // 新增：允许 CreateMessageRequest.params.includeContext != "none"
      tools?: object;   // 新增：允许 CreateMessageRequest.params.{tools,toolChoice}
    };
  }
  ```

- [CreateMessageRequest](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest)（使用现有的 [Tool](https://modelcontextprotocol.io/specification/2025-06-18/schema#tool)）

  ```typescript
  interface CreateMessageRequest {
    method: “sampling/createMessage”;
    params: {
      ...
      messages: SamplingMessage[]; // 注：类型已更新，见下文
      
      tools?: Tool[] // 新增（已有类型）

      toolChoice?: ToolChoice // 新增
    };
  }

  interface ToolChoice { // 新增
    mode?: “auto” | "required" | "none";
    // disable_parallel_tool_use?: boolean; // 更新（11 月 10 日）：已移除，见下文
  }
  ```

  - 注：
    - 为避免并行工具调用，OpenAI 与 Anthropic API 的用法差异：
      - OpenAI: `parallel_tool_calls: false`（顶层参数）
      - Anthropic: `tool_choice.disable_parallel_tool_use: true`
        - 这里更希望默认如此，如果未设置则默认值为 false（例如允许并行工具调用）
    - OpenAI 与 Anthropic API 关于 `tool_choice` `"none"` 与 `tools` 的差异：
      - OpenAI: `tools: [$Foo], tool_choice: "none"` 会禁止任何工具调用
        - 这里更希望采用这种行为
      - Anthropic: `tools: [$Foo], tool_choice: {mode: "none"}` 仍可能调用工具 `Foo`
    - Gemini 与 OAI / Anthropic 关于 `disable_parallel_tool_use` 的差异：
      - 目前 Gemini API 没有办法禁用并行工具调用（不同于 OAI / Anthropic APIs）。因此暂时移除此标志，待 Gemini 具备任何支持方式后再重新引入。否则客户端可能会收到意外的多个工具调用（或者如果按另一种方式实现，则可能出现意外失败 / 为了得到单个工具调用而产生昂贵的重试）
      - Gemini API 的 [Function calling modes](https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#function_calling_modes) 中有一个 `ANY` 值，应与提议的 `required` 相匹配

- [SamplingMessage](https://modelcontextprotocol.io/specification/2025-06-18/schema#samplingmessage):

  ```typescript
  /*
    之前：
    
    interface SamplingMessage {
      content: TextContent | ImageContent | AudioContent
      role: Role;
    }
  */

  type SamplingMessage = UserMessage | AssistantMessage; // 新增

  type AssistantMessageContent =
    TextContent | ImageContent | AudioContent | ToolUseContent;
  type UserMessageContent =
    TextContent | ImageContent | AudioContent | ToolResultContent;
  interface AssistantMessage {
    // 新增
    role: "assistant";
    content: AssistantMessageContent | AssistantMessageContent[];
  }

  interface ToolUseContent {
    // 新增
    type: "tool_use";
    name: string;
    id: string;
    input: object;
  }

  interface UserMessage {
    // 新增
    role: "user";
    content: UserMessageContent | UserMessageContent[];
  }

  interface ToolResultContent {
    // 新增
    _meta?: { [key: string]: unknown };
    type: "tool_result";
    toolUseId: string;
    content: ContentBlock[];
    structuredContent: object;
    isError?: boolean;
  }
  ```

- 注：
  - 各 API 在工具调用时，role 与 content type 的差异：
    - OpenAI: `role: “system" | “user" | “assistant" | “tool"`（其中 tool 用于工具结果），而工具调用嵌套在 assistant 消息中，content 通常为 null，但一些 “OpenAI compatible” API 接受非空值
      - ```typescript
        [
          { role: "user", content: "what is the temperature in london?" },
          {
            role: "assistant",
            content: "Let me use a tool...",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"location": "London"}',
                },
              },
            ],
          },
          {
            role: "tool",
            content: '{"temperature": 20, "condition": "sunny"}',
            tool_call_id: "call_1",
          },
        ];
        ```
    - Claude API: `role: “user" | “assistant"`, 工具使用和结果通过特殊类型的消息 content 部分传递：
      - ```typescript
        [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": "what is the temperature in london?"
              }
            ],
          {
            "role": "assistant",
            "content": [
              {
                "type": "text",
                "text": "Let me use a tool..."
              },
              {
                "type": "tool_use",
                "id": "call_1",
                "name": "get_weather",
                "input": {"location": "London"}
              }
            ]
          },
          {
            "role": "user",
            "content": [
              {
                "type": "tool_result",
                "tool_call_id": "call_1",
                "content": {"temperature": 20, "condition": "sunny"}
              }
            ]
          }
        ]
        ```
    - Gemini API:
      - `function` role（类似于 OAI 的 `tool` role）
      - 没有 tool call id 概念（[function calling](https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#parallel_function_calling): Gemini 要求工具结果必须按与工具使用部分完全相同的顺序提供。实现可以在需要时生成工具调用 id，并据此重新排序工具结果。

- [CreateMessageResult](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessageresult)

  ```typescript
  /*
    之前：

    interface CreateMessageResult {
      _meta?: { [key: string]: unknown };
      content: TextContent | ImageContent | AudioContent;
      role: Role;
      stopReason?: string;
      [key: string]: unknown;
  }
  */
  interface CreateMessageResult {
    _meta?: { [key: string]: unknown };

    content: AssistantMessageContent | AssistantMessageContent[] // 已更新

    role: "assistant"; // 已更新

    stopReason?: “endTurn" | "stopSequence" | “toolUse" | “maxToken" | string // 已更新

    [key: string]: unknown;
  }
  ```

  - 注：
    - 向后兼容性问题：将 CreateMessageResult.content 作为内容数组或单个内容返回存在问题，因此我们建议：
      - 在 2025 年 11 月规范版本之前，`sampling/createMessage` MUST NOT 在 `CreateMessageResult.content` 中返回数组。
        - 这保证了线协议级别的向后兼容性
      - 现有使用 sampling 的代码可能会在新的 SDK 发布后发生破坏，因为它需要检查 content 以判断它是数组还是单个 block，并据此处理。
      - 这似乎是合理的(?)
    - `CreateMessageResult.stopReason` 字段当前被定义为开放的 `string`，规范只将 `endTurn` 作为示例值提及。
    - OpenAI 与 Anthropic API 的用法差异
      - 结束/停止原因
        - OpenAI 的 [ChatCompletion](https://platform.openai.com/docs/api-reference/chat/object): `finish_reason: “stop" | “length" | “tool_use”`（…？）
        - [Anthropic](https://docs.claude.com/en/api/handling-stop-reasons): `stop_reason: “end_turn" | “max_tokens" | “stop_sequence" | “tool_use" | “pause_turn" | “refusal”`

## 可能的后续事项

这些内容不在本 SEP 的范围内，但我们注意避免排除它们，因此在适当的地方给出了一些如何在本 SEP 之上或之后实现它们的示例。

### 流式支持

参见：[流式工具使用结果 #117](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/117)

这对于某些较长时间运行的用例，或者当延迟很重要时，可能会很关键，但如果 MCP 工具也支持流式处理，会更适配。

一种可能的实现方式是使用带负载的通知，并且可能创建一个新的方法 `sampling/createMessageStreamed`。这两者都应与本 SEP 正交（但我们需要为结果创建增量类型，类似推理 API 中的流式 API，例如 Claude API 和 OpenAI API）。

### 提升缓存友好性

这里需要两点：

- 引入缓存感知
  - 将隐式缓存指南表述为 SHOULD
  - 显式缓存点和 TTL 语义 [如 Claude API 中所示](https://docs.claude.com/en/docs/build-with-claude/prompt-caching)？（包括更长缓存的 beta 行为）
    - 优点：易于实现，_至少对 1 个实现者（Anthropic）_ 是这样
    - 缺点：如果对其他实现者难以实现，则不太可能获得批准。
  - 带显式键的“整个提示词”/提示前缀缓存 [如 OpenAI API 中所示](https://platform.openai.com/docs/api-reference/responses/create#responses-create-prompt_cache_key)？
    - 优点：
      - 对用户更简单（无需考虑共享前缀在哪里结束）
      - 隐式支持更新缓存（甚至可能作为子树）
    - 缺点：实现可能更困难 / 存储效率可能更低
- 引入 allowed_tools 特性，以便在不破坏上下文缓存的情况下启用/禁用工具
  - 这与本 SEP 相关，因为我们可能希望将此特性合并到 `tool_choice` 字段下，类似 OpenAI 的做法[。](https://platform.openai.com/docs/guides/function-calling)

    ```typescript
    interface ToolChoice { // 新增
      mode?: “auto” | "required";
      allowed_tools?: string[]
    }
    ```

### 允许客户端在代理循环中自行调用服务器的工具

从服务器的角度看，这样就不需要服务器自己调用工具/在后续采样调用中注入工具结果了。

MCP 服务器只需在采样请求中允许列出自己的工具，并使用一个专门的工具定义，例如：

```typescript
{
  type: "server-tool"; // 来自同一服务器的 MCP 工具。
  name: string;
}
```

优点：

- 安全，且仅限于该服务器的工具。
- 如果我们传播 mcp-session-id，就可以利用并保留任何服务器端会话上下文/缓存

### 允许客户端在代理循环中自行调用任何其他 MCP 服务器的工具

虽然这听起来与前一个方案相似（只允许同一服务器的工具），但这个选项不需要协议变更/完全可以由客户端作为其采样支持的实现细节来完成。

最终用户将允许列表中的任何其他 MCP 服务器工具用于采样请求，而无需服务器提出任何要求。客户端 UI 例如可以在采样审批流程中显示工具选择界面，默认自动启用来自同一服务器的工具。

优点：

- 从技术上讲不需要规格变更（如果有的话，只需将其提及为客户端拥有的一种自由度）
- 可能类似于 [CreateMessageRequest.params.includeContext](https://modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest) = thisServer / allServers 原本可能想表达的语义
  - `CreateMessageRequest.params.allowImplicitToolCalls = “none” | “thisServer” | “allServers”`
    （假设我们希望让服务器对此拥有任何控制权）

缺点：

- 可能需要分类器来避免高风险的隐私泄露/滥用
  - 如果用户错误地批准了 Gmail MCP 工具的使用/委派，服务器就会通过采样获取他们的私人电子邮件访问权限

### 允许服务器列出并调用客户端的工具（客户端/服务器 → p2p）

如果我们说客户端现在可以暴露服务器可调用的工具，那么这将开启一系列可能性：

- 客户端可以“转发”其他服务器的工具（也许带一些命名空间，以便无缝聚合）
  - 然后服务器可以将这些工具作为其工具循环的一部分来调用。
- 客户端与服务器的语义开始失去分量，我们进入一种更偏向点对点、对称的关系
  - 既然如此，客户端也可以向服务器请求采样
  - 协议层面是对称的，但传输层面仍然具有方向性（例如对于 HTTP 传输，POST 请求的方向仍然很重要）

### 简化结构化输出用例

采样的一个主要用例是获取符合给定模式的输出。

例如，这在 [OpenAI 的 API](https://platform.openai.com/docs/guides/structured-outputs) 中是可行的。

最常见的变通方法是提供单个工具并设置 `tool_choice: "required"`，这样可以保证输出是一个 ToolCall，其中包含符合该工具输入模式的输入。

虽然本 SEP 提议我们启用这种基于 `"required"` 的变通方法，但作为后续事项，若能提供更明确/更简单的 JSON schema 支持会更好，这也将允许使用工具输入中不允许的 schema 类型（工具输入要求是带 properties 的 object，因此至少得为输出选定一个名称，这就需要在提示策略上进行思考/权衡）：

```typescript
interface CreateMessageRequest {
  method: “sampling/createMessage”;
  params: {
    messages: SamplingMessage[];
    ...
    format: {
      type: "json_schema",
      "schema": {
        "type": "array",
        "minItems": 5,
        "maxItems": 100
      }
    }
  }
```
