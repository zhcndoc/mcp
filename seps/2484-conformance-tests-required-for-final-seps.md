# SEP-2484：要求标准轨道 SEP 在达到最终状态前必须通过一致性测试

- **状态**：草案
- **类型**：流程
- **创建时间**：2026-03-27
- **作者**：Paul Carleton (@pcarleton)
- **赞助人**：无
- **PR**：https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2484
- **取代**：SEP-1627（Conformance Testing）

## 摘要

本 SEP 为标准轨道 SEP 的 `Accepted → Final` 过渡增加了一项一致性测试要求。对于任何会改变可观察协议行为的标准轨道 SEP，在其可标记为 `Final` 之前，必须先将覆盖其规范性要求的一致性场景合并到一致性仓库中，并附带一份结构化的可追溯性文件，将每一条 MUST/MUST NOT 和 SHOULD/SHOULD NOT 映射到某个检查项或一项有文档说明的排除项。这样可以使一致性套件随着规范演进保持同步，为 SDK 维护者提供可执行的实现目标，并使 SEP-1730 的分级百分比成为衡量规范覆盖率的有意义指标。流程类和信息类 SEP 以及不具有可观察协议行为的标准轨道 SEP 不在此列。

## 动机

### 规范与实现之间的缺口

MCP 规范是用英文写的。SDK 维护者把这些英文翻译成代码，而每一次翻译都可能产生偏移。SEP-1730（SDK 分级）已经依赖一致性测试（1 级要求 100% 通过率，2 级要求 80%），但目前没有机制确保测试套件与规范保持同步。当一个 SEP 达到 `Final` 时，SDK 维护者会根据描述性文本实现功能，并希望自己对其含义的理解与其他所有 SDK 保持一致。一致性测试往往会在之后才出现，甚至根本不会出现；而当它们出现时，有时会揭示出两个“兼容”的 SDK 之间其实存在分歧。

### 为什么现有的参考实现要求还不够

**参考实现**证明某个功能“能被构建出来”：它体现的是一种有效解释。**一致性测试**定义了每个实现“必须做什么”：它把规范性要求变成可执行断言。一个 TypeScript 参考实现对 Rust 维护者而言，并不能说明他们的代码是否正确。而一致性测试会明确告诉他们；当它不能明确时，分歧本身就暴露出规范中的歧义。

### 让一致性套件持续演进

一致性套件是 SEP-1730 各级百分比所衡量的标尺。如果它落后了，一个 SDK 可能会在缺少关键规范特性的情况下仍被判定为“100% 兼容”。将测试绑定到 SEP 生命周期会形成一种推动机制：套件会与规范一样快地增长。

## 规范

### 适用范围

此要求 **仅** 适用于引入或修改 **可观察协议行为** 的标准轨道 SEP：即兼容的对端可以通过检查线上消息、可由传输层观察到的副作用（HTTP 状态码、头部、连接生命周期、OAuth 重定向），或本地传输的进程可观察副作用（stdio 流内容、退出码）来检测到的行为。

以下情况 **豁免**：

- **流程类 SEP**（治理、工作流、社区结构）
- **信息类 SEP**（指南、最佳实践，不具有规范约束力）
- **不具有可观察协议行为的标准轨道 SEP**，例如：
  - 仅对现有行为进行文档层面的澄清
  - 不会改变校验或运行时行为的 schema 注解
  - 描述实现加固而非线上协议级要求的安全建议

一致性套件本身不局限于官方 SDK。任何实现（官方 SDK、社区 SDK 或自定义部署）都可以运行它并报告兼容百分比。

### 要求

对于范围内的标准轨道 SEP，要从 `Accepted` 过渡到 `Final`，必须满足：

1. **一个一致性场景**，并带有该 SEP 编号标签，已合并到一致性仓库中，且目标是面向即将发布版本的一致性仓库草案 spec-version 标签。
2. **一份可追溯性文件** 与该场景一并提供。见下文。
3. **该场景在 SEP 的参考实现上通过**。

当该规范版本发布时，作为正常发布流程的一部分，该场景的 spec-version 标签会从草案标签更新为带日期的版本。一致性执行器和被测 SDK 都必须将草案标签识别为可协商的协议版本，以便真正执行这些新要求。

### 可追溯性文件

可追溯性文件是一个结构化文件（`sep-NNNN.yaml`），位于一致性仓库中。它将 SEP 的规范部分中的每一条规范性要求映射到执行该要求的检查项，或者记录其被排除的原因：

