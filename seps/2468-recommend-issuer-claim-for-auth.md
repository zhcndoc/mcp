# SEP-2468: 推荐在 MCP 认证响应中使用颁发者（iss）参数

- **状态**：审阅中
- **类型**：标准跟踪
- **创建时间**：2026-03-25
- **作者**：Emily Lauber (@EmLauber)
- **赞助人**：@pcarleton
- **PR**：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2468

## 摘要

本 SEP 建议在 Model Context Protocol（MCP）授权响应中包含一个显式的颁发者（iss）参数，并要求对其进行验证，以缓解授权混淆攻击。通过将授权响应绑定到特定的授权服务器身份，MCP 客户端可以可靠地检测并拒绝来自意外颁发者的响应，从而提高协议在多身份提供方（IdP）环境中的健壮性。本 SEP 遵循 [RFC9207](https://datatracker.ietf.org/doc/rfc9207/) 中定义的规范。

## 动机

Model Context Protocol 越来越多地运行在多个授权服务器、身份提供方和中介共存的环境中。在这种环境下，OAuth 混淆攻击成为一种现实威胁。混淆攻击是指攻击者诱使客户端将授权响应关联到错误的授权服务器，从而可能导致令牌泄露或权限提升。

OAuth 规范描述了两种缓解混淆攻击的方法：要求使用颁发者（_iss_）参数，或为客户端交互的每个颁发者使用唯一的 redirect_uri。对于客户端 ID 元数据文档（推荐的注册方式）而言，为每个颁发者使用唯一的 redirect_uri 是不可行的；而对于动态客户端注册（Dynamic Client Registration）来说，运维成本很高。因此，MCP 环境的建议是采用颁发者缓解方案。

在 MCP 授权响应中要求显式的 iss 参数，提供了一种简单、可互操作且广为理解的机制，可以将响应绑定到正确的授权服务器，并从设计上防止混淆攻击。不过，并非每个授权服务器都会发送颁发者参数，因此本 SEP 提议：如果提供了 issuer，则客户端必须验证它；对于支持 MCP 场景的授权服务器，则应当支持该参数。未来的 SEP 和版本可能会将 SHOULD 改为 MUST。

## 规范

### 颁发者参数要求

MCP 授权服务器 SHOULD 在授权响应中包含一个颁发者（_iss_）参数，包括错误响应，如 [RFC9207](https://datatracker.ietf.org/doc/html/rfc9207#section-2) 所定义。这样做的授权服务器 MUST 通过在其授权服务器元数据中设置 `authorization_response_iss_parameter_supported: true` 来声明支持。

`iss` 参数 MUST：

- 与通过元数据发现公布的颁发者标识符完全匹配
- 是一个使用 `https` 方案、且不包含查询或片段部分的 URL（[RFC 8414 第 2 节](https://datatracker.ietf.org/doc/html/rfc8414#section-2)）

### 客户端验证要求

MCP 客户端 MUST 通过以下方式验证授权响应中的 _iss_ 参数：

- 确定该授权请求所期望的颁发者
- 将接收到的 _iss_ 值与期望的颁发者进行比较
- 如果两者不完全匹配，则拒绝该授权响应

如果颁发者验证失败，客户端 **MUST** 将该响应视为无效并中止授权流程。

## 理由

iss 值已经在 OpenID Connect 和基于 JWT 的令牌验证中使用。将其扩展到 MCP 授权响应中：

- 利用现有生态系统中的知识和工具
- 避免引入 MCP 专用的安全机制
- 为部署提供清晰且可审计的安全性

### 考虑过的替代方案

引入 MCP 专用的颁发者绑定字段

- 因为重用已建立的 OAuth/OIDC 机制更合适，所以被否决。

要求每个颁发者使用唯一的 redirect_uri

- CIMD 元数据文档是静态的，无法枚举每个颁发者；使用 DCR 在技术上是可行的，但 DCR 在 MCP 部署中存在运维缺点，因此不适合依赖它来实现安全属性。RFC 9207 可在各种注册方式下统一工作。

当服务器未声明支持时丢弃 `iss`（严格遵循 RFC 9207 §2.4 的 SHOULD）

- RFC 9207 §2.4 建议：对于未设置 `authorization_response_iss_parameter_supported` 的服务器，客户端 SHOULD 丢弃携带 `iss` 的响应，但同时明确将该决定留给本地策略（“具体指导不在范围内”）。本 SEP 则改为进行比较。记录的颁发者始终来自客户端已根据 RFC 8414 §3.3 验证过的元数据文档，因此出现的 `iss` 可以与一个可信基线进行检查；只要不匹配就仍然无条件拒绝，因此唯一的行为差异是接受一个其 `iss` 与该基线匹配的响应——这并不构成放宽。实际上，授权服务器常常会在元数据更新之前就开始发出 `iss`，而在该窗口期内丢弃响应会在没有安全收益的情况下拒绝合法流程。

## 向后兼容性

`iss` 参数在协议线上是增量添加的。对于那些授权服务器已声明 `authorization_response_iss_parameter_supported: true`，但其回调处理尚未将 `iss` 传递给 SDK 的主机，客户端验证会引入行为变化；在主机从重定向 URI 中与 `code` 一起提取 `iss` 之前，这些流程将被拒绝。SDK 预计会以增量方式扩展回调签名（例如增加一个可选的 `iss` 参数），以便现有调用点继续通过编译。不声明支持的授权服务器不受影响。随附的 RFC 8414 第 3.3 节元数据验证要求重述了一个已有的 RFC MUST；尚未强制执行该要求的客户端在升级后可能会暴露出潜在的颁发者配置错误。

## 安全影响

本提案是对混淆攻击的缓解措施；该机制本身的安全考虑已记录在 [RFC9207 第 4 节](https://datatracker.ietf.org/doc/html/rfc9207#section-4) 中。尤其是，该缓解措施依赖于客户端在重定向之前先确定期望的颁发者，并且比较必须是精确的简单字符串比较。另见 MCP [安全最佳实践](/docs/tutorials/security/security_best_practices)。

## 参考实现

- Go SDK: [modelcontextprotocol/go-sdk#859](https://github.com/modelcontextprotocol/go-sdk/pull/859)
- TypeScript SDK: [modelcontextprotocol/typescript-sdk#1957](https://github.com/modelcontextprotocol/typescript-sdk/pull/1957)

两者都会在重定向之前记录期望的颁发者，并比较接收到的任何 `iss`；仅当服务器声明支持时，才会在缺失时拒绝。

---

### 致谢

感谢 Sam Morrow、Max Gerber、Aaron Parecki、Stephen Halter、Nate Barbettini、Karl McGuinness 和 Den Delimarsky 在 Auth Mix-Up Attack Prevention 工作组中的审阅与讨论。
