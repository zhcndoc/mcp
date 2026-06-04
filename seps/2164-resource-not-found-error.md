# SEP-2164：标准化资源未找到错误码

- **状态**: Final
- **类型**: Standards Track
- **创建时间**: 2026-01-28
- **作者**: Peter Alexander (@pja-ant)
- **赞助方**: 无（正在寻求赞助方）
- **PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2164

## 摘要

当前 MCP 规范[建议使用 `-32002`](https://modelcontextprotocol.io/specification/draft/server/resources#error-handling)作为资源未找到的错误码。然而，`-32002` 位于 JSON-RPC 的“服务器错误”范围（`-32000` 到 `-32099`）内，这一范围保留给实现定义的错误，而不是协议层语义。此外，SDK 实现并不一致——6 个官方 SDK 中只有 4 个使用 `-32002`，而 TypeScript SDK 使用 `-32602`，Python SDK 使用 `0`。

本 SEP 将 `-32602`（无效参数）标准化为此场景下正确的 JSON-RPC 错误码，并使规范与 JSON-RPC 标准保持一致。

## 动机

当前 SDK 实现中，对资源未找到的错误处理各不相同：

| SDK        | 当前错误码                           | 来源                                                                                                                                                                                    |
| ---------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript | `-32602` (无效参数)                  | [mcp.ts#L561](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/server/src/server/mcp.ts#L561)                                                                    |
| Python     | `0`（通用）                          | [server.py#L790](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/server/lowlevel/server.py#L790)                                                                     |
| C#         | `-32002`（自定义 RESOURCE_NOT_FOUND） | [McpServerImpl.cs#L289](https://github.com/modelcontextprotocol/csharp-sdk/blob/main/src/ModelContextProtocol.Core/Server/McpServerImpl.cs#L289)                                          |
| Rust       | `-32002`（自定义 RESOURCE_NOT_FOUND） | [model.rs#L450](https://github.com/modelcontextprotocol/rust-sdk/blob/main/crates/rmcp/src/model.rs#L450)                                                                                 |
| Java       | `-32002`（自定义 RESOURCE_NOT_FOUND） | [McpAsyncServer.java#L732](https://github.com/modelcontextprotocol/java-sdk/blob/main/mcp-core/src/main/java/io/modelcontextprotocol/server/McpAsyncServer.java#L732)                     |
| Go         | `-32002`（自定义 RESOURCE_NOT_FOUND） | [server.go#L786](https://github.com/modelcontextprotocol/go-sdk/blob/main/mcp/server.go#L786)                                                                                             |
| Kotlin     | `-32603`（内部错误）                 | [Server.kt#L618-L621](https://github.com/modelcontextprotocol/kotlin-sdk/blob/main/kotlin-sdk-server/src/commonMain/kotlin/io/modelcontextprotocol/kotlin/sdk/server/Server.kt#L618-L621) |
| PHP        | `-32002`（自定义 RESOURCE_NOT_FOUND） | [Error.php#L37](https://github.com/modelcontextprotocol/php-sdk/blob/main/src/Schema/JsonRpc/Error.php#L37)                                                                               |
| Ruby       | 不适用（留给实现者）                 | [server.rb#L375-L379](https://github.com/modelcontextprotocol/ruby-sdk/blob/main/lib/mcp/server.rb#L375-L379)                                                                             |
| Swift      | 不适用（无内置处理程序）             | 不适用                                                                                                                                                                                       |

这种不一致意味着客户端无法在不同实现之间可靠地检测资源未找到的情况。在 8 个带有内置资源处理的 SDK 中，使用了四种不同的错误码：`-32002`（C#、Rust、Java、Go、PHP）、`-32602`（TypeScript）、`-32603`（Kotlin）和 `0`（Python）。Ruby 和 Swift 将错误处理留给服务器实现者。需要区分“资源未找到”和其他错误的客户端必须处理所有变体。

## 规范

如果请求的资源不存在，服务器 MUST 返回一个代码为 `-32602`（无效参数）的 JSON-RPC 错误：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Resource not found",
    "data": {
      "uri": "file:///nonexistent.txt"
    }
  }
}
```

`data` 字段 SHOULD 包含未找到的 `uri`。

对于不存在的资源，服务器 MUST NOT 返回空的 `contents` 数组。空数组具有歧义——它可能表示资源存在但没有内容，也可能表示资源根本不存在。

## 原因说明

### 为什么选择 `-32602`（无效参数）？

`-32602` 是 JSON-RPC 中表示无效参数的标准错误码。一个不存在的 URI 在语义上就是无效参数——客户端提供了一个并不对应任何资源的 URI。这与 TypeScript SDK 现有行为一致，并避免在 JSON-RPC 保留范围之外引入自定义错误码。

### 为什么不使用自定义错误码？

一些 SDK 使用 `-32002`（RESOURCE_NOT_FOUND），但是：

- 根据 JSON-RPC 规范，`-32000` 到 `-32099` 范围内的自定义码是“保留给实现定义的服务器错误”，而不是协议层语义
- 添加协议定义的自定义错误码需要更新所有客户端以识别它
- `-32602` 已经具有正确含义，并且被 JSON-RPC 库普遍理解

## 向后兼容性

这会改变规范内容——当前规范建议使用 `-32002`，而本 SEP 将其改为 `-32602`。不过，由于当前建议在各个 SDK 中并未被一致遵循（只有 5 个中的 10 个使用 `-32002`），客户端今天无法依赖任何单一错误码。这意味着对客户端的实际影响很小——任何足够健壮、能够跨现有 SDK 工作的客户端，已经会处理多个错误码或将所有错误统一泛化处理。

### 迁移路径

1. SDK 应将资源未找到的错误码更新为 `-32602`
2. 在过渡期间，客户端 SHOULD 将 `-32602` 和 `-32002` 都视为资源未找到
3. 规范应将 `-32602` 记录为规范错误码

## 安全影响

无。此更改只影响错误码值，不影响访问控制或数据暴露。
