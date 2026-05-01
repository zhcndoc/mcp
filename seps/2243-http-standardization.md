# SEP-2243: 用于可流式 HTTP 传输的 HTTP Header 标准化

<!-- cspell:ignore streamable -->
<!-- markdownlint-disable MD036 MD060 -->

- **状态**: Final
- **类型**: Standards Track
- **创建时间**: 2026-02-04
- **作者**: MCP Transports Working Group
- **赞助方**: None
- **PR**: https://github.com/modelcontextprotocol/specification/pull/2243

## 摘要

本 SEP 提议将关键路由和上下文信息暴露在可流式 HTTP 传输的标准 HTTP header 位置中。通过将 JSON-RPC 负载中的关键字段映射到 HTTP header，负载均衡器、代理和可观测性工具等网络中间件可以在无需深度包检测的情况下对 MCP 流量进行路由和处理，从而降低延迟和计算开销。

## 动机

当前通过 HTTP 实现的 MCP 会将所有路由信息隐藏在 JSON-RPC 负载中。这给网络基础设施带来了摩擦：

- **负载均衡器** 必须终止 TLS 并解析整个 JSON 正文，以提取路由信息（例如，区域、工具名称）
- **代理和网关** 无法在不进行深度包检测的情况下做出路由决策
- **可观测性工具** 对 MCP 流量模式的可见性有限
- **限流器和 WAF** 无法基于 MCP 特定字段应用策略

通过在 HTTP header 中暴露关键字段，我们使标准网络基础设施能够使用现有且成熟的机制来处理 MCP 流量。

## 规范

### 标准 Header

可流式 HTTP 传输将要求 POST 请求包含以下从请求体镜像而来的 header：

| Header 名称   | 来源字段                     | 适用范围                                               |
| ------------ | ----------------------------- | ------------------------------------------------------ |
| `Mcp-Method` | `method`                      | 所有请求和通知                                         |
| `Mcp-Name`   | `params.name` 或 `params.uri` | `tools/call`、`resources/read`、`prompts/get` 请求 |

这些 header 在引入它们的 MCP 版本中是**必需**的，以满足兼容性要求。

**服务器行为**：处理请求体的服务器 MUST 拒绝 header 中指定的值与请求体中的值不匹配的请求。

> **理由**：此要求可防止当网络中的不同组件依赖不同事实来源时可能出现的安全漏洞和错误条件。例如，负载均衡器或网关可能使用 header 值做路由决策，而 MCP 服务器使用正文值执行操作。此要求适用于任何处理消息体的网络中间件，以及 MCP 服务器本身。

**大小写敏感性**：Header 名称（在 [RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110#name-field-names) 中称为“field names”）不区分大小写。客户端和服务器 MUST 对 header 名称使用不区分大小写的比较。

#### 示例：tools/call 请求

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: tools/call
Mcp-Name: get_weather

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": {
      "location": "Seattle, WA"
    }
  }
}
```

#### 示例：resources/read 请求

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: resources/read
Mcp-Name: file:///projects/myapp/config.json

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "file:///projects/myapp/config.json"
  }
}
```

#### 示例：prompts/get 请求

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: prompts/get
Mcp-Name: code_review