```yaml
sep: 1234
spec_url: https://modelcontextprotocol.io/specification/draft/section#anchor
requirements:
  - check: sep-1234-foo-present
    text: "MUST include `foo` in the response"
  - check: sep-1234-bar-absent
    text: "MUST NOT send `bar` before initialization"
  - check: sep-1234-qux-present
    text: "SHOULD include `qux` when available"
  - check: sep-1234-baz-rejected
    text: "MUST reject requests with invalid `baz`"

  - text: "MUST retry on 503"
    excluded: "Requires fault injection; not currently supported by framework"
    issue: https://github.com/modelcontextprotocol/conformance/issues/N
  - text: "MUST be rendered in a monospace font"
    excluded: "Client rendering; not observable at the protocol level"
```

结构化数据允许工具将检查失败关联回规范章节，并让一致性 CLI 按每个 SEP 报告覆盖率。

排除项分为两类。**框架缺口**（该行为可观察，但框架尚不能表达）应链接到一个跟踪 `issue`。**非协议可观察**（该要求约束的是客户端渲染、实现内部细节或类似内容）只需要 `excluded` 理由即可。若某个 SEP 的要求全部属于第二类，则该 SEP 可豁免，完全不需要场景。

赞助人负责核实可追溯性文件是否完整：SEP 规范部分中的每一条 MUST、MUST NOT、SHOULD 和 SHOULD NOT（以及 RFC 2119 等效词：SHALL、REQUIRED、RECOMMENDED）都必须有一行记录。SHOULD 级别要求对应的检查结果应报告为警告而非失败。MAY 要求不需要对应行。赞助人不审查测试代码；那是一致性仓库正常的 PR 审查流程。何为规范性要求，由赞助人裁定。

### 谁来编写测试

