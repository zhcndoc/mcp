# SEP-2577: 废弃 Roots、Sampling 和 Logging

- **状态**: Final
- **类型**: Standards Track
- **创建时间**: 2026-04-14
- **作者**: Kurtis Van Gent (@kurtisvg)
- **赞助人**: @kurtisvg
- **PR**: #2577

> **注意**: 本 SEP 基于一个假设性的 SEP，即 MCP 认为某个
> 规范版本在其原始发布日期之后的一年内仍受支持。
> 此处描述的废弃时间线假定该政策已生效。

## 摘要

本 SEP 将废弃以下核心协议功能：

- **Roots**（`roots/list`、`notifications/roots/list_changed`）
- **Sampling**（`sampling/createMessage`，
  `ClientCapabilities.tasks.requests.sampling`）
- **Logging**（`logging/setLevel`、`notifications/message`）

这些功能自包含本 SEP 的规范版本开始被废弃（预计为 2026 年 6 月）。在该版本发布后的一年内发布的所有规范版本中，它们仍将完全可用。

在假定单独提出的某个 SEP 所建议的“每个版本支持一年”政策生效的前提下，后续每个版本也会在其自身发布后继续支持这些功能一年。这为实现提供了更长的迁移窗口，然后这些功能才会被完全移除。

在废弃期间，线级协议行为保持不变。不会移除任何类型，不会更改能力协商，也不会破坏现有实现。废弃的作用是向生态系统发出信号，停止基于这些功能进行构建，并为其最终移除做准备。

## 动机

MCP 规范旨在保持最小化并聚焦。那些采用率低、与现有替代方案重叠，或相对于其价值而言给实现带来过多负担的功能，都是移除的候选项。将此类功能保留在核心规范中，会增加每个客户端和服务器的负担，减缓协议演进，并使规范更难学习。以下三个功能符合这些标准。

