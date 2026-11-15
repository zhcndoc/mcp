---
title: MCP 官方 Ruby SDK 晋升 Tier 1
date: "2026-10-30T09:00:00+00:00"
publishDate: "2026-10-30T09:00:00+00:00"
slug: ruby-sdk-tier-1
description: Model Context Protocol 官方 Ruby SDK 现已达到 MCP SDK 分级体系的 Tier 1，完整支持 2026-07-28 MCP 规范，并在两个计分规范版本中均达到 100% 一致性通过率。
author:
  - Koichi Ito（Ruby SDK 维护者）
tags:
  - mcp
  - sdk
  - announcement
  - ruby
---

按照我们的 [SDK 分级体系](https://modelcontextprotocol.io/community/sdk-tiers)，[Model Context Protocol 官方 Ruby SDK](https://github.com/modelcontextprotocol/ruby-sdk)现已达到 Tier 1。Ruby SDK 并非独行，它加入了 TypeScript、Python、C#、Go 和 Rust SDK 的行列。

SDK 达到 Tier 1，意味着它进入了三级体系中的最高级别。此级别面向功能支持最完善、及时响应缺陷和安全问题，并与 MCP 生态优先事项保持一致的 SDK。如果你使用 Ruby 构建 MCP 服务器或客户端，现在可以放心：SDK 将完整支持规范功能、一致性通过率达到 100%、在新规范版本发布时同步支持，并在两个工作日内分流议题、七天内修复严重缺陷。对于负责生产级服务和应用的开发者，这一点尤其重要，因为紧跟 MCP 的最新发展对业务至关重要。

{{< button text="获取 Ruby SDK" url="https://github.com/modelcontextprotocol/ruby-sdk" >}}
{{< button text="阅读文档" url="https://ruby.sdk.modelcontextprotocol.io" >}}

<a id="full-support-for-the-2026-07-28-mcp-spec" />
## 完整支持 2026-07-28 MCP 规范

从 [`mcp` gem](https://rubygems.org/gems/mcp) 的[版本 1.2.0](https://github.com/modelcontextprotocol/ruby-sdk/releases/tag/v1.2.0)开始，MCP Ruby SDK 已完整支持 [2026-07-28 MCP 规范](/posts/2026-07-28/)。Ruby 开发者现在可以使用以下备受期待的功能与能力：

- 无状态生命周期（[SEP-2575](https://modelcontextprotocol.io/seps/2575-stateless-mcp)）与经典会话握手并行提供，其中包括 `server/discover` 和 `subscriptions/listen` 通知流。
- 多轮往返请求（[SEP-2322](https://modelcontextprotocol.io/seps/2322-MRTR)）在服务器端和客户端均可使用；内置兼容层使采用新 `input_required` 风格编写的处理程序也能继续为 2026 年前的客户端服务，无需改动。
- 现代路径会发送缓存提示（[SEP-2549](https://modelcontextprotocol.io/seps/2549-TTL-for-list-results)）；客户端会发送标准及自定义 HTTP 请求头（[SEP-2243](https://modelcontextprotocol.io/seps/2243-http-standardization)），服务器则会检查标准请求头。
- 根据 [SEP-2577](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)，Roots、Sampling 和 Logging 已标记为弃用；使用 2026-07-28 协议版本连接的客户端如果声明 Roots 或 Sampling 能力，也会收到警告。

服务器同时提供这两种生命周期，因此现有客户端可以继续工作，而使用 `2026-07-28` 的客户端则采用无状态路径。SDK 如何处理各个 MCP 规范版本，请参阅[协议版本](https://ruby.sdk.modelcontextprotocol.io/protocol-versions/)。

从 1.2.0 开始，若干 1.x 版本会拒绝早期版本曾接受的输入。SDK 的[版本策略](https://github.com/modelcontextprotocol/ruby-sdk/blob/main/VERSIONING.md)允许为修复规范一致性、安全问题和明确缺陷而进行此类更改。升级现有 1.x 应用前，建议先阅读[变更日志](https://github.com/modelcontextprotocol/ruby-sdk/blob/main/CHANGELOG.md)，确认已为可能的破坏性变更做好准备。

<a id="the-journey-to-tier-1" />
## 晋升 Tier 1 之路

7 月的 [Tier 2 评估](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3127)表明，SDK 已相当接近既定基准，十项 Tier 1 要求中已满足八项。不过还剩两项：**文档尚未覆盖所有功能**，并且**尚未商定支持新规范版本的时间表**。此后，我们做出了一些改进，使规范一致性工作更加稳健：

- 每项已实现的功能都有详细文档和配套示例，范围从非文本内容类型、elicitation 选项到完整的 OAuth 客户端流程。自[版本 1.3.0](https://github.com/modelcontextprotocol/ruby-sdk/releases/tag/v1.3.0)起，文档从仓库内简单的 `README.md` 迁移至改版后的[文档网站](https://ruby.sdk.modelcontextprotocol.io)。我们很高兴开发者能将其作为了解 Ruby MCP SDK 的首选资源。
- 按照标准 [MCP 一致性测试套件](https://github.com/modelcontextprotocol/conformance)针对各规范版本冻结的评分，SDK 在 `2025-11-25` 和 `2026-07-28` 两套要求中，服务器端和客户端的所有计分场景均达到 100% 通过率。
- 在 Tier 1 考核期内，仓库保持了 100% 的议题分流率，且没有 P0 级议题。如果你报告问题，我们会尽快查看。

如需查看标准一致性的完整证据表（包括复现测试结果的步骤），请参阅我们的 [Tier 1 评估](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3247)。

随着规范不断演进，Ruby SDK 团队承诺在下一版 MCP 规范的发布日期同步提供支持；该版本计划于 [2027 年 3 月下旬](https://modelcontextprotocol.io/seps/3398-release-cycle-updates)发布。SDK 的[路线图](https://github.com/modelcontextprotocol/ruby-sdk/blob/main/ROADMAP.md)涵盖了其他计划中的功能和扩展，包括新推出的 [Tasks 扩展](https://modelcontextprotocol.io/seps/2663-tasks-extension)。

如果你还没有注意到，这段路程虽短却相当陡峭：SDK 于 2026 年 3 月首次获评 [Tier 3](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/2340)，在 7 月随 1.0 版本达到 [Tier 2](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3127)，并于 8 月申请 Tier 1，最终在 9 月获确认。从最初到晋级不到七个月：服务器端一致性从 30 个场景中通过 25 个提升到所有计分场景全部通过，客户端一致性从未测试提升到 100%，有文档说明的功能也从 48 项中的 22 项增加到 46 项。这离不开 SDK 维护者以及一路提供意见和反馈的 Ruby 开发者社区！

另外，如果你在计算尚未编写文档的功能，目前还剩两项。其中一项是旧版 SSE 传输；由于该传输已弃用，SDK 有意不予实现。

![Ruby SDK 在 Tier 3（2026 年 3 月，v0.8.0）、Tier 2（2026 年 7 月，v1.0.0）和 Tier 1（2026 年 8 月，v1.2.0）评估中的结果，图示依次为粗糙的原石、切割后的宝石和抛光红宝石。服务器端一致性：25/30、30/30、67/67；客户端一致性：未测试、24/24、50/50；有文档说明的功能：22、34、46（共 48 项）。](/posts/images/ruby-sdk-tier-1/tier-progress.svg)

<a id="get-started" />
## 开始使用

开始使用前，将 gem 添加到应用中：

```bash
bundle add mcp
```

也可以单独运行 `gem install mcp` 进行安装。

要升级现有应用，请在 Gemfile 中设置版本约束，然后运行 `bundle update mcp`：

```ruby
gem 'mcp', '~> 1.8'
```

如果你已在运行 1.x 服务器，升级后即可在继续服务现有客户端的同时，也支持 `2026-07-28` 客户端。有关构建服务器和客户端的指南（包括 Rails 集成），请参阅 [Ruby SDK 文档](https://ruby.sdk.modelcontextprotocol.io)；基础知识概览请参阅 [1.0 版本公告](/posts/ruby-sdk-1-0/)。

<a id="give-us-your-feedback" />
## 反馈

使用 SDK 时如果遇到任何问题或异常行为，请在我们的[议题跟踪器](https://github.com/modelcontextprotocol/ruby-sdk/issues)中报告。

<a id="acknowledgements" />
## 致谢

Ruby SDK 由 [Topher Bullock](https://github.com/topherbullock)、[Koichi Ito](https://github.com/koic)、[Ateş Göral](https://github.com/atesgoral)、[Jonathan Hefner](https://github.com/jonathanhefner)以及更广泛的 Ruby 社区共同维护。感谢大家在 SDK 从 Tier 3 晋升 Tier 1 的过程中提供反馈和贡献！没有你们的支持，我们无法做到这一点。

特别感谢 [Felix Weinberger](https://github.com/felixweinberger) 和 [Paul Carleton](https://github.com/pcarleton)审查并独立验证 Tier 1 评估，也感谢 [Den Delimarsky](https://github.com/localden)进行最终审查。