**赞助人** 负责确保一致性场景被写出来。场景以 TypeScript 编写；不熟悉一致性仓库的贡献者应先阅读其 [CONTRIBUTING 指南](https://github.com/modelcontextprotocol/conformance/blob/main/CONTRIBUTING.md)。实际上 SEP 作者通常最适合做这件事，因为在规范语言里编写测试会暴露出歧义，而这些歧义在 `Final` 之前修复比之后便宜得多。

### 规范文本具有权威性

一致性测试来源于规范文本，并且 **从属于** 规范文本。若测试与规范不一致，则以规范为准，测试属于缺陷。

### 一致性测试争议

如果实现者认为某个已合并的一致性测试与规范相矛盾，他们应在一致性仓库中开 issue，并引用具体的规范文本。只有当一致性维护者加上 `disputed` 标签后，该测试才被视为存在争议；在争议解决之前，这类测试不会影响 SEP-1730 的分级评估。

大多数争议会通过常规 issue 分诊解决：要么修正测试，要么澄清规范，或者带着理由关闭争议。如果分歧是根本性的（争议方与一致性维护者无法就规范含义达成一致），任一方都可以单方面升级到 Core Maintainers 请求裁定；不过，联合升级更为理想，因为目标是消除歧义，而不是争论胜负。若某个场景 PR 因非技术原因被阻塞，赞助人也可采用同样的升级路径。

### 测试稳定性与分级

SEP-1730 的分级评估基于一个**固定的一致性发布版本**，而不是一致性仓库的最新提交。对于某个 SEP 在 `Final` 之后新增到其场景中的检查项（无论是新增边界情况还是补齐此前被排除的要求），都会进入一致性仓库的主分支，但只有在下一次分级评估采用更新的一致性发布版本时，才会影响分级百分比。

这意味着 SDK 维护者在两次分级波次之间拥有稳定目标，而一致性套件可以持续演进，不会意外引发分级状态回退。

### 赞助人职责

SEP-1850 规定，在将 SEP 标记为 `Final` 之前，赞助人负责跟踪参考实现的进展。本 SEP 扩展了这一职责：对于范围内的标准轨道 SEP，赞助人还要确认带有该 SEP 编号的一致性场景已与完整的可追溯性文件一起合并，或者已在 SEP 中记录了豁免。

### 与 SEP-1730（SDK 分级）的关系

本 SEP 在不改变 SEP-1730 的分级定义或阈值的前提下，加强了其基础。分级评估使用固定的一致性发布版本，因此新检查项不会回溯性地影响分级状态。存在争议的测试在问题解决前不计入分级百分比。

覆盖现有规范行为（而非与新 SEP 绑定）的场景贡献仍然受欢迎，并且不要求附带可追溯性文件。

### 与 SEP-1627（一致性测试）的关系

本 SEP 通过接受一致性仓库作为一致性测试的规范存放地，并将其角色正式纳入 SEP 生命周期，从而 **取代** SEP-1627。SEP-1627 的 golden-trace 方法没有被沿用；场景加检查项的模型用运行时表达能力替代了与语言无关的固定夹具。SEP-1627 的协议调试器构想仍然是值得继续推进的未来工作。

## 理由

### 为什么在 `Final` 处设卡，而不是在 `Accepted` 处？

如果在 `Accepted` 处设卡，就必须在 Core Maintainers 还没有同意该功能应写入规范之前先准备测试，这会把精力浪费在被拒绝的 SEP 上。

不过，在 SEP 起草阶段编写一致性测试 _通常_ 也是有价值的：它会迫使 MUST/MUST NOT 语言更精确，并暴露出正文中一笔带过的边界情况。鼓励作者在 Core Maintainer 审查之前就起草一致性场景，尤其是那些行为要求复杂的 SEP。但这不是强制要求，因为小型 SEP 未必值得在前期投入这些工作，而被拒绝的 SEP 其测试也会白费。

将门槛设在 `Final`，恰好与参考实现要求所在的位置一致：SEP 已经达成共识，剩下的工作就是实现。

### 为什么需要可追溯性文件？

如果没有明确的覆盖标准，“有一致性测试”就会在每个 SEP 上反复争论：一个检查项够不够，还是每个 MUST 都必须覆盖？可追溯性文件让覆盖率变得可审计：每条规范性陈述都有一行记录，而每一行要么对应一个检查，要么对应一个有文档说明的排除项。“足够”就变成了“文件完整”。

这个文件也能让缺口显性化。一个有十条 MUST 但其中八条被排除的 SEP 是一种信号：要么这个 SEP 确实很难测试（跟踪 issue 说明了原因），要么测试作者提前收工了（赞助人应当提出质疑）。

### 为什么把作者责任放在赞助人身上？

赞助人已经负责推动 SEP 通过审查、跟踪参考实现并管理状态转换。再加上“确保写出一致性测试”只是对现有职责做一个很小的增量扩展，而且责任归属清晰。

### 备选方案

**要求在 SEP PR 本身中就包含一致性测试。** 被否决：这会把两个独立的审查流程与不同的维护者和 CI 绑在一起。

**只对“重大” SEPs 设卡。** 被否决：“重大”是主观的。可观察行为范围则是客观的：兼容的对端要么能检测到该变化，要么不能。

**让一致性维护者来判断是否充分。** 被否决：这会把否决权集中到一个并未被选来批准规范变更的群体手中。可追溯性文件模型允许赞助人在不阅读测试代码的情况下验证完整性。

## 向后兼容性

本 SEP **不具有追溯性**。在本 SEP 生效之前已达到 `Final` 的 SEPs 不要求添加一致性测试，不过欢迎贡献。

## 安全影响

没有直接影响。执行与安全相关行为（认证流程、输入验证、传输安全）的一致性测试有助于通过捕获回归来提升生态系统的安全态势，但本 SEP 除了底层 SEP 所要求的 MUSTs 之外，不强制要求任何特定的安全覆盖。

## 参考实现

conformance 仓库已经演示了本 SEP 形式化的场景标记模式：

- [`JsonSchema2020_12Scenario`](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/json-schema-2020-12.ts) — SEP-1613
- [`ElicitationDefaultsScenario`](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/elicitation-defaults.ts) — SEP-1034
- [`ServerSSEPollingScenario`](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/sse-polling.ts) — SEP-1699
- [`ElicitationEnumsScenario`](https://github.com/modelcontextprotocol/conformance/blob/main/src/scenarios/server/elicitation-enums.ts) — SEP-1330

结构化可追踪性文件格式以及场景脚手架工具（`npx @modelcontextprotocol/conformance new-scenario --sep <number>`）将在本 SEP 达到 `Final` 之前添加到 conformance 仓库中。

通过更新 `docs/community/sep-guidelines.mdx` 来实施这一流程变更，以便在 `Accepted → Final` 过渡中加入一致性检查（请参见本 PR 中相应的变更）。

## 进入 Final 状态的前提条件

在本 SEP 本身可以被标记为 `Final` 之前，以下 conformance 仓库工作必须完成：

- 结构化可追踪性文件格式（`sep-NNNN.yaml`）及其 schema
- 场景脚手架工具
- Conformance harness 支持将 draft 规范版本标签作为可协商的协议版本
- 已发布 `MAINTAINERS.md`，且仓库已列入 MCP 治理文档

这些是本 SEP 自身的参考实现清单，而不是持续性的流程要求。