{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": {
      "language": "python"
    }
  }
}
```

#### 示例：其他请求方法

对于不涉及 tools、resources 或 prompts 的请求，仅需 `Mcp-Method` header：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Method: initialize

{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

#### 示例：通知

通知同样需要 `Mcp-Method` header：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: notifications/initialized

{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### 来自工具参数的自定义 Header

MCP 服务器 MAY 在工具的 `inputSchema` 中通过参数 schema 内的 `x-mcp-header` 扩展属性，指定某些工具参数映射到 HTTP header。

**客户端要求**：虽然服务器使用 `x-mcp-header` 是可选的，但客户端 MUST 支持此特性。当服务器的工具定义包含 `x-mcp-header` 注解时，符合规范的客户端 MUST 按本文档所述，将指定的参数值映射到 HTTP header 中。

#### Schema 扩展

`x-mcp-header` 属性指定用于构造 header 名称 `Mcp-Param-{name}` 的名称部分。

**`x-mcp-header` 值的约束**：

- MUST NOT 为空
- MUST 仅包含 ASCII 字符（不包括空格和 `:`）
- 在 `inputSchema` 中所有 `x-mcp-header` 值之间 MUST 以不区分大小写的方式唯一
- MUST 仅应用于原始类型参数（number、string、boolean）

客户端 MUST 拒绝任何 `x-mcp-header` 值违反这些约束的工具定义。拒绝意味着客户端 MUST 将无效工具从 `tools/list` 的结果中排除。客户端 SHOULD 在拒绝工具定义时记录警告，包括工具名称和拒绝原因。此行为可确保单个格式错误的工具定义不会阻止其他有效工具被使用。

**工具定义示例**：

```json
{
  "name": "execute_sql",
  "description": "在 Google Cloud Spanner 上执行 SQL",
  "inputSchema": {
    "type": "object",
    "properties": {
      "region": {
        "type": "string",
        "description": "执行查询的区域",
        "x-mcp-header": "Region"
      },
      "query": {
        "type": "string",
        "description": "要执行的 SQL 查询"
      }
    },
    "required": ["region", "query"]
  }
}
```

#### 示例：地理分布式数据库

考虑一个向 Google Cloud Spanner 暴露 `execute_sql` 工具的服务器，它需要一个 `region` 参数。

**工具定义**：

```json
{
  "name": "execute_sql",
  "description": "在 Google Cloud Spanner 上执行 SQL",
  "inputSchema": {
    "type": "object",
    "properties": {
      "region": {
        "type": "string",
        "description": "执行查询的区域",
        "x-mcp-header": "Region"
      },
      "query": {
        "type": "string",
        "description": "要执行的 SQL 查询"
      }
    },
    "required": ["region", "query"]
  }
}
```

**场景**：客户端请求在 `us-west1` 中执行 SQL。

**当前摩擦**：全局负载均衡器接收到请求，但必须终止 TLS 并解析整个 JSON 正文，才能在知道应将数据包路由到俄勒冈还是比利时集群之前找到 `"region": "us-west1"`。

**采用本提案后**：客户端检测到 `x-mcp-header` 注解，并自动将 header `Mcp-Param-Region: us-west1` 添加到 HTTP 请求中。负载均衡器现在可以基于 header 进行路由，而无需解析正文。

**请求**：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: tools/call
Mcp-Name: execute_sql
Mcp-Param-Region: us-west1

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "execute_sql",
    "arguments": {
      "region": "us-west1",
      "query": "SELECT * FROM users"
    }
  }
}
```

#### 示例：多租户 SaaS 应用

一个 SaaS 平台暴露面向不同客户租户操作的工具。通过在 header 中暴露租户 ID，平台可以将请求路由到租户专属基础设施。

**工具定义**：

```json
{
  "name": "query_analytics",
  "description": "查询某个租户的分析数据",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tenant_id": {
        "type": "string",
        "description": "租户标识符",
        "x-mcp-header": "TenantId"
      },
      "metric": {
        "type": "string",
        "description": "要查询的指标"
      },
      "start_date": {
        "type": "string",
        "description": "查询范围的开始日期"
      },
      "end_date": {
        "type": "string",
        "description": "查询范围的结束日期"
      }
    },
    "required": ["tenant_id", "metric", "start_date", "end_date"]
  }
}
```

**请求**：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: tools/call
Mcp-Name: query_analytics
Mcp-Param-TenantId: acme-corp

{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "query_analytics",
    "arguments": {
      "tenant_id": "acme-corp",
      "metric": "page_views",
      "start_date": "2026-01-01",
      "end_date": "2026-01-31"
    }
  }
}
```

#### 示例：基于优先级的请求处理

服务器可以暴露优先级参数，以便基础设施对某些请求进行优先处理。

**工具定义**：

```json
{
  "name": "generate_report",
  "description": "生成复杂报告",
  "inputSchema": {
    "type": "object",
    "properties": {
      "report_type": {
        "type": "string",
        "description": "要生成的报告类型"
      },
      "priority": {
        "type": "string",
        "description": "请求优先级：低、普通或高",
        "x-mcp-header": "Priority"
      }
    },
    "required": ["report_type"]
  }
}
```

**请求**：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Mcp-Session-Id: 1f3a4b5c-6d7e-8f9a-0b1c-2d3e4f5a6b7c
Mcp-Method: tools/call
Mcp-Name: generate_report
Mcp-Param-Priority: high

{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {
      "report_type": "quarterly_summary",
      "priority": "high"
    }
  }
}
```

### Header 处理

#### 值编码

客户端 MUST 在将参数值包含到 HTTP header 之前对其进行编码，以确保安全传输并防止注入攻击。

**字符限制**

