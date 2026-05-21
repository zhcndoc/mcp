# SEP-2596：规范特性生命周期与弃用政策

- **状态**：草案
- **类型**：流程
- **创建于**：2026-04-17
- **作者**：Den Delimarsky (@localden)
- **发起人**：@localden
- **PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2596

## 摘要

本 SEP 定义了 Model Context Protocol
规范中单个特性的生命周期，独立于规范文档本身的修订生命周期。它引入了三种特性状态（Active、Deprecated、Removed），规定了在这些状态之间迁移的条件和流程、弃用与移除之间的最短时间窗口，以及每次状态转换所需的文档。其目标是提供一个可预测的时间线，使 SDK 作者和实现者在协议表面被退役时能够据此规划迁移。

## 动机

该规范已经退役或暗示退役了若干特性，但每一种情况都是临时处理的：

- HTTP+SSE 传输在
  [可流式 HTTP 向后兼容指南][transports-compat]中被描述为“deprecated”，但没有说明移除日期。
- `includeContext` 值 `"thisServer"` 和 `"allServers"` 在
  [`sampling/createMessage`][sampling-includecontext] 以及 `schema.ts` 中被标记为“soft-deprecated”，并注明它们
  “可能会在未来的规范版本中被移除”。
- JSON-RPC 批处理在修订版 `2025-03-26` 中添加，并在 `2025-06-18` 中移除，只隔了一个
  发行版，没有弃用期。