在最近一次核心贡献者会议上，曾提出废弃这些功能的建议。本 SEP 将该提议形式化为一个具体的实施计划。参见 [discussion #2536][discussion-2536]。

### Roots

Roots 提供关于服务器应操作哪些目录或文件的“信息性指导”。实际上：

- **采用率低**：很少有客户端实现 roots 支持，也很少有服务器依赖它。[功能支持矩阵][feature-matrix] 显示客户端覆盖范围有限。
- **语义模糊**：规范将 roots 描述为信息性内容——服务器不要求遵守它们，这降低了其实用性。
- **有重叠的替代方案**：工作目录上下文可以通过工具参数、资源 URI、服务器配置或环境变量提供——这些方式都更明确。

### Sampling

Sampling 允许服务器向客户端请求 LLM 补全。虽然概念上很强大，但其采用一直不理想：

- **实现复杂**：正确实现 sampling 需要人工参与审批、模型选择逻辑、安全性考虑，以及（自 SEP-1577 起）工具循环支持。这种复杂性促成了客户端采用率低。
- **采用率低**：尽管该功能自 2024 年 11 月的规范起就已可用，但 [功能支持矩阵][feature-matrix] 显示只有少数客户端支持 sampling。
- **直接替代方案**：需要 LLM 能力的服务器可以直接集成 LLM 提供方 API，从而完全控制模型选择、参数和流式传输。

### Logging

Logging 允许服务器通过协议向客户端发送结构化日志消息：

- **基础设施重叠**：标准日志机制（stdio 传输使用 stderr、结构化可观测性使用 OpenTelemetry）已经成熟、被广泛采用，并且比应用协议通道更适合用于日志。
- **相对复杂度而言价值较低**：在核心规范中增加日志消息类型、严重级别以及 `logging/setLevel` 请求，会增加所有客户端和服务器需要实现的范围。

[discussion-2536]: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2536
[feature-matrix]: https://modelcontextprotocol.io/clients#feature-support-matrix

## 规范

### 变更概览

1. 在 schema 中使用 `@deprecated` 注解标记废弃功能
2. 在功能文档页面顶部添加废弃通知
3. 在废弃期间不进行线级协议变更

### Schema 变更

在 `schema/draft/schema.ts` 中为以下项目添加 `@deprecated` JSDoc 注解。不会移除任何类型、接口或联合成员。

#### 已废弃的能力

| 能力                                      | 位置                                   |
| ----------------------------------------- | -------------------------------------- |
| `ClientCapabilities.roots`                | 用于列出 roots 的客户端能力            |
| `ClientCapabilities.sampling`             | 用于 LLM sampling 的客户端能力         |
| `ClientCapabilities.tasks.requests.sampling` | 任务增强的 sampling 子能力          |
| `ServerCapabilities.logging`              | 用于日志消息的服务端能力               |

#### 已废弃的类型 — Roots

| 类型                          | 描述                                   |
| ----------------------------- | -------------------------------------- |
| `Root`                        | 表示一个根目录或文件                    |
| `ListRootsRequest`            | 从服务器到客户端的 `roots/list` 请求   |
| `ListRootsResult`             | 包含 roots 数组的结果                   |
| `ListRootsResultResponse`     | JSON-RPC 响应包装器                    |
| `RootsListChangedNotification` | roots 变更时的客户端通知               |

#### 已废弃的类型 — Sampling

| 类型                         | 描述                                      |
| ---------------------------- | ----------------------------------------- |
| `CreateMessageRequestParams`  | `sampling/createMessage` 的参数          |
| `CreateMessageRequest`        | 从服务器到客户端的 sampling 请求         |
| `CreateMessageResult`         | sampling 请求的结果                      |
| `CreateMessageResultResponse` | JSON-RPC 响应包装器                      |
| `SamplingMessage`             | sampling 对话中的一条消息               |
| `SamplingMessageContentBlock` | sampling 消息的内容块联合类型           |
| `ToolChoice`                  | 控制 sampling 期间模型工具选择           |
| `ToolUseContent`              | sampling 消息中的工具使用内容块         |
| `ToolResultContent`           | sampling 消息中的工具结果内容块         |
| `ModelPreferences`            | 服务端的模型选择偏好                     |
| `ModelHint`                   | 模型选择提示                             |

#### 已废弃的类型 — Logging

| 类型                               | 描述                             |
| ---------------------------------- | -------------------------------- |
| `LoggingLevel`                     | Syslog 严重级别枚举              |
| `SetLevelRequestParams`            | `logging/setLevel` 的参数        |
| `SetLevelRequest`                  | 从客户端到服务端的设置级别请求   |
| `SetLevelResultResponse`           | JSON-RPC 响应包装器              |
| `LoggingMessageNotificationParams` | 日志消息通知的参数               |
| `LoggingMessageNotification`       | 从服务端到客户端的日志消息       |

#### 注解格式

每个已废弃项都 SHOULD 获得一个带简要说明的 JSDoc `@deprecated` 标签：

```typescript
/**
 * 当客户端支持列出 roots 时存在。
 *
 * @deprecated 自本规范版本起已废弃。将在一年内发布的所有版本中保留，
 * 之后可能被移除。
 */
roots?: {
  listChanged?: boolean;
};
```

#### 联合类型

以下联合类型引用了已废弃类型，但在废弃期间 MUST NOT 被修改。待已废弃类型移除时，它们将会更新：

- `ClientNotification`（包含 `RootsListChangedNotification`）
- `ClientResult`（包含 `CreateMessageResult`、`ListRootsResult`）
- `ServerRequest`（包含 `CreateMessageRequest`、`ListRootsRequest`）
- `ServerNotification`（包含 `LoggingMessageNotification`）

### 文档变更

在每个功能文档页面标题之后、页面顶部添加废弃警告块：

**`docs/specification/draft/client/roots.mdx`:**

```mdx
<Warning>
**已废弃**: Roots 功能自本规范版本起已废弃。它将在 `<YYYY-MM-DD>` 发布后一年内发布的所有规范版本中保持完全可用。之后的每个版本还将继续在其自身发布后支持它一年。
</Warning>
```

**`docs/specification/draft/client/sampling.mdx`:**

```mdx
<Warning>
**已废弃**: Sampling 功能自本规范版本起已废弃。它将在 `<YYYY-MM-DD>` 发布后一年内发布的所有规范版本中保持完全可用。之后的每个版本还将继续在其自身发布后支持它一年。
</Warning>
```

**`docs/specification/draft/server/utilities/logging.mdx`:**

```mdx
<Warning>
**已废弃**: Logging 功能自本规范版本起已废弃。它将在 `<YYYY-MM-DD>` 发布后一年内发布的所有规范版本中保持完全可用。之后的每个版本还将继续在其自身发布后支持它一年。
</Warning>
```

### 能力协商

在废弃期间，能力协商 **保持不变**：

- 支持已废弃功能的客户端和服务器 SHOULD 继续声明相应的能力。
- 遇到已废弃能力的实现 MUST 仍然正确处理它们。
- 实现 SHOULD 在协商到已废弃能力时发出警告（例如在日志或开发者工具中）。
- 新实现 SHOULD NOT 添加对已废弃功能的支持，除非为与现有对端保持向后兼容所必需。

### 时间线

- **已废弃**：在下一个规范版本中（目前计划为 2026 年 6 月）。
- **包含于后续发布**：在该版本发布后一年内发布的所有规范版本 MUST 继续将这些功能作为已废弃内容包含在内。
- **按版本支持**：每个包含这些功能的版本都会在其发布后继续支持它们一年，符合单独 SEP 所提议的“每个版本支持一年”政策。
- **移除**：在该版本发布一年后发布的规范版本 MAY 完全移除这些功能。

## 原因说明

### 为什么弃用而不是迁移到扩展？

这些功能已经在许多客户端和服务器中实现。扩展机制（SEP-2133）规定，除非提供了某个扩展，否则实现必须表现得像该扩展不存在一样。将这种逻辑改造到现有 SDK 中——尤其是跨多个协议版本——会很复杂且容易出错。先弃用再移除的方式影响更小：在过渡期内，实现可以继续按原样使用这些功能，然后在功能被移除后直接停止使用。

### 为什么弃用而不是立即移除？

虽然这些功能的采用率很低，但仍然有人在使用。立即移除会给用户、客户端和服务器所有者以及 SDK 构建者带来不必要的变动和干扰。弃用窗口通过给生态系统足够时间按自己的节奏迁移，来尽量减少这种影响。

### 为什么特别是这三个功能？

这是在一次核心贡献者会议中被识别出的、采用率与复杂度比最弱的功能。每个功能在协议之外都有可行的替代方案，而且它们都不是定义 MCP 的核心资源/工具/提示交互模型所必需的。参见 [讨论 #2536][discussion-2536]。

## 向后兼容性

在弃用期间，**不存在向后兼容性问题**。所有被弃用的功能都会继续以相同方式工作。不会引入任何传输层级别的更改。

移除之后（在比该版本晚一年以上发布的规范版本中）：

- 与包含这些功能的较旧协议版本协商的实现，仍然可以通过该版本的 schema 访问这些功能。
- 与已移除这些功能的版本协商的实现，将不再能够访问这些功能。

## 安全影响

弃用这些功能对安全性有**净正面**影响：

- **Sampling** 是这三者中最敏感的安全功能。它允许服务器通过客户端请求 LLM 补全，这会为提示注入和数据外泄创造攻击面。移除它可以降低这一风险。
- **Roots** 会向服务器暴露客户端文件系统的信息。移除它可以降低服务器利用根信息尝试目录遍历或访问预期边界之外文件的风险。
- **Logging** 的安全影响很小，但移除它可以简化协议表面。

弃用不会引入新的安全问题。

## 参考实现

不需要参考实现。此 SEP 只是将现有功能标记为已弃用——不引入任何新的协议行为。