根据 [RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110#name-field-values)，HTTP header 字段值必须由可见 ASCII 字符（0x21-0x7E）、空格（0x20）以及水平制表符（0x09）组成。以下字符被明确禁止：

- 回车符 (`\r`, 0x0D)
- 换行符 (`\n`, 0x0A)
- 空字符 (`\0`, 0x00)
- ASCII 范围之外的任何字符（> 0x7F）

**空白处理**

HTTP 解析器通常会去除 header 值前后两端的空白。为了保留参数值中的前导和尾随空格，客户端 MUST 在值满足以下条件时使用 Base64 编码：

- 以空格（0x20）或水平制表符（0x09）开头
- 以空格（0x20）或水平制表符（0x09）结尾

**编码规则**

客户端 MUST 按以下顺序应用编码规则：

1. **类型转换**：将参数值转换为字符串表示形式：
   - `string`：按原样使用该值
   - `number`：转换为十进制字符串表示形式（例如 `42`、`3.14`）
   - `boolean`：转换为小写 `"true"` 或 `"false"`

2. **空白检查**：如果字符串以空白字符（空格或制表符）开头或结尾：
   - 应用 Base64 编码（见下文）

3. **ASCII 验证**：检查字符串是否仅包含有效 ASCII 字符（0x20-0x7E）：
   - 如果有效，继续执行第 4 步
   - 如果无效（包含非 ASCII 字符），应用 Base64 编码（见下文）

4. **控制字符检查**：如果字符串包含任何控制字符（0x00-0x1F 或 0x7F）：
   - 应用 Base64 编码（见下文）

**对不安全值进行 Base64 编码**

当某个值无法安全地表示为普通 ASCII header 值时，客户端 MUST 使用该值的 UTF-8 表示形式进行 Base64 编码，并采用以下格式：

```text
Mcp-Param-{Name}: =?base64?{Base64EncodedValue}?=
```

前缀 `=?base64?` 和后缀 `?=` 表示该值已进行 Base64 编码。需要检查这些值的服务器和中间件 MUST 相应地对其解码。

**示例**：

| 原始值           | 原因                   | 编码后的 Header 值                                     |
| ---------------- | ---------------------- | ------------------------------------------------------ |
| `"us-west1"`     | 纯 ASCII               | `Mcp-Param-Region: us-west1`                          |
| `"Hello, 世界"`  | 包含非 ASCII 字符      | `Mcp-Param-Greeting: =?base64?SGVsbG8sIOS4lueVjA==?=` |
| `" padded "`     | 前导/尾随空格          | `Mcp-Param-Text: =?base64?IHBhZGRlZCA=?=`             |
| `"line1\nline2"` | 包含换行符             | `Mcp-Param-Text: =?base64?bGluZTEKbGluZTI=?=`         |

#### 客户端行为

当通过 HTTP 传输构造 `tools/call` 请求时，客户端 MUST：

1. 从请求体中提取任何标准 header 的值（例如 `method`、`params.name`、`params.uri`）
1. 将 `Mcp-Method` header 添加到请求中，并在适用时添加 `Mcp-Name` header
1. 检查工具的 `inputSchema` 中是否存在带有 `x-mcp-header` 标记的属性，并提取每个参数的值
1. 按照 [值编码](#value-encoding) 中的规则对值进行编码
1. 向请求中添加 `Mcp-Param-{Name}: {Value}` header：

#### 服务器行为

接收请求时，服务器 MUST 拒绝包含无效字符的 `Mcp-Param-{Name}` header 的请求（见 [值编码](#value-encoding) 部分中的“字符限制”）。

任何处理消息体（而不仅仅是转发）的服务器 MUST 验证：如果 header 值经过 Base64 编码，则在解码后与请求体中的相应值匹配。若任何验证失败，服务器 MUST 以 `400 Bad Request` HTTP 状态拒绝请求。

**错误码**

当因 header 验证失败而拒绝请求时，服务器 MUST 返回带有以下错误码的 JSON-RPC 错误响应：

| Code     | Name             | Description                                                                                                            |
| -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `-32001` | `HeaderMismatch` | HTTP headers 与请求体中相应的值不匹配，或者必需的 header 缺失/格式错误。 |

该错误码位于 JSON-RPC 实现定义的服务器错误范围（`-32000` 到 `-32099`）内。

**错误响应格式**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Header mismatch: Mcp-Name header value 'foo' does not match body value 'bar'"
  }
}
```

**验证失败条件**：

- 缺少必需的标准 header（`Mcp-Method`、`Mcp-Name` 等）
- header 值与请求体值不匹配
- Base64 编码的值无法解码
- header 值包含无效字符

> **注意**：中间件 MUST 对验证失败返回适当的 HTTP 错误状态（例如 `400 Bad Request`），但不要求返回 JSON-RPC 错误响应。

**自定义 Header 处理**：

通过 `x-mcp-header` 定义的自定义 header 采用相同的验证规则：

| 场景                                   | 客户端行为                   | 服务器行为                          |
| -------------------------------------- | ---------------------------- | ---------------------------------------- |
| 提供了参数值                          | 客户端 MUST 包含该 header     | 服务器 MUST 验证 header 与正文匹配      |
| 参数值为 `null`                       | 客户端 MUST 省略该 header     | 服务器 MUST 不期望该 header             |
| 参数不在 arguments 中                 | 客户端 MUST 省略该 header     | 服务器 MUST 不期望该 header             |
| 客户端省略 header 但正文中有该值      | 不符合规范的客户端            | 服务器 MUST 拒绝该请求                  |

当因缺少或无效的自定义 header 而拒绝请求时，服务器 MUST 返回 HTTP 状态 `400 Bad Request`，并附带 JSON-RPC 错误码 `-32001`（`HeaderMismatch`）。

## 原因

### Header 与 Path

本提案将请求数据镜像到 header 中，而不是将其编码到 URL path 中。

**Header 的优点**：

1. **简单性**：所有广泛使用的网络负载均衡器都支持基于 HTTP header 的路由
2. **多版本支持**：客户端和服务器更容易支持多个 MCP 版本
3. **兼容性**：Header 可与现有的 Streamable HTTP 传输设计配合使用，而无需更改 endpoint 结构
4. **无限制的值**：Header 值可以包含在 URL 中需要编码的字符（例如 `/`、`?`、`#`）
5. **没有 URL 长度限制**：可以传输非常长的值，而不会触及 URL 长度限制

**基于 Path 路由的优点**：

1. **框架简单性**：许多 Web 框架（Flask、Express、Django、Rails）对基于 path 的路由提供内置支持，配置最少
2. **日志记录**：URL path 通常默认会被记录，这使调试更容易

**权衡与框架考量**：

| Framework         | 基于 Header 的路由                                           | 基于 Path 的路由                         |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------- |
| Flask (Python)    | 需要中间件或装饰器在路由前提取 header | 通过 `@app.route('/mcp/<method>')` 原生支持 |
| Express (Node.js) | 可通过 `req.headers` 轻松实现，但需要自定义路由逻辑 | 通过 `app.post('/mcp/:method')` 原生支持 |
| Django (Python)   | 需要自定义中间件                                           | 原生 URL patterns                         |
| Go (net/http)     | 可通过 `r.Header.Get()` 轻松实现                             | 通过 path patterns 原生支持              |
| ASP.NET Core      | 可通过 `[FromHeader]` 属性轻松实现                           | 通过 route templates 原生支持            |

对于像 Flask 这样强烈偏好基于 path 路由的框架，实现基于 header 的路由需要额外代码：

```python
# Flask 示例：基于 Header 的路由需要手动分发
@app.route('/mcp', methods=['POST'])
def mcp_handler():
    method = request.headers.get('Mcp-Method')
    if method == 'tools/call':
        return handle_tools_call(request)
    elif method == 'resources/read':
        return handle_resources_read(request)
    # ... 等等
```

尽管在某些框架中会带来额外复杂性，但仍选择基于 header 的路由，原因如下：

1. **向后兼容性** 引入基于 path 的路由将需要所有现有 MCP Servers 进行重大更新，并且可能需要支持两套 endpoint 以兼容多个版本。即使 SDK 可以部分掩盖这些问题，测试、指标等额外运维事项仍然需要处理。基于 header 的路由只需要极少的客户端侧改动。未选择启用的客户端仍可正常工作。

2. **基础设施收益大于框架复杂度**：主要目标是使网络基础设施（负载均衡器、代理、WAF）能够在无需解析 body 的情况下路由和处理请求。这一收益与服务器使用何种框架无关。

### 基础设施支持

基于 HTTP header 的路由和处理受以下组件支持：

- **负载均衡器**：所有主要负载均衡器（HAProxy、NGINX、Cloudflare、F5、Envoy/Istio）
- **限流**：11 种流行限流方案中的 9 种
- **授权**：Kong、Tyk、AWS API Gateway、Google Cloud Apigee、Azure API Gateway、NGINX、Apache APISIX、Istio/Envoy
- **Web 应用防火墙**：Cloudflare WAF、AWS WAF、Azure WAF、F5 Advanced WAF、FortiWeb、Imperva WAF、Barracuda WAF、ModSecurity、Akamai、Wallarm
- **可观测性**：大多数可观测性方案都可以从 HTTP header 中提取数据

### x-mcp-header 中显式的 Header 名称

设计在 `x-mcp-header` 中使用显式的 name value，而不是从参数名推导 header 名称，因为：

1. **大小写敏感性不匹配**：Header 名称不区分大小写，但 JSON Schema 属性名区分大小写
2. **字符集限制**：Header 名称仅限 ASCII 字符，但工具参数名可能包含任意 Unicode
3. **简单性**：无需从嵌套属性构造 header 名称的复杂方案

### 在 JSON Schema 中的位置

`x-mcp-header` 扩展直接放置在要镜像的属性的 JSON Schema 内，而不是放在 schema 之外单独的元数据字段中。这一设计选择带来了几个优势：

1. **共置**：Header 映射与其影响的属性一起定义，使其立即清楚哪个参数会被镜像。开发者无需在 schema 与单独的元数据结构之间交叉查找。

2. **成熟模式**：JSON Schema 明确支持扩展关键字（以 `x-` 开头的属性），这一模式在 OpenAPI 等生态中被广泛使用。工具作者和 SDK 开发者已经熟悉这种方式。

3. **Schema 可组合性**：当 schema 被组合、扩展，或使用 `$ref` 引用时，`x-mcp-header` 注解会随属性定义一起传递。单独的元数据结构则需要复杂的同步逻辑来保持一致性。

4. **工具兼容性**：现有 JSON Schema 验证器默认会忽略未知关键字，因此添加 `x-mcp-header` 不会破坏现有 schema 验证。不理解此扩展的工具会直接跳过它。

5. **降低复杂度**：单独的元数据结构需要定义一种映射机制（例如 JSON Pointer 或属性路径）来将 header 与属性关联，这会增加实现复杂性并带来出错可能。

### 范围：仅限 Tools

`x-mcp-header` 机制当前仅适用于 `tools/call` 请求，因为 tools 是唯一具有支持 JSON Schema 扩展关键字的 `inputSchema` 的 MCP primitive。Resources 和 prompts 缺少等价的 schema 结构：`resources/read` 只接收一个 `uri`（已通过 `Mcp-Name` 暴露），而 `prompts/get` 将参数定义为简单的 `{name, description, required}` 数组，不具备 JSON Schema 可扩展性。将自定义 header 映射泛化到这些 primitive 需要为 resources 和 prompts 添加类似 `inputSchema` 的定义，这会引入更大的规范变更。这被视为未来可能的扩展。

### 不在规范层级定义 Header 大小限制

本规范有意不定义单个 header 值长度、MCP header 总大小或自定义 header 数量的限制。Header 纯属 HTTP 概念，而 HTTP 本身（[RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110)）并未规定 header 大小限制。常见的 HTTP 基础设施会施加自己的限制——某些服务器约为 4–8 KB（例如 Apache 约 8190 字节），而另一些可达 128 KB（例如 Cloudflare）——但合适的限制取决于部署环境，而这只有服务运营者才能确定。

定义一个规范层级的限制（例如“省略超过 8192 字节的 header”）会带来问题：

1. **任意阈值**：任何选定的数值对某些部署而言都会过低，对另一些则无关紧要。正确的限制取决于基础设施。
2. **适得其反的省略**：如果客户端因为 header 超过规范定义的限制而省略它，那么依赖该 header 进行路由的服务器和中间件就必须要么解析 body，要么拒绝请求——这会削弱将值暴露在 header 中的核心目的。
3. **不必要的 SDK 负担**：SDK 维护者需要为一个在实践中很少适用的约束实现并测试限制检查逻辑。
4. **与 HTTP 重复**：服务器和中间件已经会使用标准 HTTP 状态码拒绝过大的 header（`413 Request Entity Too Large`、`431 Request Header Fields Too Large`），客户端无论如何都必须处理这些响应。

> **给实现者的注记**：服务器、中间件和客户端 MAY 根据其部署环境，独立对单个 header 大小、MCP header 总大小或自定义 header 数量施加限制。服务器 SHOULD 记录其施加的任何限制。客户端 SHOULD 优雅地处理 `413 Request Entity Too Large` 或 `431 Request Header Fields Too Large` 响应。工具作者 SHOULD 将 `x-mcp-header` 注解限制在那些能带来明确基础设施收益的参数上。

### 不安全值的编码方式

对于无法安全表示为纯 ASCII header 值的参数值（非 ASCII 字符、前导/尾随空白字符、控制字符），考虑了四种编码方式：

1. **哨兵包装（所选方案）**：在同一个 `Mcp-Param-{Name}` header 中使用 `=?base64?{value}?=` 前缀/后缀来表示 Base64 编码的值。

2. **单独的 header 名称**：对编码值使用不同的 header 名称，例如 `Mcp-ParamEncoded-{Name}`，从而通过 header 名称而不是值格式来指示编码方式。

3. **隐式编码**：让解析器根据工具 schema 推断编码方式，例如通过工具定义中的 `"x-mcp-header-encoding": "base64"` 注解。

4. **始终编码**：无条件对每个 `Mcp-Param-{Name}` 值进行 Base64 编码。

| 方法                 | 优点                                                                                                                                     | 缺点                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 哨兵包装             | 每个参数只需一个 header 名称；常见情况（纯 ASCII）可直接人类可读；中间件可基于纯值路由而无需解码 | 带内信号理论上可能与字面值冲突；每个读取方都必须检查前缀                                                                                       |
| 单独的 header 名称 | 无带内歧义；编码方式可从 header 名称自解释                                                                  | header 命名空间翻倍；每个中间件必须为每个参数检查两个 header 名称；如果两者同时存在，需要冲突规则                                                         |
| 隐式编码             | 最简单的传输格式；无需哨兵或额外 header                                                                                      | 中间件需要访问工具 schema 才能知道是否要解码——这违背了将值暴露在 header 中的目的；按参数静态决定无法很好处理混合情况 |
| 始终编码             | 规则最简单；没有条件逻辑或歧义                                                                                        | 纯 ASCII 值会变得不可读；中间件必须先解码 Base64 才能检查任何值，这会显著削弱本 SEP 的核心动机                                       |

**结论**：哨兵包装方式提供了最佳权衡。自定义 header 的主要用例是使中间件能够对区域名称和租户 ID 这类简单、可读的值进行路由和过滤——这些值几乎总是纯 ASCII，也不会触发 Base64 编码。方案 4 会让所有值对中间件都变得不可见。方案 3 使中间件在没有工具 schema 的情况下无法区分编码值与字面值。方案 2 虽然消除了带内歧义，但会使 header 命名空间翻倍，要求中间件为每个参数检查两种可能的 header 名称，并在两者同时存在时添加冲突规则。方案 1 中哨兵的理论碰撞风险微乎其微，因为 `=?base64?...?=` 在实践中不太可能是字面参数值。

## 向后兼容性

### 标准头

在使用新的 MCP 版本时，现有客户端和 SDK 将被要求包含标准头。这只是一个小幅新增，因为客户端已经包含了诸如 `Mcp-Protocol-Version` 之类的头，每条消息只需再增加一到两个新头。

实现新版本的服务器 MUST 拒绝缺少必需头的请求。服务器 MAY 通过在协商较旧协议版本时接受不带头的请求来支持旧客户端。

### 来自工具参数的自定义头

`x-mcp-header` 扩展对于服务器来说是可选的。不包含此属性的现有工具会继续按原样工作。不过，实现了包含此规范的 MCP 版本的客户端 MUST 支持该功能。不支持 `x-mcp-header` 的旧客户端仍可运行，但不会提供服务器可能依赖的基于头的路由优势。

## 安全影响

### 头注入

当包含控制字符（尤其是 `\r\n`）的恶意值被包含在头中时，就会发生头注入攻击，这可能允许攻击者注入额外的头或过早终止头部区域。

客户端 MUST 遵循本规范中定义的 [值编码](#value-encoding) 规则。这些规则确保：

- 控制字符绝不会出现在头值中
- 非 ASCII 值会使用 Base64 安全编码
- 超出安全长度限制的值会被省略

### 头伪造

服务器 MUST 验证头值是否与请求体中的对应值一致。这可防止客户端发送不匹配的头来操纵路由，同时执行不同的操作。

例如，恶意客户端可能会尝试：

- 将请求路由到安全性较低的区域，同时执行原本针对高安全性区域的操作
- 通过伪造租户标识符绕过速率限制
- 通过歪曲正在执行的操作来规避安全策略

### 信息泄露

标记用于头的工具参数值将对网络中介（负载均衡器、代理、日志系统）可见。服务器开发者：

- SHOULD NOT 将敏感参数（密码、API 密钥、令牌、PII）标记为 `x-mcp-header`
- SHOULD 记录哪些参数会作为头暴露
- SHOULD 考虑到 Base64 编码并不提供保密性——它只是编码，不是加密

### 信任头值

头值来源于工具调用参数，而这些参数可能受到 LLM 或恶意客户端的影响。中介和服务器 MUST NOT 将这些值视为用于安全敏感决策的可信输入。特别是：

- 暗示可访问特定资源的头值（例如租户 ID、区域名称）在授予这些资源的访问权限之前，MUST 先根据已认证用户的权限进行独立验证。
- 在没有服务器端强制执行速率限制和配额的情况下，头值 MUST NOT 被用作授予提升权限的唯一依据。
- 部署 SHOULD 在流水线早期——在执行 Base64 解码或主体解析之前——拒绝带有过大或过多头的请求，以减轻由精心构造的负载带来的拒绝服务风险。

## 一致性测试用例

本节定义了一致性测试 MUST 覆盖的边界情况，以确保实现之间的互操作性。

### 标准头边界情况

#### 大小写敏感性

| 测试用例                 | 输入                     | 预期行为                                           |
| ------------------------ | ------------------------ | -------------------------------------------------- |
| 头名称大小写变化         | `mcp-method: tools/call` | 服务器 MUST 接受（头名称不区分大小写）             |
| 头名称混合大小写         | `MCP-METHOD: tools/call` | 服务器 MUST 接受                                   |
| 方法值大小写             | `Mcp-Method: TOOLS/CALL` | 服务器 MUST 拒绝（方法值区分大小写）               |

#### 头/主体不匹配

| 测试用例                 | 头值                     | 主体值                      | 预期行为                                   |
| ------------------------ | ------------------------ | --------------------------- | ------------------------------------------ |
| 方法不匹配               | `Mcp-Method: tools/call` | `"method": "prompts/get"`   | 服务器 MUST 拒绝，返回 400 和错误码 `-32001` |
| 工具名称不匹配           | `Mcp-Name: foo`          | `"params": {"name": "bar"}` | 服务器 MUST 拒绝，返回 400 和错误码 `-32001` |
| 缺少必需头               | （无 `Mcp-Method`）      | 有效主体                     | 服务器 MUST 拒绝，返回 400 和错误码 `-32001` |
| 头中存在多余空白         | `Mcp-Name:  foo `        | `"params": {"name": "foo"}` | 服务器 MUST 接受（按 HTTP 规范去除空白）        |

#### 值中的特殊字符

| 测试用例                    | 值                                   | 预期行为                  |
| --------------------------- | ------------------------------------ | ------------------------- |
| 带连字符的工具名称          | `my-tool-name`                       | 客户端按原样发送；服务器接受 |
| 带下划线的工具名称          | `my_tool_name`                       | 客户端按原样发送；服务器接受 |
| 含特殊字符的资源 URI        | `file:///path/to/file%20name.txt`    | 客户端按原样发送；服务器接受 |
| 带查询字符串的资源 URI      | `https://example.com/resource?id=123` | 客户端按原样发送；服务器接受 |

### 自定义头边界情况

#### x-mcp-header 名称冲突

| 测试用例                               | 规范                                                     | 预期行为                                                 |
| -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| 重复头名称（相同大小写）               | 两个属性都带 `"x-mcp-header": "Region"`                 | 客户端 MUST 拒绝工具定义                                 |
| 重复头名称（不同大小写）               | `"x-mcp-header": "Region"` 和 `"x-mcp-header": "REGION"` | 客户端 MUST 拒绝工具定义（不区分大小写的唯一性）         |
| 头名称与标准头同名                     | `"x-mcp-header": "Method"`                               | 允许（生成的是 `Mcp-Param-Method`，不是 `Mcp-Method`）  |
| 空头名称                               | `"x-mcp-header": ""`                                     | 客户端 MUST 拒绝工具定义                                 |

#### 无效的 x-mcp-header 值

| 测试用例               | x-mcp-header 值                 | 预期行为                  |
| ---------------------- | ------------------------------ | ------------------------- |
| 包含空格               | `"x-mcp-header": "My Region"`  | 客户端 MUST 拒绝工具定义  |
| 包含冒号               | `"x-mcp-header": "Region:Primary"` | 客户端 MUST 拒绝工具定义 |
| 包含非 ASCII           | `"x-mcp-header": "Région"`     | 客户端 MUST 拒绝工具定义  |
| 包含控制字符           | `"x-mcp-header": "Region\t1"`  | 客户端 MUST 拒绝工具定义  |

#### 值编码边界情况

| 测试用例                           | 参数值             | 预期头值                                 |
| ---------------------------------- | ------------------ | ---------------------------------------- |
| 纯 ASCII 字符串                    | `"us-west1"`       | `Mcp-Param-Region: us-west1`             |
| 以空格开头的字符串                | `" us-west1"`      | `Mcp-Param-Region: =?base64?IHVzLXdlc3Qx?=`     |
| 以空格结尾的字符串                | `"us-west1 "`      | `Mcp-Param-Region: =?base64?dXMtd2VzdDEg?=`     |
| 首尾有空格的字符串                | `" us-west1 "`     | `Mcp-Param-Region: =?base64?IHVzLXdlc3QxIA==?=` |
| 仅包含内部空格的字符串            | `"us west 1"`      | `Mcp-Param-Region: us west 1`            |
| 布尔值 true                      | `true`             | `Mcp-Param-Flag: true`                   |
| 布尔值 false                     | `false`            | `Mcp-Param-Flag: false`                  |
| 整数                             | `42`               | `Mcp-Param-Count: 42`                    |
| 浮点数                           | `3.14159`          | `Mcp-Param-Value: 3.14159`               |
| 非 ASCII 字符                    | `"日本語"`         | `Mcp-Param-Text: =?base64?5pel5pys6Kqe?=` |
| 包含换行的字符串                  | `"line1\nline2"`   | `Mcp-Param-Text: =?base64?bGluZTEKbGluZTI=?=` |
| 包含回车的字符串                  | `"line1\r\nline2"` | `Mcp-Param-Text: =?base64?bGluZTENCmxpbmUy?=` |
| 以制表符开头的字符串              | `"\tindented"`     | `Mcp-Param-Text: =?base64?CWluZGVudGVk?=` |
| 空字符串                         | `""`               | `Mcp-Param-Name: `（空值）               |

#### 类型限制违规

| 测试用例     | 属性类型               | 存在 x-mcp-header | 预期行为                  |
| ------------ | ---------------------- | ----------------- | ------------------------- |
| 数组类型     | `"type": "array"`      | 是                | 服务器 MUST 拒绝工具定义  |
| 对象类型     | `"type": "object"`     | 是                | 服务器 MUST 拒绝工具定义  |
| 空类型       | `"type": "null"`       | 是                | 服务器 MUST 拒绝工具定义  |
| 嵌套属性     | 对象内部的属性         | 是                | 服务器 MUST 拒绝工具定义  |

### 服务器验证边界情况

#### Base64 解码

| 测试用例                 | 头值                     | 预期行为                                                                                 |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| 有效 Base64              | `=?base64?SGVsbG8=?=`    | 服务器解码为 `"Hello"` 并进行验证                                                        |
| 无效的 Base64 填充       | `=?base64?SGVsbG8?=`     | 服务器 MUST 拒绝，返回 400 和错误码 `-32001`；中介 MAY 拒绝并返回 400 状态码           |
| 无效的 Base64 字符       | `=?base64?SGVs!!!bG8=?=` | 服务器 MUST 拒绝，返回 400 和错误码 `-32001`；中介 MAY 拒绝并返回 400 状态码           |
| 缺少前缀               | `SGVsbG8=`               | 服务器将其视为字面值，而不是 Base64                                                    |
| 缺少后缀               | `=?base64?SGVsbG8=`      | 服务器将其视为字面值，而不是 Base64                                                    |
| 格式错误的包装器       | `=?BASE64?SGVsbG8=?=`    | 服务器 MUST 接受（前缀不区分大小写）                                                    |

#### 空值与缺失值

| 测试用例                              | 场景                       | 预期行为          |
| ------------------------------------- | -------------------------- | ----------------- |
| 带 x-mcp-header 的参数为 null        | `"region": null`          | 客户端 MUST 省略该头 |
| 带 x-mcp-header 的参数缺失           | 参数不在实参中            | 客户端 MUST 省略该头 |
| 可选参数已提供                     | 提供了可选参数            | 客户端 MUST 包含该头 |

#### 主体中有值但缺少自定义头

| 测试用例                              | 头是否存在            | 主体值                      | 预期行为                                                                                 |
| ------------------------------------- | ------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 省略标准头，但主体中有值              | 无 `Mcp-Name`       | `"params": {"name": "foo"}` | 服务器 MUST 拒绝，返回 400 和错误码 `-32001`；中介 MAY 拒绝并返回 400 状态码           |
| 省略自定义头，但主体中有值            | 无 `Mcp-Param-Region` | `"region": "us-west1"`      | 服务器 MUST 拒绝，返回 400 和错误码 `-32001`；中介 MAY 拒绝并返回 400 状态码           |

## 参考实现

_将在此 SEP 达到最终状态之前提供。_

实现要求：

- **服务器 SDK**：提供一种机制（属性/装饰器），用于将参数标记为 `x-mcp-header`
- **客户端 SDK**：实现提取和编码请求头值的客户端行为
- **验证**：双方都必须验证请求头/请求体一致性