- 诸如整合 `Resource` 和 `ResourceTemplate`（[#1540][issue-1540]）以及
  弃用 roots、sampling 和 logging（[SEP-2577][sep-2577]）之类的公开提案，都将退役现有
  表面区域，但没有可遵循的流程。

这种不一致带来了成本。实现者无法判断“deprecated”和“soft-deprecated”是否意味着不同的东西，也不知道任一状态在移除前会持续多久。诸如
[讨论 #2177][disc-2177]（询问 SSE 传输究竟何时会被移除）这样的社区问题没有可引用的政策。在
[NYC 维护者会议][nyc-2026-03-31]上，大型实现者将对旧协议版本的无限期支持描述为“腐蚀性的技术债务”。[稳定优先于速度][design-principles]设计原则指出“从 \[规范\] 中移除几乎是不可能的”，但对于确有必要移除的情况却没有提供路径。

核心维护者在 [2026 年 4 月 1 日会议][cm-2026-04-01]上一致认为，MCP 需要“正式的版本状态和定义明确的弃用周期”，并且“方向已达成一致，机制待定”。本 SEP 提出了这些机制。

## 规范

### 范围

本政策管辖 MCP 核心规范的**特性**：协议消息、能力、传输、架构类型以及规范性的行为要求。它不管辖
SDK 专用 API、注册表策略，或规范文档本身（Draft、Current、Final）的独立生命周期；后者由[版本控制指南][versioning]定义。

请注意，本文档中“Final”有两种含义：当某个规范_修订版_被更晚的修订版取代时，该修订版即为 Final（依据版本控制指南）；而一个 _SEP_ 在其状态按 [SEP 指南][sep-guidelines] 推进时也会达到 Final。上下文通常可以消歧；若不能，则本文档会明确写作“the SEP reaches Final”或“Final revision”。

### 特性状态

某个规范特性恰好处于以下三种状态之一：

| 状态           | 含义                                                                                                                                                       | 实现者预期                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Active**     | 该特性属于 Current 规范修订版，且没有计划中的移除。                                                                                                        | 按该特性的规范性要求实现。                                                                                         |
| **Deprecated** | 该特性仍保留在规范中，但计划被移除。迁移路径已记录（见下文）。                                                                                               | 新实现 SHOULD NOT 采用该特性。现有实现 SHOULD 在最早移除日期之前完成迁移。                                       |
| **Removed**    | 该特性已从 `draft` 中删除，并将在下一个 Current 修订版中缺席。它仍记录在其最后出现的 Final 修订版中。                                                     | 面向下一个 Current 修订版的实现 MUST NOT 依赖该特性。                                                               |

“soft-deprecated”一词已废弃。规范中现有的用法依据本政策重新归类为 Deprecated（见[迁移](#transition)）。

从规范中移除某特性并不意味着 SDK 必须在其仍支持该特性作为 Active 或 Deprecated 的较早修订版时立即从发行版中删去该特性；该时间线由 SDK 自身的修订支持政策决定（见[开放问题](#open-questions)）。

若有 SEP 取代该弃用 SEP，并记录了变化后的情况，则一个 Deprecated 特性 MAY 被恢复为 Active。恢复遵循与弃用相同的批准路径。如果该特性之后再次被弃用，则在[弃用特性](#deprecating-a-feature)中的最短弃用窗口应从新弃用生效的修订版起重新计算。

### 弃用特性

当满足以下任一条件时，可提议将某特性弃用：

- 它已被另一个覆盖相同用例的特性取代。
- 它引入了无法原地缓解的安全、隐私或互操作风险。
- 生态遥测或 SDK 维护者共识表明，与其维护成本相比，其采用率可以忽略不计。

弃用是规范变更，因此需要依据 [SEP 指南][sep-guidelines] 提交 SEP。弃用 SEP MUST：

1. 以名称标识该特性，并链接到其在 `schema.ts` 中的定义（如适用）以及规范正文。
2. 说明符合上述标准的理由。
3. 记录迁移路径，或明确说明不需要迁移路径。若迁移路径命名了替代特性，则该特性 MUST 在弃用生效的那个修订版中处于 Active；替代项和弃用 MAY 在同一修订版中落地。若其文档化替代项仍仅处于 `draft`，则本政策下该特性不算被弃用。
4. 指定**最短弃用窗口**：在该特性有资格被移除之前，必须保持 Deprecated 的月数，至少十二个月。该窗口从该特性首次被标记为 Deprecated 的规范修订版发布之时开始计算，而不是从 SEP 达到 Final 的日期开始。该特性在窗口期届满后首次作为 Current 发布的规范修订版中，才具备移除资格；该时间点即该特性的**最早移除时间**。

当弃用 SEP 达到 Final 时，弃用即被排入日程：以下变更进入规范草案（`schema/draft/` 和 `docs/specification/draft/`）。当承载这些变更的修订版依据 [版本控制指南][versioning] 作为 Current 发布时，该特性变为 Deprecated，且最短弃用窗口从该次发布开始计时。将时钟锚定到修订版发布，意味着同一修订版中被弃用的每个特性共享同一个最早移除时间，而不是每个特性都各自携带一个源自其 SEP 落地时间的日期。

- 该特性在 `schema.ts` 中的条目增加一个 `@deprecated` JSDoc 标记，引用弃用 SEP 以及弃用生效的修订版。
- 该特性的规范正文增加一条包含相同信息的弃用通知。
- 该修订版的 `changelog.mdx` 在 “Deprecated” 标题下增加一条记录。本 SEP 引入 “Deprecated” 和 “Removed” 作为与现有 Major/Minor/Other 分组并列的固定变更日志标题。
- 该特性被加入 [已弃用注册表](#the-deprecated-registry)，其中包含其弃用 SEP、其变为 Deprecated 的修订版、迁移路径以及最早移除时间。

### 已弃用注册表

`docs/specification/draft/deprecated.mdx` 是一个单页列表，列出当前处于 Deprecated 状态的每个特性。它是“哪些特性正在退出，以及何时退出”的权威答案，因此实现者无需从分散在各修订版 changelog 中的弃用条目拼凑出全貌。每一行记录特性、其弃用 SEP、其变为 Deprecated 的修订版、记录的迁移路径以及最早移除时间。弃用会新增一行；移除会将该行移到同一页面的 Removed 部分，并链接到 changelog 条目，因此该页面同时也充当历史记录。该注册表本身不具有规范效力；它是一个派生视图，需与逐特性通知和 changelog 条目保持一致，而这些才是规范记录。

### 第 1 层 SDK 义务

特性生命周期只有在将其暴露给消费者的实现中才真正有效。上面的规范工件记录了某个特性已被 Deprecated；第 1 层 SDK（依据 [SEP-1730][sep-1730]）将该记录传递给原本可能只能通过故障才发现移除的实现者。当某个特性变为 Deprecated 的修订版作为 Current 发布后，第 1 层 SDK：

- MUST 在其下一次发布中，使用该语言原生机制将相应 API 表面标记为 deprecated（例如 Java 中的 `@Deprecated`、.NET 中的 `[Obsolete]`、TypeScript 中的 `@deprecated` JSDoc、Go 中的 `Deprecated:` 文档约定），并在机制允许时引用弃用 SEP 和最早移除日期。该标记适用于 SDK API 表面，不以消费者目标规范修订版为条件；即使向仍停留在较早修订版的消费者展示它，也是有意的前向信号。
- SHOULD 在使用到已弃用特性时发出运行时警告，使用该语言惯用机制（例如 Python 的 `DeprecationWarning`、Node.js 的 `process.emitWarning`，或可配置日志器）。运行时警告能够触达那些从不阅读 API 文档的开发者，并且是可由一致性测试断言的可观测信号。

这些义务是第 1 层状态的符合性标准。若某个第 1 层 SDK 持续未能暴露已弃用特性，则适用 [SEP-1730][sep-1730] 中的 [层级降级流程][sep-1730-relegation]。

### 移除特性

1. 一旦某特性被设定为移除，在最短弃用窗口结束后，核心维护者可在发布准备期间，依据[治理决策流程][governance-decisions]决定执行移除。移除不需要其自身的 SEP。在移除某特性之前，核心维护者 MUST 确认弃用 SEP 中命名的迁移目标（如果有）仍然是 Active。
2. 若需对弃用或移除做任何其他变更，例如延长或缩短时间线（[加速移除](#expedited-removal)）或将特性恢复为 Active（[特性状态](#feature-states)），则需要 SEP。

请注意，特性在远超最短弃用窗口的时间内仍可保持 Deprecated 而不被移除。

SDK 将弃用作为 [SDK 分层体系][sep-1730] 的一部分来实现（见[第 1 层 SDK 义务](#tier-1-sdk-obligations)）；移除不会对 SDK 维护者施加额外要求。

当作出移除决定时，该特性会从 `schema/draft/schema.ts`（如存在）和草案规范正文中删除；该修订版的 `changelog.mdx` 会在 “Removed” 标题下增加一条记录，链接到弃用 SEP 和该特性存在的最后一个 Final 修订版；而该特性的[注册表](#the-deprecated-registry)行会移至 Removed 部分，并链接到该 changelog 条目。

### 加速移除

当某特性带来活跃的安全风险时，十二个月的下限 MAY 被缩短；所谓安全风险，是指存在已发布安全公告，或有文档记录的真实世界利用、且无法原地缓解的漏洞。缩短窗口需要核心维护者依据[治理决策流程][governance-decisions]批准，并记录在弃用 SEP 中；如果风险在该 SEP 已达到 Final 之后才显现，则记录在一个引用它的简短加速移除 SEP 中。缩短后的窗口 MUST 仍至少提供特性变为 Deprecated 与其最早移除之间九十天的间隔。

### 角色

| 动作                                         | 由谁执行                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| 提议弃用、延长或恢复                           | 任何贡献者，依 SEP 流程                                                             |
| 发起人                                       | 维护者或核心维护者，依 SEP 流程                                                     |
| 批准弃用 SEP                                 | 核心维护者，依[治理决策流程][governance-decisions]                                 |
| 在发布准备期间决定是否移除                     | 核心维护者，依[治理决策流程][governance-decisions]                                 |
| 批准延长或恢复 SEP                            | 核心维护者，依[治理决策流程][governance-decisions]                                 |
| 批准加速移除                                 | 核心维护者，依[治理决策流程][governance-decisions]                                 |

与所有核心维护者决策一样，首席维护者保留对上述每项批准的否决权，依据[治理角色][governance-roles]定义。

[governance-roles]: https://modelcontextprotocol.io/community/governance#roles

### 迁移

在本政策存在之前，规范中已经有两个特性被描述为 deprecated（见[动机](#motivation)）。当本 SEP 达到 Final 时，它们将被归类为 Deprecated，并被加入[注册表](#the-deprecated-registry)；[弃用特性](#deprecating-a-feature)中的弃用 SEP 要求不具有追溯适用性。在每种情况下，弃用决定都早于本政策；本节将其用新词汇记录下来，使“deprecated”和“soft-deprecated”这两个术语在今后具有单一且明确的含义。

这两个特性在本 SEP 之前很早就已公开弃用，因此最短弃用窗口在实践中实际上已经满足；把它们的时钟重锚到未来的修订版发布将重新开启生态已经经历过的窗口。因此，从本 SEP 达到 Final 之日起，它们各自获得三个月的宽限期，之后才有资格被移除，这与[加速移除](#expedited-removal)条款为最短允许窗口设定的下限一致。移除仍遵循[移除特性](#removing-a-feature)：由核心维护者在发布准备期间作出决定，而不是在宽限期结束时自动发生。

| 特性                                            | 迁移目标                               | 最早移除时间                         |
| ----------------------------------------------- | -------------------------------------- | ------------------------------------ |
| HTTP+SSE transport                              | [可流式 HTTP][transports-compat]       | 在本 SEP 变为 Final 三个月后         |
| `includeContext: "thisServer"` / `"allServers"` | 省略该字段或使用 `"none"`              | 跟随 Sampling ([SEP-2577][sep-2577]) |

`includeContext` 是 `sampling/createMessage` 的一个参数。[SEP-2577][sep-2577] 将 Sampling 特性整体弃用；受影响的两个 `includeContext` 值遵循该特性的弃用时间表，而不是拥有独立的移除时钟，并且最迟会与 Sampling 本身一起被移除。

这种“祖父条款”仅适用于在本 SEP 达到 Final 当日，规范中已经被描述为 deprecated 的特性。此后所有弃用都完整遵循[弃用特性](#deprecating-a-feature)，而这些祖父特性的移除也将毫无例外地遵循[移除特性](#removing-a-feature)。

当本 SEP 达到 Final 时，以下内容会直接落入 `draft/`，不设单独的实现门槛：更新[版本控制指南][versioning]以引用本政策；创建 `deprecated.mdx` 并以上述两个特性为初始内容；在 `changelog.mdx` 中增加 “Deprecated” 标题并写入这两条记录；以及每个特性都获得 [弃用特性](#deprecating-a-feature)中描述的 `@deprecated` schema 注解和正文通知。对于 `includeContext`，注解作用于整个属性，因为无法在字符串字面量联合类型的单个取值上表达逐值 `@deprecated` 标记；HTTP+SSE 传输没有 `schema.ts` 类型，因此只在传输正文中进行注解。

## 理由

### 为什么要将状态模型与规范修订分开？

[版本指南][versioning] 已经为规范 _修订_ 定义了 Draft、Current 和 Final。这些状态描述的是整份文档的编辑成熟度，并未说明 Current 修订中的某条消息或某个字段是否即将被淘汰。[Kubernetes 弃用策略][k8s-deprecation]、[Node.js 弃用周期][nodejs-deprecation] 以及 IETF 的实践（例如 [RFC 8996][rfc-8996]，它在 TLS 协议族中将 TLS 1.0 和 1.1 标记为弃用）都基于这一原因，在发布版本管理之外同时维护特性级别的弃用规则。

### 为什么需要一个 SEP 来弃用，但不需要一个 SEP 来移除？

需要社区审查的权衡，是决定退役某个特性以及选择迁移路径；这正是弃用 SEP 所承载的内容。一旦它进入 Final，项目就已经承诺会移除，并确定了最早日期，因此按计划执行该决定并不需要新的判断，为此再做第二个 SEP 纯属为了流程而流程。这个有意的维护者决定仍然存在，表现为发布准备阶段的移除决定及其在[移除某个特性](#removing-a-feature)中的确认，这与 [SEP-1730][sep-1730] 中的层级晋升流程相呼应：在那里，晋升是维护者的决定，而不是计时器到期。SEP 只保留给那些会改变已承诺结果的情况：延长窗口、恢复特性，或出于安全风险而缩短下限。这使流程与 [SEP 指南][sep-guidelines] 保持一致：对协议表面范围的变更值得提交 SEP，但不要求再用一个 SEP 去批准已经做出的变更。

### 为什么是十二个月？

[NYC 维护者会议][nyc-2026-03-31]提出了“支持一年 + 弃用一年”的模型，并记录了在代理式领域变化如此迅速的情况下，不愿承诺更长窗口的态度。同一讨论还指出，即便是这个模型，也可能给 SDK 维护者带来负担；本 SEP 仍保留十二个月的下限，因为移除是允许性的而非自动的（参见[移除某个特性](#removing-a-feature)），所以只要生态系统需要，特性就会保持 Deprecated，而不是让 SDK 为了追赶日历而仓促行动。从修订发布而不是从 SEP 日期开始计算窗口，可以使其可观察：这与 SDK 作者和实现者已经用于跟踪该修订本身的时钟是同一个。由于弃用只会在其修订发布时生效，因此在同一修订中引入的替代方案已经在十二个月窗口本身内得到验证；为此不需要单独的先前修订。该窗口至少覆盖了同一次会议中讨论的六个月发布周期中的两个：一个供 SDK 维护者发布迁移支持，另一个供下游采用。核心维护者可以让特性保持 Deprecated 更久；十二个月是最低要求。

### 与 SEP-1400（语义化版本）的关系

[SEP-1400][sep-1400] 提议用语义化版本替代基于日期的修订标识符。这两个提案解决的是不同问题：SEP-1400 关注修订如何编号，而本 SEP 关注修订中的特性如何退役。本 SEP 将移除窗口从修订的 _release_ 而不是修订的 _identifier_ 开始计算，因此不依赖标识符方案；无论修订是按日期编号还是按语义版本编号，它都同样适用。

### 共识

方向已在 [NYC 维护者会议（2026 年 3 月 31 日）][nyc-2026-03-31] 上达成一致，并在 [2026 年 4 月 1 日核心维护者会议][cm-2026-04-01] 上得到确认，会议记录为“正式版本状态和 SDK 弃用周期（方向已达成一致，机制待定）”。社区需求可见于 [讨论 #2177][disc-2177]（询问 SSE 何时移除）以及 [讨论 #1980][disc-1980]（请求取消一个早已失去用途的向后兼容性要求）。

## 向后兼容性

本 SEP 引入的是一个流程，不改变协议行为。[过渡](#transition)部分为两个已经非正式弃用的特性分配了 Deprecated 状态和最早移除时间。二者都没有明确的移除日期，因此将时间线显式化（对于生态系统已经有超过一年时间可迁移离开的特性，仅提供三个月宽限期）并不会缩短任何实现者已获得的承诺。

## 安全影响

未发现。本变更属于治理层面的变更，不涉及新的协议表面、传输、认证流程或信任边界。明确定义的弃用路径具有间接的安全收益：它为项目提供了一个可预测的机制，用于退役后来被发现不安全的特性，这正是[加速移除](#expedited-removal)条款的用途。

## 参考实现

本 SEP 定义的是一个流程，没有参考实现。将该策略应用于两个现有非正式弃用项的规范编辑已在[过渡](#transition)中描述，并会在本 SEP 进入 Final 时直接落入 `draft/`。

---

## 开放问题

- **规范修订支持窗口。** NYC 会议还讨论了 Tier 1 SDK 需要支持某个规范 _修订_ 多久（这与支持修订中的某个特性不同）。该政策应写入对 [SEP-1730][sep-1730] 的修订中，但它决定了本策略中的弃用窗口在实践中是否可观察。如果 Tier 1 SDK 只支持最新修订，那么在两个版本之间更新 SDK 的使用方，可能会直接从一个早于弃用的版本跳到一个晚于移除的版本，从未在 [Tier 1 SDK 义务](#tier-1-sdk-obligations)中看到 Deprecated 标记。要求 Tier 1 SDK 支持在一个回溯窗口内发布的所有 Current 修订，并且该窗口至少等于十二个月的弃用下限，可以消除这一缺口。应与本 SEP 一并推进 SEP-1730 的修订。
- **“可忽略采用率”标准的数据来源。** 该策略允许基于采用情况进行弃用，但项目目前没有共享遥测数据。在有共享遥测之前，这一标准依赖 SDK 维护者的证明。
- **特性成熟度层级。** 本 SEP 对每个 Active 特性都采用统一的十二个月下限。[Kubernetes 弃用策略][k8s-deprecation] 使用 alpha/beta/GA 分层，并为不成熟的特性设置更短窗口，这本可以让 [动机](#motivation) 中提到的 JSON-RPC 批处理回退无需整整一年的弃用期。MCP 是否应采用一个具有更短或零窗口的 Experimental 层级，留待后续 SEP 决定。
- **线级弃用信号。** [Tier 1 SDK 义务](#tier-1-sdk-obligations) 会把弃用警告放入官方 SDK；那些不使用 SDK 且不阅读变更日志的实现者，在移除前仍然收不到警告。线级信号（例如在响应中加入 `_meta` 弃用字段，类似 Kubernetes 的 `Warning` 头）可以消除这一缺口，但这属于 Standards Track 的变更，超出本 Process SEP 的范围。

[transports-compat]: https://modelcontextprotocol.io/specification/draft/basic/transports#backwards-compatibility
[sampling-includecontext]: https://modelcontextprotocol.io/specification/draft/client/sampling
[versioning]: https://modelcontextprotocol.io/docs/learn/versioning
[design-principles]: https://modelcontextprotocol.io/community/design-principles
[sep-guidelines]: https://modelcontextprotocol.io/community/sep-guidelines
[governance-decisions]: https://modelcontextprotocol.io/community/governance#decision-process
[sep-1730]: https://modelcontextprotocol.io/seps/1730-sdks-tiering-system
[sep-1730-relegation]: https://modelcontextprotocol.io/seps/1730-sdks-tiering-system#tier-relegation-process
[sep-1400]: https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1400
[issue-1540]: https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1540
[sep-2577]: https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging
[nyc-2026-03-31]: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2547
[cm-2026-04-01]: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2536
[disc-2177]: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2177
[disc-1980]: https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/1980
[k8s-deprecation]: https://kubernetes.io/docs/reference/using-api/deprecation-policy/
[nodejs-deprecation]: https://nodejs.org/api/deprecations.html
[rfc-8996]: https://www.rfc-editor.org/rfc/rfc8996
