# SEP-2640：技能扩展

- **状态**：最终
- **类型**：扩展轨道
- **创建**：2026-04-23
- **作者**：Peter Alexander (@pja-ant)、Ola Hungerford (@olaservo)、Sambhav Kothari (@sambhav)、Aditya Kumar (@aditya-scio)，代表 Skills Over MCP 工作组
- **赞助商**：@pja-ant
- **扩展标识符**：`io.modelcontextprotocol/skills`
- **PR**：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640
<Note>
此 SEP 由 [MCP 技能工作组](https://modelcontextprotocol.io/community/skills-over-mcp/charter) 开发。

设计历史和实验结果保存在
[ext-skills 存储库](https://github.com/modelcontextprotocol/ext-skills)。
</Note>

## 摘要

此 SEP 定义了使用现有资源原语通过 MCP 提供[代理技能](https://agentskills.io/) 的约定。 _skill_ 是一个文件目录（最小为 `SKILL.md`），为代理提供结构化工作流程指令。此扩展指定技能目录中的每个文件都作为 MCP 资源公开，通常采用 `skill://` URI 方案。技能通过URI寻址，可以直接读取； `skills/list` 方法枚举服务器提供的技能（技能目录很大、已生成或无法枚举的服务器可以返回空或部分列表），`skills/get` 方法通过 URI 返回任何单个技能条目。技能格式本身（目录结构、YAML frontmatter、命名规则以及控制主机如何将内容暂存到上下文中的[渐进式披露](https://agentskills.io/specification#progressive-disclosure) 模型）完全委托给[代理技能规范](https://agentskills.io/specification)；此 SEP 仅定义传输绑定。

该扩展定义了三种协议方法。声明扩展的每个服务器都实现 `skills/list`（枚举服务器提供的技能）和 `skills/get`（按 URI 返回单个技能的条目，包括列表中缺少的技能）。可选的 `resources/directory/read` 列出目录资源的直接子级，为代理提供技能支持文件的范围导航。其他一切都依赖于现有的协议表面，因此已经将 MCP 资源视为虚拟文件系统的主机可以像本地文件系统技能一样使用 MCP 服务的技能。该规范附有主机提供的资源读取工具和 SDK 级便利包装器的实施指南。

## 动机

主机应用程序中的本机技能支持表明对丰富的、逐步公开的工作流程指令的强烈需求。 MCP 目前不提供传统的方式来将这些内容与其描述的工具一起传送，这会导致：
- **分散的分发。** 服务器和指导代理使用它的技能是单独进行版本控制、发现和安装的。从注册表安装服务器的用户不会收到任何伴随技能存在的信号。 ([问题陈述](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/problem-statement.md))
- **指令大小限制。** 服务器指令作为 `server/discover` 结果的 `instructions` 字段提供，并且实际上在大小上受到限制。复杂的工作流程，例如 875 行 [mcpGraph 技能](https://github.com/TeamSparkAI/mcpGraph/blob/main/skills/mcpgraphtoolkit/SKILL.md)，不适合此模型。 ([实验结果](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/experimental-findings.md#mcpgraph-skills-in-mcp-server-repo))
- **不一致的临时解决方案。** 由于缺乏约定，几个独立的实现各自发明了自己的 `skill://` URI 结构，对于权限、路径和子资源寻址具有不同的语义。

## 规格

### 依赖关系

除了基本 MCP 资源原语之外，此扩展没有任何依赖项。在协议版本 2026-07-28 及更高版本中，`skills/list` 结果还携带基本协议的列表缓存属性 ([SEP-2549])。

### 技能格式

通过 MCP 提供的技能必须符合 [代理技能规范](https://agentskills.io/specification)。特别是：
- 技能是一个目录。它的_技能名称_是其 `SKILL.md` frontmatter 中 `name` 字段的值。
- 每个技能的根目录中必须包含一个 `SKILL.md` 文件。
- `SKILL.md` 必须以 YAML frontmatter 开头，至少包含代理技能规范定义的 `name` 和 `description` 字段。
- 技能可以包含附加文件和子目录（参考、脚本、示例、资产）。
此扩展不会重新定义、约束或扩展技能格式。代理技能规范的未来修订将自动应用。如果代理技能规范以向后不兼容的方式更改，客户端必须遵守代理技能规范提供的任何向后兼容性机制，并且应该继续支持代理技能规范，因为它在任何不兼容的更改之前就已存在。

### 资源映射

技能目录中的每个文件都作为 MCP 资源公开。服务器应该使用 `skill://` URI 方案，在该方案下资源 URI 的形式为：

```
skill://<skill-path>/<file-path>
```

where:

- `<skill-path>` 是一个或多个分段的 `/` 分隔路径，用于定位服务器技能命名空间内的技能目录。它可以是单个段（`git-workflow`）或嵌套到任意深度（`acme/billing/refunds`）。
- `<file-path>` 是相对于技能目录根的文件路径，使用 `/` 作为分隔符。
因此，技能所需的 `SKILL.md` 资源始终可寻址为 `skill://<skill-path>/SKILL.md`，技能的根目录为 `skill://<skill-path>`（删除了 `/SKILL.md` 后缀，没有尾部斜杠），与 [目录列表](#directory-listing) 匹配。

`<skill-path>` 的最后一段必须等于技能 `SKILL.md` 前面声明的 `name`。这反映了代理技能规范的要求：`name` [匹配父目录名称](https://agentskills.io/specification#name-field)。前面的段（如果有）是服务器选择的组织前缀。服务器可以按领域、团队、版本或任何其他轴分层组织技能。在`skill://acme/billing/refunds/SKILL.md`中，前缀是`acme/billing`，技能的`name`是`refunds`； `skill://git-workflow/SKILL.md` 中没有前缀，`name` 是 `git-workflow`。这意味着技能名称始终可以仅从 URI 恢复，而无需读取 frontmatter。

进一步的限制：
- `SKILL.md` 可能出现在技能的后代目录中，因此技能可以嵌套。参见[嵌套技能](#nested-skills)。
- 最后的 `<skill-path>` 段（即技能 `name`）必须满足代理技能规范的命名规则。第一个 `<skill-path>` 段占据权限组件，并且应该是根据 [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) 的有效 `reg-name`；任何其他前缀段应该是有效的 URI 路径段；没有对他们施加进一步的限制。
根据 RFC 3986，`<skill-path>` 的第一段占据权限组件。在此约定下，这不包含任何特殊语义，并且客户端不得尝试对其进行 DNS 或网络解析。

服务器可以在其域本机的另一个方案下提供技能（例如，`github://owner/repo/skills/refunds/SKILL.md`）。没有任何方案具有特权：上述结构约束（`<skill-path>` 以技能名称结尾，`SKILL.md` 在 URI 中显式显示）无论方案如何都适用，并且 [`skills/list`](#enumeration-via-skills%2Flist) 枚举服务器的技能，无论它们使用什么方案。

技能身份不依赖于方案。主机通过以下两种方式之一了解资源是技能：从 [`skills/list`](#enumeration-via-skills%2Flist) 条目，服务器发布的技能的权威记录；或者来自 [`skills/get`](#retrieval-via-skills%2Fget) 确认的显式引用（服务器的 `instructions` 字段、其他技能或用户），服务器应答其服务的技能，否则会出错。这适用于每个方案，包括 `skill://`。主机绝不能仅仅因为某个资源的 URI 带有特定的方案就断定该资源是一种技能。

#### 示例

| 技能路径             | File                  | 资源URI                                     |
| ---------------------- | --------------------- | ------------------------------------------------ |
| `git-workflow`         | `SKILL.md`            | `skill://git-workflow/SKILL.md`                  |
| `pdf-processing`       | `references/FORMS.md` | `skill://pdf-processing/references/FORMS.md`     |
| `pdf-processing`       | `scripts/extract.py`  | `skill://pdf-processing/scripts/extract.py`      |
| `acme/billing/refunds` | `SKILL.md`            | `skill://acme/billing/refunds/SKILL.md`          |
| `acme/billing/refunds` | `examples/email.md`   | `skill://acme/billing/refunds/examples/email.md` |

#### 资源元数据

对于每个 `skill://<skill-path>/SKILL.md` 资源：
- `mimeType` 应为 `text/markdown`。
- `name` 应从 `SKILL.md` YAML frontmatter 的 `name` 字段设置。根据上面的路径约束，这将等于 `<skill-path>` 的最后一段。
- `description` 应从 `SKILL.md` YAML frontmatter 的 `description` 字段设置。
服务器可以通过资源的 `_meta` 对象公开其他 frontmatter 字段。当 `_meta` 密钥用于技能资源时，实现应该使用 `io.modelcontextprotocol.skills/` 反向域前缀。技能中的其他文件使用适合其内容的 `mimeType`。

#### 嵌套技能

技能目录可以在后代目录中包含更多技能。嵌套技能与任何其他技能遵循相同的规则（其目录名称是 `name`，并且封闭技能的路径成为其组织前缀的一部分），具有以下语义：
- **嵌套的内容是辅助内容。** 从封装技能的角度来看，嵌套技能的目录和文件都是普通的辅助文件，阅读它们就是普通的阅读。以这种方式读取的嵌套 `SKILL.md` 是普通的降价：主机不得对其 frontmatter 进行操作。
- **激活需要重新同意。** 批准按技能进行：批准一项技能仅批准该技能，而不涉及其中嵌套的技能。激活嵌套技能（将其作为技能本身加载，无论是通过主机的技能加载机制还是通过使其 frontmatter 生效）需要新的、明确的用户同意；对封闭技能的认可并不能替代它。一旦激活，嵌套技能就是普通技能：其前题在与任何其他 MCP 服务的技能相同的规则下生效，包括 `allowed-tools` 上的批准门。
- **发布是扁平的。** 嵌套技能的发布方式与其他技能一样：通过其自己的 [`skills/list`](#enumeration-via-skills%2Flist) 条目，或通过显式引用。列表保持平坦：嵌套技能的条目是普通条目，其 `uri` 恰好与封闭技能共享路径前缀，并且列表中没有任何内容标记嵌套。

### 发现

服务器不需要使其技能可枚举。技能的 URI 可以通过 `resources/read` 直接读取，无论它是否出现在任何列表中，并且主机必须支持仅在给定 URI 的情况下加载技能（请参阅[主机：端到端集成](#hosts-end-to-end-integration)）。这是基线：如果模型具有 URI，无论是来自服务器指令、其他技能还是用户，它都可以读取该技能。

在此基线之上，定义了三种机制。两个是发现：通过 `skills/list` 进行枚举，声明此扩展的每个服务器都实现该枚举，以及来自服务器指令的可选指针。第三个是检索：无论主机到达技能的 URI，`skills/get` 都会返回该技能的条目（其元数据和摘要），包括列表中未提及的技能。

#### 通过 `skills/list` 进行枚举

声明 `io.modelcontextprotocol/skills` 扩展的服务器必须实现 `skills/list` 方法，该方法返回它所服务的技能。结果可能为空。

该请求带有可选的分页游标：

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "skills/list",
  "params": {}
}
```

结果带有技能条目：

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "complete",
    "skills": [
      {
        "uri": "skill://git-workflow/SKILL.md",
        "frontmatter": {
          "name": "git-workflow",
          "description": "Follow this team's Git conventions for branching and commits"
        },
        "resources": [
          {
            "uri": "skill://git-workflow/SKILL.md",
            "digest": "sha256:a1b2c3d4...",
            "size": 2314
          }
        ]
      },
      {
        "uri": "skill://acme/billing/refunds/SKILL.md",
        "frontmatter": {
          "name": "refunds",
          "description": "Process customer refund requests per company policy",
          "license": "Apache-2.0"
        },
        "resources": [
          {
            "uri": "skill://acme/billing/refunds/SKILL.md",
            "digest": "sha256:b2c3d4e5...",
            "size": 3871
          },
          {
            "uri": "skill://acme/billing/refunds/examples/email.md",
            "digest": "sha256:c3d4e5f6...",
            "size": 962
          }
        ]
      },
      {
        "uri": "skill://pdf-processing/SKILL.md",
        "frontmatter": {
          "name": "pdf-processing",
          "description": "Extract, fill, and assemble PDF documents",
          "metadata": { "version": "2.1.0" }
        },
        "resources": [
          {
            "uri": "skill://pdf-processing/SKILL.md",
            "digest": "sha256:d5e6f7a8...",
            "size": 5120
          },
          {
            "uri": "skill://pdf-processing/references/FORMS.md",
            "digest": "sha256:e6f7a8b9...",
            "size": 18433
          },
          {
            "uri": "skill://pdf-processing/scripts/extract.py",
            "digest": "sha256:f7a8b9c0...",
            "size": 4096
          },
          {
            "uri": "skill://pdf-processing/templates/invoice.md",
            "digest": "sha256:a8b9c0d1...",
            "size": 1210
          },
          {
            "uri": "skill://pdf-processing/templates/purchase-order.md",
            "digest": "sha256:b9c0d1e2...",
            "size": 1388
          },
          {
            "uri": "skill://pdf-processing/templates/regional/eu-invoice.md",
            "digest": "sha256:c0d1e2f3...",
            "size": 1472
          }
        ]
      }
    ]
  }
}
```

结果字段：
| 字段                         | 是否必需 | 说明                                                                                                                  |
| ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `skills`                      | Yes      | 技能条目数组。                                                                                                      |
| `skills[].frontmatter`        | Yes      | 技能的 `SKILL.md` YAML frontmatter 的逐字副本，呈现为 JSON。请参阅[前言](#frontmatter)。                 |
| `skills[].uri`                | Yes      | 技能`SKILL.md`的资源URI。请参阅[技能 URI](#skill-uris)。                                                       |
| `skills[].resources`          | Yes      | 技能的文件：用摘要和大小枚举它们的数组，或字符串 `"dynamic"`。请参阅[资源](#resources)。 |
| `skills[].resources[].uri`    | Yes      | 文件的资源 URI。                                                                                                    |
| `skills[].resources[].digest` | Yes      | 文件的 SHA-256 摘要。请参阅[完整性](#integrity-and-verification)。                                                    |
| `skills[].resources[].size`   | Yes      | 文件原始内容的长度（以字节为单位）。请参阅[限制](#limits)。                                                            |

动态生成内容的技能用 `"resources": "dynamic"` 代替数组。根本没有 `resources` 的条目无效。

分页镜像基本协议的列表方法：请求接受可选的 `cursor`，当结果包含 `nextCursor` 时，客户端将其传回以检索下一页。条目是原子的：技能的 `resources` 集永远不会跨页拆分。

在协议版本 2026-07-28 及更高版本中，结果还包含基本协议的列表缓存属性 `ttlMs` 和 `cacheScope`，如为 `tools/list` 和 `resources/list` ([SEP-2549]) 定义的，具有相同的语义：列表的新鲜度提示和缓存范围标记，而不是完整性属性。 [完整性和验证](#integrity-and-verification) 会管理内容，无论缓存的列表有多新鲜。

技能目录很大、按需生成或不可枚举的服务器可能会返回空或部分列表。主机不得将空列表或部分列表视为服务器没有技能的证据。该方法为服务器的技能提供条目，无论他们使用什么 URI 方案。枚举在各个方案中是统一的。

##### 名字

技能的 `name` 是一个标签，而不是标识符。技能由服务器内的 `uri` 以及跨服务器的服务器身份和 `uri` 对来标识（[技能 URI](#skill-uris)）。在服务器的列表中，名称应该是唯一的，但不能保证是唯一的：不同路径上的两个技能可能共享最后一段（`acme/billing/refunds` 和 `acme/support/refunds` 都命名为 `refunds`），并且嵌套技能可以与顶级技能共享其名称。主机不得假定名称唯一性。当一个列表中的两个条目在 `name` 上发生冲突时，主机必须消除它们的歧义，例如通过其区分路径段，而不是默默地丢弃或选择其中一个。当来自不同来源的技能在 `name` 上发生冲突时，主机必须在每个来源的命名空间中解析名称，通过主机分配的标签来识别服务器； MCP 提供的技能不得默默地隐藏或默默地取代任何其他来源的同名技能，无论是另一台服务器的技能还是主机自己的文件系统技能。请参阅[安全影响](#security-implications)。

##### 前题

`frontmatter` 是技能的 `SKILL.md` YAML frontmatter 逐字呈现为 JSON 对象。它包含作者编写的每个字段，而不是精选的子集。由于代理技能规范需要 `name` 和 `description`，因此这些字段始终存在；其他所有内容（`license`、`metadata`、代理技能规范的未来修订版添加的字段）均保持不变。因此，主机可以仅从列表中构建其技能注册表（名称、描述以及它理解的任何其他元数据），而无需获取每个 `SKILL.md`。

`frontmatter` 对象的内容必须与其描述的 `SKILL.md` 的前部内容相同。根据[资源映射](#resource-mapping)，条目的 `uri` 的最后一个 `<skill-path>` 段必须等于 `frontmatter.name`。

在 frontmatter `metadata` 对象中，以 `io.modelcontextprotocol/` 为前缀的键是为 MCP 扩展定义的元数据保留的。此扩展当前未定义此类键。实现应该忽略他们无法识别的此前缀下的键。

##### 技能 URI

`uri` 是技能 `SKILL.md` 的完整资源 URI，可通过 `resources/read` 读取。根据[资源映射](#resource-mapping)，支持文件可作为同一技能路径下的同级资源单独寻址。技能总是作为可单独寻址的资源来检索；此扩展定义不打包或捆绑的检索形式。请参阅[附录：延迟功能](#appendix-deferred-features)。

技能 URI 的范围仅限于为其提供服务的服务器。没有什么可以阻止两个连接的服务器同时提供 `skill://refunds/SKILL.md` 服务，而这是两个不相关的技能。因此，MCP 服务的技能的身份是始发服务器的主机身份和技能的 `uri` 的对。主机必须在记录或处理技能的任何地方保留两半，包括注册表、持久批准、缓存以及模型达到技能所通过的任何工具或路径，并且不得单独在 `uri` 上键入任何这些内容。特别是，主机实现技能内容的任何路径，无论是缓存目录还是虚拟挂载，都必须对服务器身份以及 `uri` 进行编码，以便来自不同服务器的相同 URI 技能落在不同的路径上，并且可以从该路径恢复原始服务器；这也是让主机遵守[安全影响](#security-implications) 中的持久源要求的原因。

#####资源
每个技能条目都需要 `resources`，并采用以下两种形式之一：以 `{uri, digest, size}` 三倍形式枚举技能文件（`SKILL.md` 和每个支持文件）的数组，或字符串 `"dynamic"`。该数组是主机验证的内容单元，并且用户的批准绑定到：
- 当存在时，`resources` 必须完整：它列出了技能的每个文件，每个文件恰好一次，包括与技能的顶级 `uri` 匹配的条目。该条目携带 `SKILL.md` 本身的摘要和大小。
- 每个 `uri` 必须是技能的 `SKILL.md` 或技能目录中的文件。
- 每个条目必须携带 `size`：文件原始内容的字节长度（与 `digest` 覆盖的字节相同）。 `size` 让主机在获取任何内容之前预算一项技能：它可以仅从条目强制执行 [限制](#limits)，决定文件是否值得检索，并在散列之前检测截断或填充的读取。字节长度与条目的 `size` 不同的读取是相当于摘要不匹配的验证失败（[完整性和验证](#integrity-and-verification)），无论主机是否继续计算摘要。
- 完整性扩展到嵌套技能：从封闭技能的角度来看，它们的文件是支持文件（[嵌套技能](#nested-skills)），因此封闭技能的 `resources` 也列出了它们，并且相同的文件可能出现在封闭技能和嵌套技能的条目中。因此，对嵌套技能的更改就是对封闭技能集的更改。
- 当技能的内容是动态生成时，无法发布稳定的摘要，服务器必须设置 `"resources": "dynamic"` 而不是数组。该标记是显式的，以便主机可以区分故意无法验证的技能和格式错误的条目：根本没有 `resources` 的条目，或者具有除数组或 `"dynamic"` 之外的任何值的条目是无效的，并且主机不得加载它。 `resources` 为 `"dynamic"` 的技能不提供内容完整性，并且不能进行内容绑定（[安全影响](#security-implications)）。主机可能会拒绝加载此类技能，并且服务器作者应该期望某些主机会这样做。

##### 完整性和验证

摘要是工件原始字节的 SHA-256 哈希值，格式为 `sha256:{hex}`，其中 `{hex}` 是 64 个小写十六进制字符。技能 `resources` 中的每个条目都在其 `uri` 处携带文件摘要。

当主机检索技能 `resources` 中列出的文件时，它必须根据该条目的摘要验证内容。不匹配意味着内容与列表所承诺的不符。它可能已损坏、被篡改或只是过时，因为技能在获取列表后进行了更新。无论出于何种原因，主机不得使用未经验证的内容；要从过时状态中恢复，请调用该技能的 [`skills/get`](#retrieval-via-skills%2Fget)（或调用 `skills/list` 来刷新目录）并从当前的 `resources` 集继续，该集不同，会撤销任何内容绑定批准（[安全含义](#security-implications)）。从主机将技能的 `SKILL.md` 加载到模型上下文的那一刻起，主机就开始对技能起作用，直到最早 `SKILL.md` 离开上下文为止；主机可以将窗口打开更长时间，而不是更短。在整个窗口中，主机保存加载技能的条目。由于 `resources` 已完成，因此未列出的文件是对技能的更改：在对技能进行操作时，主机必须仅将技能文件的读取解析为该条目的 `resources` 中列出的 URI，并且必须将技能内未列出文件的读取视为相当于摘要不匹配的验证失败。主机不得在需要之前检索技能的文件，无论是在连接时、在列出时还是在批准时。加载技能时会获取 `SKILL.md`，读取技能时会获取支持文件。一台服务器可能会发布许多技能，每个技能都有许多文件，并且每个连接检索所有技能的主机都会施加与目录成比例的负载，而不是使用。相反，主机应该缓存它们检索到的内容，并且摘要使该缓存的验证成本低廉：可以提供摘要与当前条目匹配的缓存文件，而无需再次获取它，而摘要不匹配的文件则必须再次获取。缓存副本的可信度取决于主机确信其字节自验证以来未曾更改；对磁盘缓存的要求在[安全影响](#security-implications)中。延迟检索与内容绑定批准兼容，内容绑定批准绑定到条目的 `resources` 集而不是检索到的字节；批准后很长时间获取的文件在读取时会根据该集进行验证。

摘要未签名并由提供内容的同一服务器提供。一场比赛证明两人是一致的，但并不证明其中任何一个都值得信赖。路径上的任何中介（例如网关）都可以一起重写列表和内容。主机不得将摘要匹配视为安全边界。

在从 `skills/list` 或 `skills/get` 获取主机保存条目的 `SKILL.md` 后（当条目的 `resources` 是数组时进行摘要验证，当它是 `"dynamic"` 时不可验证），主机必须解析其 YAML 前端内容并将其与条目的逐字段进行比较`frontmatter`。任何差异都必须被视为相当于摘要不匹配的验证失败，并且不得加载技能。这会在主机端强制执行 [Frontmatter](#frontmatter) 身份要求，以便用户从列表中批准的内容就是模型实际收到的内容。

##### 限制

此扩展修复了每个技能的两个限制，以便服务器知道每个符合要求的主机将接受什么，并且主机知道它们必须准备处理什么：
| Limit                     | Value                     | 计数完毕                                                |
| ------------------------- | ------------------------- | ----------------------------------------------------------- |
| 每项技能的资源       | 512 entries               | 包含技能`resources`、`SKILL.md`的条目 |
| 每个技能的总文件大小 | 16 MiB（16,777,216 字节） | `size` 与技能 `resources` 的总和              |

主机必须支持达到并包括这些限制的技能，并且可以支持更大的技能。服务器不应提供超过任一限制的技能；不保证任何符合要求的主机都可以加载该技能。因为 `resources` 是完整的，所以在主机检索单个文件之前，可以通过对条目进行计数并对 `size` 进行求和，仅从条目中检查两个限制，并且在此基础上拒绝技能的主机应该告诉用户原因，而不是在以后的读取中默默失败。

对于 `resources` 为 `"dynamic"` 的技能，该条目没有任何意义。选择加载此类技能的主机会将总大小限制应用于其实际检索的内容，并且一旦达到该限制，可以停止加载该技能。

这些限制限制了主持人对单一技能的接触。他们没有提及服务器可以提供多少技能或主机必须接受多少技能；列表可以任意大，这是主机仅按需检索文件的原因之一（[完整性和验证](#integrity-and-verification)）。

#### 通过 `skills/get` 检索

声明 `io.modelcontextprotocol/skills` 扩展的服务器还必须实现 `skills/get` 方法，该方法返回由其 URI 命名的单个技能的条目：

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "skills/get",
  "params": {
    "uri": "skill://pdf-processing/SKILL.md"
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "resultType": "complete",
    "skill": {
      "uri": "skill://pdf-processing/SKILL.md",
      "frontmatter": {
        "name": "pdf-processing",
        "description": "Extract, fill, and assemble PDF documents",
        "metadata": { "version": "2.1.0" }
      },
      "resources": [
        {
          "uri": "skill://pdf-processing/SKILL.md",
          "digest": "sha256:d5e6f7a8...",
          "size": 5120
        },
        {
          "uri": "skill://pdf-processing/references/FORMS.md",
          "digest": "sha256:e6f7a8b9...",
          "size": 18433
        },
        {
          "uri": "skill://pdf-processing/scripts/extract.py",
          "digest": "sha256:f7a8b9c0...",
          "size": 4096
        },
        {
          "uri": "skill://pdf-processing/templates/invoice.md",
          "digest": "sha256:a8b9c0d1...",
          "size": 1210
        },
        {
          "uri": "skill://pdf-processing/templates/purchase-order.md",
          "digest": "sha256:b9c0d1e2...",
          "size": 1388
        },
        {
          "uri": "skill://pdf-processing/templates/regional/eu-invoice.md",
          "digest": "sha256:c0d1e2f3...",
          "size": 1472
        }
      ]
    }
  }
}
```

`params.uri` 必须是技能 `SKILL.md` 的 URI。 `skill` 对象是技能条目，其形状和含义与 `skills/list` 条目相同，具有相同规则下的相同 `uri`、`frontmatter` 和 `resources` 字段。

Semantics:

- 如果 URI 未识别服务器提供的技能，则服务器必须返回错误 `-32602`（无效参数），与未知资源使用相同的代码 `resources/read`。
- 服务器必须回答其提供的每项技能，无论该技能是否出现在其 `skills/list` 结果中。部分列表中缺少的技能仍然可以通过 URI 检索。
- 结果是一个时间点快照，与列表条目完全相同。重新调用该方法是主机在不重新枚举目录的情况下刷新一项技能的摘要的方式。
- 动态生成内容的技能根据[资源](#resources)携带`"resources": "dynamic"`，无论是通过`skills/list`还是`skills/get`达到。
- 结果不带有分页光标：单个条目不是列表。该条目是服务器当时持有该技能的快照；结果是否还应像 `resources/read` 结果那样携带基本协议的缓存属性（`ttlMs` 和 `cacheScope`，根据 [SEP-2549]），仍处于开放状态。
该方法补充了基线：单独的 URI 就足以读取技能，并且 `skills/get` 将相同的 URI 转换为技能的元数据和摘要，因此从未出现在列表中的技能仍然可以被验证和内容绑定（[安全影响](#security-implications)）。

#### 来自服务器指令的指针

服务器可以将代理定向到其 `instructions` 字段中的特定技能 URI。这不需要主机上的发现机制； URI 仅存在于模型上下文中，并可通过 `resources/read` 读取。

#### 能力声明

根据 [SEP-2133] 扩展协商，服务器在其功能的 `extensions` 字段中声明对此扩展的支持：

```json
{
  "capabilities": {
    "extensions": {
      "io.modelcontextprotocol/skills": {
        "directoryRead": true
      }
    }
  }
}
```

定义了一项特定于扩展的设置：
| 设置项         | Type    | 默认值 | 含义                                                                 |
| --------------- | ------- | ------- | ----------------------------------------------------------------------- |
| `directoryRead` | boolean | `false` | 服务器实现[`resources/directory/read`](#directory-listing)。 |

空对象表示支持没有可选功能的扩展。声明扩展本身会将服务器提交给 [`skills/list`](#enumeration-via-skills%2Flist) 和 [`skills/get`](#retrieval-via-skills%2Fget)；客户端不得针对未声明 `directoryRead: true` 的服务器调用 `resources/directory/read`。声明此扩展的服务器还必须声明 `resources` 功能。

### 阅读

技能文件通过标准 `resources/read` 方法读取。没有定义特定于技能的读取语义。

特别是，通过 `resources/read` 读取 `SKILL.md` 本身并不会激活该技能。 `resources/read` 是传输：它返回字节，无论谁请求它们：通用资源读取工具、资源浏览器、检查服务器的用户。技能只能通过主机自己的技能加载路径激活，该路径根据技能条目验证内容（[完整性和验证](#integrity-and-verification)），应用任何所需的用户批准（[安全影响](#security-implications)），并打开主机在其中对技能执行操作的窗口。主机不得将通过任何其他路径到达的 `resources/read` 或 `SKILL.md` 视为负载：它不授予任何批准，不打开任何窗口，并且不授予技能支持文件的地位。以这种方式获得的内容是普通资源内容，将其返回到模型的主机应该像读取任何其他资源一样这样做，而不是作为加载的技能。希望这样的读取来加载技能的主机会通过技能加载路径来路由它。

技能内的内部引用（例如，链接到 `references/GUIDE.md` 的 `SKILL.md`）是相对路径，如代理技能规范的文件系统形式所示。客户端解析针对技能根的相对引用，因此 `skill://acme/billing/refunds/SKILL.md` 中的 `references/GUIDE.md` 解析为 `skill://acme/billing/refunds/references/GUIDE.md`，与文件系统路径解析完全相同。技能的根目录是包含 `SKILL.md` 的目录，而不是方案根目录。当技能嵌套时，每个 `SKILL.md` 的引用将根据其自己的目录进行解析：嵌套技能的 `SKILL.md` 中的相对引用将根据嵌套技能的根进行解析，无论如何到达文件。

### 目录列表

技能的说明经常引用目录而不是文件：“从 `templates/` 中选择适当的模板”、“在 `scripts/` 中运行匹配的脚本”。为此，代理必须了解目录包含的内容。 `resources/list` 无法回答该范围问题：它枚举服务器的整个资源空间，而不是子树，并且此 SEP 最希望容纳大型、生成的或不可枚举目录的服务器（请参阅[为什么列表可能为空或部分？](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/rationale.md#why-may-the-listing-be-empty-or-partial)）可能根本无法实现有意义的全局列表。

因此，此扩展定义了一种新方法 `resources/directory/read`，该方法在 [功能声明](#capability-declaration) 的 `directoryRead` 设置后面进行门控。

#### 目录资源

_目录资源_是 `mimeType` 为 `inode/directory` 的资源。在作为单独文件的技能命名空间中，每个目录级别都是一个目录资源：技能根目录 (`skill://pdf-processing`) 和每个子目录 (`skill://pdf-processing/templates`)。目录 URI 的书写方式不带尾部斜杠。目录资源不需要出现在`resources/list`中；无论是否列出，它们都是可寻址的。

#### `resources/directory/read`

该请求携带目录的 URI 和可选的分页光标。结果携带目录直接子级的资源元数据，与 `resources/list` 返回的相同 `Resource` 对象，具有相同的 `nextCursor` 分页协定。

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "resources/directory/read",
  "params": {
    "uri": "skill://pdf-processing/templates"
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "resources": [
      {
        "uri": "skill://pdf-processing/templates/invoice.md",
        "name": "invoice.md",
        "mimeType": "text/markdown"
      },
      {
        "uri": "skill://pdf-processing/templates/purchase-order.md",
        "name": "purchase-order.md",
        "mimeType": "text/markdown"
      },
      {
        "uri": "skill://pdf-processing/templates/regional",
        "name": "regional",
        "mimeType": "inode/directory"
      }
    ]
  }
}
```

Semantics:

- 该方法仅适用于目录资源。如果 URI 不存在，或者存在但不是目录资源，服务器必须返回错误 `-32602`（无效参数），与未知资源使用相同的代码 `resources/read`。
- 结果包含目录的每个直接子目录：具有普通资源元数据的文件、列为目录资源的子目录 (`mimeType: "inode/directory"`)。列表不是递归的；客户端通过在子目录上再次调用该方法来下降。
- 空目录会产生空的 `resources` 数组。
- 分页镜像 `resources/list`：当结果包含 `nextCursor` 时，客户端将其作为 `cursor` 传回以检索下一页。
声明 `directoryRead` 的服务器必须支持其作为单独文件的技能名称空间内的每个目录的方法。该方法本身并不特定于技能：服务器可以在任何方案下在其服务的任何目录资源上支持该方法。

#### 目录读取和保存的条目

对于条目带有`resources`的技能，宿主已经持有该技能文件的完整清单（[资源](#resources)）；读取的目录并没有告诉它该条目没有告诉它的该技能的内容。目录阅读在其他地方也占有一席之地：对于动态生成的技能，其 `resources` 是 `"dynamic"`；对于根本不是技能的资源树；以及无需首先刷新条目即可获取服务器的当前目录视图。当使用清单的技能进行操作的主机想要知道 `templates/` 包含什么内容时，它可以仅从条目中回答。

两种观点可以不一致。如果服务器在主机获取其条目后将文件添加到技能，则目录读取可能会列出该文件，而保存的清单不会列出该文件。这是[完整性和验证](#integrity-and-verification) 已经控制的陈旧快照情况，并且恢复路径是其中指定的路径：在对保留条目下的技能进行操作时，主机不得读取新列出的子项（未列出的文件是验证失败，就像摘要不匹配一样），并且不得将其作为技能的文件呈现给模型。为了达到该目的，主机使用 [`skills/get`](#retrieval-via-skills%2Fget) 刷新条目，此时 `resources` 集已更改，并且任何持久的内容绑定批准都将被撤销，并且必须再次获取（[安全影响](#security-implications)）。只有在刷新的条目下，新文件才可读。主机应该期待这个序列并将其呈现为已更改且需要重新批准的技能，而不是作为读取错误。相反，存在于清单中但不存在于读取的目录中的子文件是服务器不再提供服务的文件；读取它将会失败，并且同样的刷新也适用。

此扩展没有定义共享版本或缓存令牌，使主机可以确定目录结果和条目是否描述服务器的相同快照。清单对于主机在其当前批准下可以阅读的内容具有权威性；目录读取是一种实时观察，可能在其之前或之后运行。主机不得将目录结果视为扩展清单。

对于动态生成的技能，其 `resources` 为 `"dynamic"`，这些都不会改变技能的地位：它不提供内容完整性并且不能进行内容绑定，主机可能会拒绝加载它（[资源](#resources)）。目录读取是发现此类技能文件的根本方式，但它无法提供条目所缺乏的完整性。

## 实施指南

以下是可互操作实施的建议。它们不是规范规范的一部分。

### 主机：端到端集成

本节概述了主机将 MCP 提供的技能连接到现有技能实施中的一种方法。它是说明性的，而不是规定性的。主机可以自由地构建工具、命名和路由，但适合其架构。目标是 MCP 服务的技能通过与文件系统技能相同的加载和读取机制，同时根据[安全影响](#security-implications) 保留原始标记。

**注册表。** 在启动和连接更改时，主机从它支持的每个源组装单个内部技能注册表：文件系统技能目录，以及来自声明 `io.modelcontextprotocol/skills` 扩展的每个连接的 MCP 服务器的 `skills/list` 结果。每个注册表项记录技能的 `name` 和 `description`（来自条目的 `frontmatter`）及其来源：对于文件系统技能，本地目录；对于 MCP 技能，服务器标识和 `SKILL.md` 资源 URI。组装注册表仅读取列表：主机在此阶段不得获取 `SKILL.md` 或任何支持文件（[完整性和验证](#integrity-and-verification)）。该条目的 `frontmatter` 包含注册表所需的所有内容。注册表由技能身份、来源和 `SKILL.md` URI 一起键入（[技能 URI](#skill-uris)），而不是按名称键入。由于名称在源内部和源之间发生冲突 ([Names](#names))，因此注册表会限定显示冲突的名称，而不是删除任一条目；由于名称不是关键，因此碰撞永远不会改变技能的加载方式。

**上下文。** 主机在模型上下文中显示每个启用的注册表条目的 `name` 和 `description`，与模型已经看到的文件系统技能相同的列表，现在混合了 MCP 服务的条目以及条目的标识：原始服务器的主机标签和 `SKILL.md` URI。名称和描述告诉模型技能的用途；身份是模型加载它时传递的内容。主机的 UI 呈现相同的合并列表，供用户检查和按技能启用/禁用，并显示出处，以便用户可以查看技能来自哪个服务器。

**加载。** 主机向模型公开单个技能加载工具，由技能身份、原始服务器和 `SKILL.md` URI 键入：

```json
{
  "name": "read_skill",
  "description": "Load a skill's SKILL.md into context.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "server": {
        "type": "string",
        "description": "Name of the connected MCP server"
      },
      "uri": { "type": "string", "description": "The skill's SKILL.md URI" }
    },
    "required": ["server", "uri"]
  }
}
```

`read_skill`是本草图中宿主的技能加载路径，也是激活技能的唯一途径（[阅读](#reading)）；针对同一 `SKILL.md` URI 的 `read_resource` 调用会返回其内容，但不会加载技能。当模型调用 `read_skill` 时，主机在其注册表中查找该对并在原点上进行路由：从磁盘读取文件系统技能； MCP 技能是在此时而不是之前通过 `resources/read` 针对原始服务器获取的，除非经过验证的副本已存在于主机的缓存中。无论哪种方式，机制都是相同的。通过身份而不是名称来键入工具是让 URI 行进的关键：由用户、服务器指令或其他技能的 `SKILL.md` 传递给模型的技能 URI 正是 `read_skill` 所采用的，无需将其映射回主机可能有资格解决冲突的显示名称 ([Names](#names))。已经公开文件系统技能的名称键控加载工具的主机将其扩展为接受 `server` 和 `uri`，而不是引入并行工具；对于文件系统技能，它可以为本地源保留 `server` 值，并将 `SKILL.md` 路径作为 `uri` 传递。

**支持文件。** 一旦 `SKILL.md` 处于上下文中，模型可能会遇到对支持文件的相对引用（`references/GUIDE.md`、`scripts/extract.py`）。对于文件系统技能，模型使用主机的普通文件读取工具读取这些文件；对于 MCP 技能，没有本地文件。因此，主机还公开了一个通用的资源读取工具：

```json
{
  "name": "read_resource",
  "description": "Read an MCP resource from a connected server.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "server": {
        "type": "string",
        "description": "Name of the connected MCP server"
      },
      "uri": { "type": "string", "description": "The resource URI" }
    },
    "required": ["server", "uri"]
  }
}
```

主机安排模型了解何时加载 MCP 服务的 `SKILL.md`、它来自哪个服务器以及其基本 URI 是什么，例如通过在 `read_skill` 工具结果中说明两者，以便模型可以将 `references/GUIDE.md` 解析为 `skill://<skill-path>/references/GUIDE.md` 并向正确的服务器发出 `read_resource`。主机可以通过将每个服务器的 `skill://` 命名空间安装到虚拟路径中，将其折叠到其文件读取工具中，每个服务器有一个安装根，以便该路径对服务器身份进行编码（[Skill URI](#skill-uris)），并将该路径下的读取转换为 `resources/read` 调用，在这种情况下，不需要单独的 `read_resource` 工具，并且模型会处理每个支持文件作为本地路径。虚拟挂载解决了访问时的读取问题；它不得通过提前获取技能文件来填充。无论哪种方式，解析规则都是相同的：相对引用针对技能的根目录进行解析，就像在文件系统上一样。当技能的条目携带 `resources` 数组时，主机会根据[完整性和验证](#integrity-and-verification) 验证每个此类读取。

**目录导航。** 技能说明可能会将模型指向目录而不是文件（“从 `templates/` 中选择正确的模板”）。当原始服务器声明 `directoryRead` 时，主机应该向模型展示此功能：目标是目录资源的 `read_resource` 调用可以路由到 `resources/directory/read` 并返回子列表，并且虚拟安装方法将其映射到主机现有的目录列表工具：安装路径的 `ls` 变为 `resources/directory/read`打电话。

**未枚举的技能。** 因为列表可能是空的或部分的，所以主机还应该接受它从未见过的列出的技能 URI，这些技能 URI 由用户、服务器指令或其他技能传递给模型。在这样的 URI 上调用 `skills/get` 会产生与列表中包含的条目相同的条目，因此未列出的技能会进入注册表，得到验证，并按照与列出的技能相同的条款获得批准；不将 URI 作为技能提供服务的服务器会返回错误。不需要特殊的工具表面：`read_skill` 已经采用服务器和 URI，因此命名注册表未见过的一对的 `read_skill` 调用是 `skills/get` 的触发器。

上面的两个工具签名都包含 `server`，因为两个连接的服务器可能都提供 `skill://refunds/SKILL.md` ([Skill URI](#skill-uris))。这是一种消歧策略；主机可以使用每服务器前缀、会话范围或任何其他适合其架构的内容来重写 URI。该工具是通用工具，可以读取任何 MCP 资源，并且其用途超出了技能范围。

### SDK：便利包装器

SDK 维护者应该提供功能可供性，以特定于技能的术语包装底层资源操作。例如：

**服务器端**：在给定路径的目录中声明技能：

```python
@server.skill("git-workflow")                 # → skill://git-workflow/SKILL.md
def git_workflow():
    return Path("./skills/git-workflow")

@server.skill("acme/billing/refunds")         # → skill://acme/billing/refunds/SKILL.md
def refunds():
    return Path("./skills/refunds")
```

SDK 处理：读取 `SKILL.md` frontmatter 以填充资源元数据，在 `resources/read` 上提供文件内容，并回答 `skills/get`（以及，在服务器技能集受限的情况下，`skills/list`），从注册文件中计算条目摘要和大小，以及在注册技能超出 [限制](#limits) 时发出警告。

**客户端**：枚举和获取技巧：

```python
skills = await client.list_skills()               # calls skills/list, paginating; may be empty
entry = await client.get_skill(
    "skill://acme/billing/refunds/SKILL.md")      # calls skills/get, listed or not
content = await client.read_skill_uri(
    "skill://acme/billing/refunds/SKILL.md")      # wraps resources/read, works regardless of enumeration
entries = await client.read_directory(
    "skill://pdf-processing/templates")           # wraps resources/directory/read
```

这些包装器很薄，每个包装器都是具有固定 URI 模式的单个底层协议调用，但它们为服务器作者提供了一种符合人体工程学的方式来声明技能，并为客户端作者提供了一个可发现的入口点。

## 基本原理

此 SEP 的设计原理（为什么技能映射到资源而不是新原语、URI 结构、列表语义、`skills/get`、索引资源上方法的选择、对agentskills.io 的格式委托、目录读取、逐字前台内容和每个文件摘要）在工作组存储库中作为独立文档进行维护：[rationale.md](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/rationale.md)。

该设计的一点值得在此重申，因为它决定了两种方法的关联方式。 `skills/list` 条目有意成为技能的完整清单、逐字记录的 `frontmatter` 及其带有摘要的完整 `resources` 集，而不是由后续调用填写的摘要。因此，翻阅列表的主机在这一过程中就拥有了构建其注册表、提供批准技能、将批准绑定到内容以及验证稍后读取的每个文件所需的一切；每个技能没有第二次往返，这对于连接到许多服务器或具有多种技能的服务器的主机来说最为重要。 `skills/get` 存在于列表不适用的情况：刷新单个技能的条目（通常在摘要不匹配之后），而不重新枚举目录，以及获取部分列表省略的技能的条目。这绝不是主持人完成列出的条目所必须采取的步骤。

## 向后兼容性

此扩展引入了三种协议方法。 `skills/list` 和 `skills/get` 由声明扩展的每个服务器实现，因此客户端仅在看到声明后发出这些调用，而早于扩展的客户端永远不会发出它们。 `resources/directory/read` 在 `directoryRead` 功能设置后面另外进行门控，因此未声明它的服务器永远不会收到调用。该扩展没有引入其他方法、消息类型或架构更改。不实现此扩展的服务器不会公开任何 `skill://` 资源；现有客户不受影响。未实现此扩展的客户端将 `skill://` 资源视为普通资源，事实也确实如此。

使用其他 `skill://` URI 结构的现有实现需要进行调整以符合要求。请参阅工作组的[相关工作调查](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/related-work.md) 获取目录。值得注意的是，FastMCP 广泛使用的 [SkillsProvider](https://gofastmcp.com/servers/providers/skills) 在 URI 结构、发现（每个技能 `_manifest` 与中心索引）和元数据映射方面存在分歧；协调移民是工作组近期的优先事项。这些是机械变化，而不是语义变化。

## 安全影响

技能内容是传递给模型的指导文本，这使其成为提示注入表面（[open-questions.md §10](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/open-questions.md#10-how-should-skills-handle-security-and-trust-boundaries) 中的背景）。此扩展提出了以下要求：
- **技能内容是不受信任的输入。** 主机必须将 MCP 提供的技能内容视为不受信任的模型输入，并受到应用于任何服务器提供的文本的相同提示注入防御。连接的服务器并不使其技能内容具有权威性。
- **来源必须对模型可见。** 主机必须在进入模型上下文时使用其原始服务器身份标记 MCP 提供的技能内容，并且不得向模型提供 MCP 提供的技能，因为与本地文件系统技能无法区分。决定是否遵循技能指令的是模型，而不是宿主。阻止其来源使得上述不受信任的输入要求在作用于其的层上无法执行。
- **技能引入了工具不会引入的主机端表面。**与远程工具调用不同，MCP 服务的技能可以将服务器编写的字节放置在主机文件系统上，并指示模型使用主机端工具执行它们。主机必须将 MCP 服务的技能视为比远程工具调用风险更高的表面。
- **无隐式本地执行。** 未经每个技能用户的明确批准，主机不得允许 MCP 提供的技能内容导致主机端代码执行。这涵盖 (a) 主机解析的声明性字段（钩子、frontmatter 脚本）和 (b) 技能主体中的指令，这些指令指示模型调用任何主机代码执行工具，无论是运行技能中捆绑的脚本还是运行技能指定的任意命令。主机必须忽略或批准门 (a)，并且必须对模型作用于 MCP 服务的技能时发出的代码执行工具调用应用相同的批准门。
- **原始范围的资源读取。** 模型可调用的资源读取表面（例如 [主机：端到端集成](#hosts-end-to-end-integration) 中的 `read_resource` 模式）是由不受信任的技能内容驱动时的跨服务器混淆代理向量。主机必须将此类读取绑定到技能的原始服务器：服务器 A 提供的技能不得导致针对服务器 B 的 `resources/read`。主机必须通过主机分配的标签来标识服务器，而不是服务器自我报告的 `serverInfo.name`。任何跨源读取都必须在明确的每次调用用户批准命名两个服务器之后进行门控。
- **名称冲突是一种模拟表面。** 技能名称在不同来源之间并不唯一，恶意服务器可以以流行技能的名称发布技能，无论是另一台服务器的技能还是用户自己的本地技能，都依赖于主机解析其方式。主机必须解析每个源名称空间内的技能名称，通过主机分配的标签来识别服务器，而不是自我报告的 `serverInfo.name`；不得让 MCP 服务的技能默默地隐藏、替换或拦截来自任何其他来源的同名技能的调用，包括主机的文件系统技能；并且应该向用户显示碰撞。名称与其来源当前提供的任何字节绑定，并且不带有作者身份或认可。中介机构可以通过 `_meta` 在自己的反向域前缀下附加出处或验证注释，而不是为此扩展保留的 `io.modelcontextprotocol.skills/` 前缀（[资源元数据](#resource-metadata)）；此扩展不为此类注释分配任何语义。
- **无隐式权限授予。** 当技能通过 MCP 到达时，主机不得遵守扩展模型工具或文件系统权限的 frontmatter 字段。特别是，源自文件系统的技能用来声明其运行时可用的工具的代理技能 `allowed-tools` 字段对于 MCP 起源的技能必须被忽略，除非用户已明确批准对该技能的授予。填充 `allowed-tools` 的远程服务器正在请求主机上的提升访问权限，而不是声明其自身环境的属性。对技能的批准永远不会扩展到其文件空间内任何其他 `SKILL.md` 的前面内容：嵌套技能的 `allowed-tools` 无效，除非该嵌套技能本身在其自己的批准下激活（[嵌套技能](#nested-skills)）。
- **技能是数据，而不是指令。** 主机不得将技能资源视为比其他上下文更高的权限。明确的用户策略控制是否加载技能。
- **嵌套技能同意。** 批准按技能进行：批准一项技能并不批准其中嵌套的技能。根据[嵌套技能](#nested-skills)，激活嵌套 `SKILL.md` 需要新的、明确的用户同意。默默地将已批准技能的文件升级为活动技能将使服务器在事先批准的情况下接受新的指令和权限请求。
- **出处和检查。** 主机在呈现技能时应指示技能源自哪个服务器，应让用户在将技能加载到模型上下文之前检查技能的内容，并且可以在每个技能或每个服务器用户批准后控制加载。
- **摘要不是安全边界。** 列表摘要未签名，并且来自与内容相同的服务器。它们确认列表和获取的内容之间的一致性，如[完整性和验证](#integrity-and-verification)中所述，但它们无法建立对内容的信任、防御服务器本身或检测将两者一起重写的中介。
- **内容绑定批准。** 当主机坚持任何每技能用户批准时，它必须绑定到批准时观察到的条目的 `resources` 集（每个 `uri` 和 `digest`）。如果该技能的后续条目（来自 `skills/list` 或 `skills/get`）公布了不同的集合，无论文件是轮换、添加还是删除，主机必须将先前的批准视为已撤销，并在加载或执行之前重新提示。主机不需要轮询更改。作用技能时（[完整性与验证](#integrity-and-verification)），移动的内容读取时验证失败；如果它确实获取了新条目，则上述规则将撤销批准。这两条路径都不允许移动的内容在旧批准下通过。 `resources` 为 `"dynamic"` 的技能不能进行内容绑定：主机可以拒绝加载它，并且不得将持久批准视为涵盖服务器当前提供的任何内容。摘要验证（[完整性和验证](#integrity-and-verification)）在批准后捍卫批准。当用户批准内容时，它无法确定该内容是可信的，因为服务器同时创作了列表和正文。
- **缓存、缓存完整性、缓存隔离和持久来源。**主机应该在本地缓存经过验证的技能内容，在读取文件时按需填充，而不是批量填充（[完整性和验证](#integrity-and-verification)）。缓存是经过一次验证的内容的第二个副本；验证不会延续到此后可能已更改的字节。因此，在磁盘上缓存技能内容的主机必须对缓存中提供的每个文件执行以下操作之一：将缓存保留在只有主机可以写入的位置（不是模型，不是模型运行的脚本或工具，不是机器的其他用户），并且永远不要修改缓存的文件；或者根据每次访问时的缓存字节重新计算文件的 SHA-256 摘要，并将其与条目的摘要进行比较，将不匹配完全视为新读取时的不匹配。比较存储的摘要标签或修改时间并不是验证。在磁盘上缓存 MCP 服务的技能内容的主机也必须在每个文件系统技能发现路径中排除的位置执行此操作，并且必须将从该位置加载的内容视为已通过 MCP 到达，以实现上述非隐式本地执行规则的所有目的，包括主机重新启动后和原始服务器断开连接后。缓存字节不会通过驻留在本地而升级为文件系统技能信任。当用户删除服务器时，主机应该删除服务器缓存的技能内容。

## 参考实现

根据 [SEP-2133]，扩展轨道 SEP 在审查之前需要官方 SDK 中至少有一个参考实现。

**SDK实现：**
- Python SDK：[python-sdk#3485](https://github.com/modelcontextprotocol/python-sdk/pull/3485)
- C# SDK：[csharp-sdk#1856](https://github.com/modelcontextprotocol/csharp-sdk/pull/1856)
- Go SDK: [go-sdk#1238](https://github.com/modelcontextprotocol/go-sdk/pull/1238)
**一致性测试：**
- 具有 SEP 可追溯性文件 (`sep-2640.yaml`) 的客户端和服务器场景：[conformance#330](https://github.com/modelcontextprotocol/conformance/pull/330)
**原型主机实现**（阅读 `skill://` 资源、展示技能以及文件系统技能）：
- 双子座-cli：[olaservo/gemini-cli#1](https://github.com/olaservo/gemini-cli/pull/1)
- 快速代理：[evalstate/快速代理#815](https://github.com/evalstate/fast-agent/pull/815)
- 法典：[olaservo/codex#1](https://github.com/olaservo/codex/pull/1)
- Claude Code：在 Anthropic 内部原型；尚未公开
**原型服务器实现：**
- GitHub MCP 服务器：[github/github-mcp-server#3046](https://github.com/github/github-mcp-server/pull/3046)

## 附录：延迟功能

此处记录的功能出现在本 SEP 的早期版本中，并在审核结束前被删除。它们不是此扩展的一部分。每一项都被记录下来，并记录了删除它的反对意见，以便将来任何重新提出反对意见的提案都从这些反对意见开始，而不是重新发现它们。

### 档案分发

早期版本允许技能条目将整个技能目录（gzip 压缩的 tar 和 ZIP）的预打包存档作为技能的 `uri` 的替代检索形式进行广告。主机可以在单个 `resources/read` 中获取多文件技能，而不是每个文件一个，并且存档可以携带单独服务的资源无法表示的 UNIX 文件元数据（可执行位、符号链接）。

核心维护者在审查期间删除了档案，原因有二：
- **解压是与收益不成比例的攻击面。** 安全地提取远程服务器提供的存档意味着防御解压炸弹、路径遍历、技能目录外部解析的链接、静默覆盖 `SKILL.md`、setuid 和 setgid 位以及设备节点等非常规文件条目的大小写和 Unicode 规范化冲突。每个主机都必须正确实施该清单，并且任何项目出错的主机都可以被它连接到的任何服务器利用。将技能作为可单独寻址的资源提供服务没有可比的表面。
- **服务一种技能的两种方式存在兼容性风险。** 档案是协议已经可以表达的内容的第二种编码。主机必须支持这两种形式才能确保读取任何技能，并且仅作为存档提供的技能对于单独实现单个文件读取的主机来说是无法读取的。单一的检索表格使兼容性保持平坦：任何符合标准的主机都可以读取任何符合标准的技能。
删除的成本是引入档案来解决的问题：具有许多支持文件的技能需要每个文件一次往返，并且可执行位和符号链接没有表示。由于主机仅在需要时检索文件（[完整性和验证](#integrity-and-verification)），因此该成本随会话实际使用的文件而不是技能的大小而变化。如果重新考虑档案，首先要解决的问题是如何限制主机端解包风险，也许可以通过将格式限制为不允许符号链接、不允许非常规条目和声明的未压缩大小的配置文件；以及如何严格保留存档作为优化，而不是检索技能的唯一方法，以便兼容性保持平稳。现在还需要存档表单来准确解压到条目 `resources`（[资源](#resources)）中枚举的文件集。

## 参考文献

- [特工技能说明](https://agentskills.io/specification)
- [SEP-2133][]：扩展
- [SEP-2549][]：列表结果的 TTL
- [SEP-2076][]：特工技能为一流原语（替代方法）
- [MCP工作组章程技能](https://modelcontextprotocol.io/community/skills-over-mcp/charter)
- [决定日志](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/decisions.md)：工作组的决定和理由
- [实验结果](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/experimental-findings.md)：实施结果（WIP）
- [相关工作](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/related-work.md)：现有技能服务实施的调查
- [技能`_meta`按键](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/archive/skill-meta-keys.md)：技能资源的`_meta`按键约定
- [RFC 3986：URI](https://datatracker.ietf.org/doc/html/rfc3986)
[SEP-2076]：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2076
[SEP-2133]：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2133
[SEP-2549]：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2549