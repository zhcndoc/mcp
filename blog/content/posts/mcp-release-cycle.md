---
title: "让 MCP 的发布周期更加可预期"
date: "2026-11-11T09:00:00+00:00"
publishDate: "2026-11-11T09:00:00+00:00"
slug: mcp-release-cycle
description: "我们将调整 MCP 发布规划方式。Luca Chang 将加入 Den Delimarsky 和 David Soria Parra，担任下一规范周期的发布经理。"
author:
  - Den Delimarsky（主要维护者）
  - David Soria Parra（主要维护者）
tags:
  - mcp
  - specification
  - community
ShowToc: true
---

过去两年里，我们花了大量时间讨论如何改进 MCP、添加新功能和能力，以及建立更可预期的发布节奏。维护者和更广泛的开发者社区显然都[提出了许多想法](https://modelcontextprotocol.io/development/roadmap)。让这些想法经过审查、实现和测试，最终纳入版本发布，则是另一项工作。我们希望让社区更容易了解这一过程。

对于提案作者来说，这意味着能提前知道何时审查，以及有多少时间进行调整。SDK 维护者也需要知道规范何时冻结，因为客户端和服务器开发者都会以我们的开发工具链为起点，试用新的 MCP 能力并分享反馈。为了让这个过程更清晰，我们正在为后续规范变更建立更一致的时间表，免得大家还要从会议记录和 GitHub 讨论串中拼凑日程。

核心维护者在 MCPCon Europe 上共同讨论了这些问题，[Kurtis Van Gent](https://github.com/kurtisvg)最近在 [SEP-3398：发布周期更新](https://modelcontextprotocol.io/seps/3398-release-cycle-updates)中记录了这一流程。今后，这将作为我们实际采用的发布指南。

基于这项工作，我们将让 MCP 规范**每六个月定期发布一次**。

<a id="two-releases-a-year" />
## 每年发布两次

通常，我们会在**每年 3 月和 9 月的最后一个星期二**发布规范。我们会同时公布各次发布的提案截止日期和 SDK Beta 日期，方便你据此倒推自己的实现和测试计划。

下一次发布的目标日期是 **2027 年 3 月 30 日**；届时预计会发布 MCP 版本 `2027-03-30`。

为了确保日程可预期，尚未准备好的提案会顺延至后续版本，而不会拖延整个规范的发布。提案作者可以从容继续完善，其他人也能按既定计划准备发布。

{{< note >}}
这项调整只改变发布准备方式，不会改变 MCP 消息或版本协商，因此现有客户端和服务器无需因本公告而作任何修改。规范版本仍将使用日期标识。
{{< /note >}}

<a id="introducing-the-release-manager-role" />
## 引入发布经理角色

准备规范发布需要提案作者、工作组以及多个 SDK 的维护者各自完成工作。我们需要有人跟进项目各处的进展，发现团队间的依赖，并在截止日期前协助解决问题。我们将这些职责正式确立为发布经理角色。

在整个周期中，我们会与提案作者和 SDK 维护者协作；**[Luca Chang](https://github.com/LucaButBoring)** 将与 David 和我一起担任下一规范周期的发布经理。

如果你还不认识 Luca，他是 [Tasks 最初提案](https://modelcontextprotocol.io/seps/1686-tasks)的共同作者之一。该提案在 2025 年 11 月的规范中引入了对长时间运行任务的实验性支持。之后，他又与 Caitie McCaffrey 合作推进这一能力的下一版，也就是 [Tasks 扩展](https://modelcontextprotocol.io/seps/2663-tasks-extension)。

Luca 还共同领导 [Tasks 与 Events 工作组](https://modelcontextprotocol.io/community/working-groups/tasks-events)，并召集 [Agents 兴趣组](https://modelcontextprotocol.io/community/interest-groups/agents)。这些工作赢得了社区的信任，我们期待与他共同准备下一次发布。

欢迎加入，Luca！

我们三人将协助提案进入审查队列，规划和管理 SDK 实现工作，并跟进规范发布前需要处理的事项。核心维护者团队将继续决定哪些提案纳入下一版本。

<a id="what-happens-between-releases" />
## 两次发布之间的安排

提案作者需要时间完善想法并回应审查意见，SDK 维护者也需要时间实现和测试已接受的变更。因此，我们会在常规版本发布前八个日历月开始规划。版本仍每六个月发布一次，所以下一版本的规划会与当前版本最后两个月的工作重叠。

[![2027-03-30 和 2027-09-28 规范目标的时间表，显示 3 月稳定和 9 月计划之间的两个月重叠、第 1 层 SDK 测试版、软冻结和硬冻结以及六个月的发布节奏。](/posts/images/mcp-release-cycle/timeline.png)](/posts/images/mcp-release-cycle/timeline.png)
即将到来的三月版本_只是有点不同_，因为一些计划已经在今年八月初完成。对于接下来的常规周期，时间表通常会细分如下：
- **发布前八个月：**开始规划，收集维护者和工作组的反馈，确定工作重点及相互依赖关系。
- **发布前六个月：**核心维护者开始审查提案，并持续至软冻结。
- **发布前两个半月：**软冻结。计划纳入本次规范发布的所有提案都必须标记为 Final 并完成合并。硬冻结前仍会接受既有提案范围内的修复、润色和澄清；不再接受新功能或大幅重新设计。
- **发布前一个半月：**支持冻结版规范的 [Tier 1](https://modelcontextprotocol.io/community/sdk-tiers) SDK Beta 版本发布。
- **发布前一个月：**硬冻结。只有严重安全修复，或会阻碍发布的正确性与互操作性缺陷修复，才能经核心维护者全体投票批准后纳入规范。
- **发布日：**发布规范、发布说明和实现指南。Tier 1 SDK 必须提前提供稳定支持。如果某个 SDK 延迟，我们会记录这一差距，但不会因此推迟规范发布日期。

我们认为，软冻结能让 SDK 维护者获得一组稳定的变更以供实现，而 Beta 版本则能让客户端和服务器开发者共同测试这些实现。硬冻结之后的最后一个月将用于发布检查，只有上述紧急变更才能纳入规范。

最后，SDK Beta 发布后，我们欢迎更广泛的 MCP 社区使用现有客户端和服务器进行试用。这是发现临近发布问题的好机会，也能让维护者在修复仍可纳入版本时处理报告的缺陷或不一致之处。

<a id="get-involved" />
## 参与其中

如果你有改进 MCP 的想法，欢迎带到[工作组](https://modelcontextprotocol.io/community/working-interest-groups)，与其他贡献者一起完善。加入讨论不需要先准备好完整提案，更不必等到下一个发布周期。

提案准备好接受正式审查后，工作组或核心维护者团队可以为其担保，使其进入 [SEP 审查队列](https://voting.modelcontextprotocol.io/p/seps)。你也可以通过测试 SDK 原型，或对正在推进的提案分享反馈来参与。

这些调整旨在让 MCP 贡献和开发工作更易于规划，无论它是你工作的一部分，还是你独立进行的项目。

如果你正在考虑[为协议做贡献](https://modelcontextprotocol.io/community/contributing)，欢迎[来和我们交流](https://modelcontextprotocol.io/community/communication)；我们期待你的参与！
