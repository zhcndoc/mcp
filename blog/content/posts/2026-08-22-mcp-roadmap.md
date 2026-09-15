---
title: "MCP 新路线图"
date: "2026-08-22T09:00:00+00:00"
publishDate: "2026-08-22T09:00:00+00:00"
slug: mcp-roadmap
description: "Model Context Protocol 路线图及即将发布的规范版本重点领域更新"
author:
  - David Soria Parra（首席维护者）
  - Den Delimarsky（首席维护者）
tags:
  - mcp
  - roadmap
  - community
  - governance
  - working-groups
ShowToc: true
---

今天，我们很高兴发布 Model Context Protocol（MCP）的更新版[路线图](https://modelcontextprotocol.io/development/roadmap)，涵盖下一次规范发布及更长远的规划。

它确定了未来几个月协议工作的方向，由核心维护者与我们的维护者社区和工作组共同制定。

{{< button text="探索路线图" url="https://modelcontextprotocol.io/development/roadmap" target="_self" >}}

## 回顾

[之前发布的路线图](/posts/2026-mcp-roadmap/)于 3 月发布，包含四个优先领域：**传输演进与可扩展性**、**智能体通信**、**治理成熟度**以及**企业就绪性**。在过去五个月中，我们在所有这些领域都取得了显著进展。

大部分变更都在 [2026-07-28 规范发布版本](/posts/2026-07-28/)中落地——你可能已经在我们的 SDK 和文档中看到它们。改进内容涵盖从细微修改到重大的协议改造。

我们交付的最大变更之一，是协议层面的会话和初始化握手已经取消，因此服务器可以在无需保存状态的情况下进行水平扩展（[SEP-2575](https://modelcontextprotocol.io/seps/2575-stateless-mcp)、[SEP-2567](https://modelcontextprotocol.io/seps/2567-sessionless-mcp)）。此外，客户端现在可以调用 `server/discover`，在执行其他操作之前了解服务器支持的版本和能力。列表结果也可以缓存（[SEP-2549](https://modelcontextprotocol.io/seps/2549-TTL-for-list-results)）。

在智能体通信方面，我们根据早期采用者的反馈重新设计了 Tasks——将其移入官方扩展（[SEP-2663](https://modelcontextprotocol.io/seps/2663-tasks-extension)）。全新的多轮往返请求模式（[SEP-2322](https://modelcontextprotocol.io/seps/2322-MRTR)）取代了服务器发起的请求，使引导和类似流程能够在无状态服务器上运行。

[Server Card 工作组](https://modelcontextprotocol.io/community/working-groups/server-card)继续推进 MCP 服务器的 `.well-known` 元数据约定，使服务器无需连接即可被发现并进行推理。

治理同样得到了发展。我们正式采用了[贡献者阶梯](https://modelcontextprotocol.io/community/contributor-ladder)，工作组现在会在各自领域对 SEP 进行分诊，规范也拥有了正式的[功能生命周期和弃用政策](https://modelcontextprotocol.io/community/feature-lifecycle)，`2026-07-28` 版本中的弃用项是首批遵循该政策的内容。

在上一发布周期中，企业就绪性工作的重点是安全性，正如预期，大部分工作都以授权改进的形式实现：发行方验证、与发行方绑定的客户端凭证，以及作为客户端首选注册路径的客户端 ID 元数据文档（CIMD）；同时，[企业托管授权](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization)也作为扩展提供（该扩展也[现已稳定](/posts/enterprise-managed-auth/)）。

这是在极短时间内取得的重大进展。更新后的路线图将从这里继续推进。

## 优先领域

新路线图围绕五个优先领域组织。其中有几个领域承接了[上一版路线图](/posts/2026-mcp-roadmap/)中列为未来规划的工作，包括服务器发起的事件、结果类型改进和智能体身份；这些工作已经成熟到足以各自成为优先事项。每个领域都有负责该领域的一组核心维护者以及一个或多个工作组。

![MCP 路线图：五个优先领域——智能体消息传递原语、基于 HTTP 的原生传输统一与强化、智能体身份与企业级安全性、改进的原语以及改进的 SDK 开发者体验。](/posts/images/roadmap/priority-areas.svg)

### 智能体消息传递原语

现代智能体工作负载已经不再适合标准的[请求—响应模式](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns)。循环可以运行更长时间，服务器可以推送流式结果，而且显然需要在工作执行过程中进行调整。MCP 一直在发展以满足这些要求，引入了 [Tasks](https://modelcontextprotocol.io/extensions/tasks/overview)、[`subscriptions/listen`](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)和[进度通知](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)。我们希望确保不仅提供适合任务的正确原语，还要让它们能够良好协同。这里的工作涵盖服务器发起的事件（包括 webhook 和通道，使客户端无需持续轮询结果）、对 [Agents](https://modelcontextprotocol.io/community/working-groups/agents)、传输以及[触发器与事件](https://modelcontextprotocol.io/community/working-groups/triggers-events)工作组之间组合方式的审查，以及让 Tasks 扩展（[SEP-2663](https://modelcontextprotocol.io/seps/2663-tasks-extension)）更加成熟，从而能够进入规范。

### 基于 HTTP 的原生传输统一与强化

随着 [2026-07-28 版本](https://modelcontextprotocol.io/specification/2026-07-28/changelog)的发布，远程 MCP 服务器现在与任何其他 HTTP 工作负载没有区别，因此可以轻松地在开发者和组织已经用于 API 与服务的任何基础设施上托管和运行。事实证明，这种方式能够很好地扩展，我们希望将其覆盖到其他部署模式，包括通过 [stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)使用 [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)进行通信的本地服务器。统一使用一种传输方式，可以进一步简化 MCP 服务器和客户端的开发。

### 智能体身份与企业级安全性

如今的 [MCP 授权](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)围绕用户在浏览器中批准访问构建。这对于交互式客户端而言运行良好，但越来越多的调用方是作为云工作负载运行、拥有自身身份的智能体，它们代表不在场的用户执行操作，或将更细粒度的权限委派给子智能体。我们希望 MCP 服务器拥有一种标准化方式来识别并信任这些智能体身份，并以现有标准为基础，而不是依赖直接粘贴的 API 密钥和长期令牌。

这里的工作包括完成[持有证明](https://www.rfc-editor.org/rfc/rfc9449)（DPoP）并推动其采用，以及通过[工作负载身份联合](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1933)、[企业托管授权](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization)背后的 ID-JAG 授权和标准令牌交换，为智能体身份与委派定义一条明确的路径。我们还将继续加强与 OAuth 标准组织的合作，包括 IETF OAuth 和 [WIMSE](https://datatracker.ietf.org/wg/wimse/about/) 工作组，帮助底层标准随着智能体身份所需的构建模块一同演进。

### 改进的原语

工具调用是大多数开发者最先接触的 MCP 部分，并且在整个协议生命周期中表现良好。然而，结果处理仍有一些不足。一个 [`tools/call`](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#tool-result) 响应可以以多种形式承载相同输出，而如今服务器开发者无法知道特定客户端会将哪种形式呈现给模型。我们的目标是通过制定一个清晰且统一的契约来简化这一点。

我们需要解决的另一个原语挑战是其不断增长的规模。连接到一个拥有一百个工具的服务器，意味着模型在用户提出任何问题之前就要为整个工具面付费，而且随着列表增长，工具选择往往会变差。我们正在启动渐进式发现工作，使服务器能够提供一个小型入口，并随着对话范围逐渐明确而展示更多目录内容。

### 改进的 SDK 开发者体验

我们的 SDK 是开发者体验 MCP 的方式。我们正在投入改进其易用性以及[与规范的一致性](https://modelcontextprotocol.io/community/sdk-tiers#conformance-testing)，并让它们在我们支持的每个平台和语言上都直观易用、文档完善。现在这一点更加重要，因为许多开发者会让智能体指向我们的库来构建 MCP 客户端和服务器，此时清晰的 API 和准确的文档决定了代码能否以最少的阻碍正常运行。

## 提案优先级

属于这些优先领域的[规范增强提案](https://modelcontextprotocol.io/community/sep-guidelines)（SEP）将获得加速审查，并最有可能被接受。不属于这些领域的提案不会被自动拒绝，但维护者的审查时间有限，会优先投入这些领域。

如果你正在考虑提出 SEP，请确定它所属的优先领域，与相关[工作组](https://modelcontextprotocol.io/community/working-interest-groups)沟通，并与其成员合作完善提案。[路线图](https://modelcontextprotocol.io/development/roadmap)中的每个领域都会列出负责该领域的核心维护者，任何有兴趣参与贡献的人都可以通过 [Discord](https://modelcontextprotocol.io/community/communication#discord)联系他们。我们期待与社区合作，审查并完善支持这一路线图的提案。

## 参与其中

上面的每个优先领域背后都有一个工作组，或正在围绕它组建工作组，而且所有工作组都欢迎更多贡献者参与。参与方式有很多：

- **加入工作组或兴趣组**：参阅[工作组和兴趣组](https://modelcontextprotocol.io/community/working-interest-groups)页面以及[社区频道](https://modelcontextprotocol.io/community/communication)
- **提出 SEP 或发表评论**：阅读 [SEP 指南](https://modelcontextprotocol.io/community/sep-guidelines)，然后提交提案或发表意见
- **开始一个实验性扩展**：[SEP-2133](https://modelcontextprotocol.io/seps/2133-extensions)允许任何工作组或兴趣组在正式提交 SEP 之前，于 `experimental-ext-` 仓库中进行实验
- **直接贡献**：[贡献指南](https://modelcontextprotocol.io/community/contributing)涵盖规范、SDK 和工具

我们期待与大家一起发展并推动 MCP 演进！
