---
title: "2026-07-28 规范"
date: "2026-07-28T09:00:00+00:00"
publishDate: "2026-07-28T09:00:00+00:00"
slug: 2026-07-28
description: "2026-07-28 Model Context Protocol 规范已发布，带来了无状态协议核心、多轮往返请求、基于请求头的路由、可缓存的列表结果、授权加固、正式的扩展框架，以及更新后的一级 SDK。"
author:
  - David Soria Parra（首席维护者）
  - Den Delimarsky（首席维护者）
tags:
  - mcp
  - spec
  - release
  - protocol
ShowToc: true
---

自从我们[去年 11 月的发布](/posts/2025-11-25-first-mcp-anniversary/)以来，MCP 继续以惊人的速度增长。在我们的一级 SDK 中，我们看到每月下载量接近 5 亿次，而 TypeScript 和 Python SDK 的总下载量都已突破 10 亿次。短短几个月内，该协议作为智能体工作流的数据与交互基础层持续增长。

今天，我们正式按下了 MCP 规范下一版本 `2026-07-28` 的发布按钮，同时发布的还有这些 SDK，它们将帮助你立即开始构建客户端和服务器。

本次发布的亮点是无状态协议核心——MCP 正在从双向有状态协议转变为请求/响应无状态协议。这是开发者最强烈要求的功能之一，他们希望自己的 MCP 服务器能够获得更好的可靠性和可扩展性。

<video autoplay loop muted playsinline width="1280" height="454">
  <source src="stateless-core-demo.mp4" type="video/mp4">
  无状态协议核心实际运行的简短演示。
</video>

当然，这个版本还带来了更多内容：

- 每个请求都是自描述的，客户端如果希望预先获取能力，可以选择发起一次可选的发现调用，因此任何请求都可以落到普通轮询负载均衡器后面的任意实例上。
- 方法名和工具名通过 `Mcp-Method` 和 `Mcp-Name` HTTP 标头传递，因此网关可以直接基于标头进行路由和授权。
- 用于采样和引导等场景的服务器到客户端请求正在重新设计为使用多轮往返请求（MRTR），从而不再需要始终保持打开的双向流。
- 列表响应包含缓存提示和确定性顺序，因此客户端可以缓存工具目录，并在重新连接时保持上游提示缓存的稳定。
- 正式确立一个合适的扩展框架，Tasks 将与其他扩展（例如 MCP Apps 和 Enterprise Managed Authorization（EMA））一起加入其中。
- 一组授权加固改动，包括 RFC 9207 的发行方验证，以及从动态客户端注册（DCR）正式转向客户端元数据文档（CIMD）。
- 一项正式的弃用策略，设有至少十二个月的窗口期，让你可以规划升级，而不是被动应对。

TypeScript、Python、Go 和 C# SDK 也已更新以保持一致，并附有关于破坏性变更的详细迁移说明——你现在就可以开始使用新规范了。

## 发生了什么变化

### 不再有握手或会话

随着新规范版本的发布，我们正式废弃了 `initialize`/`initialized` 交互以及 `Mcp-Session-Id` 标头（参见 [SEP-2575](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575)、[SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2567)）。现在每个请求都独立传输，并在 `_meta` 中携带其协议版本、客户端身份和客户端能力。如果客户端想在执行任何操作之前了解服务器能力，可以使用新的 `server/discover` 远程过程调用（RPC）；不过这不是必需的。现在，任何请求都可以在普通的轮询负载均衡器后面的任意服务器实例上处理，而无需共享存储。

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: search

{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"search","arguments":{"q":"otters"},
 "_meta":{"io.modelcontextprotocol/clientInfo":{"name":"my-app","version":"1.0"}}}}
```

放弃协议层的会话并不意味着你的应用必须是无状态的。如果你的服务器需要在多次调用之间保留状态，可以从工具中生成一个显式句柄，并让模型将其作为参数传回。我们发现这比在传输层中隐藏会话状态效果更好——模型可以看到这个句柄，并在工具之间传递它。

### 多轮往返请求（MRTR）

MRTR 取代了之前需要保持流长连接的服务器发起请求：`elicitation/create`、`sampling/createMessage` 和 `roots/list`。

有时一个工具在调用过程中需要用户提供某些内容，例如确认或缺失的参数。MRTR（[SEP-2322](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2322)）使这种场景能够在无状态协议上实现：服务器返回 `resultType: "input_required"` 以及它需要回答的请求，客户端随后使用附带在 `inputResponses` 中的答案重试原始调用。

### 基于标头的路由

现在，流式 HTTP 请求必须包含 `Mcp-Method` 和 `Mcp-Name`（[SEP-2243](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2243)）。你的网关、限流器或 WAF 可以直接根据这些标头进行路由和计量，而无需解析 JSON 请求体。

### 列表结果可缓存

来自 `tools/list`、`prompts/list`、`resources/list` 和 `resources/read` 的响应现在会携带 `ttlMs` 和 `cacheScope`（[SEP-2549](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2549)）。这使客户端能够为响应确定最佳缓存策略，并减少不必要的重复拉取。

### 授权

在过去一年里与实现者的讨论中，我们发现授权是实现者花费最多集成时间的地方。随着这次规范修订，我们继续推动 MCP 的授权和安全态势演进。

- 授权服务器应按照 [RFC 9207](https://www.rfc-editor.org/rfc/rfc9207) 返回 `iss` 参数，且客户端在兑换代码之前必须验证它（[SEP-2468](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2468)）。这修复了授权服务器混淆漏洞。
- 客户端在动态客户端注册（DCR）期间设置 `application_type`，这样授权服务器就不会再拒绝桌面和 CLI 应用的 `localhost` 重定向了（[SEP-837](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/837)）。如果你曾经想过为什么你的 CLI 客户端 OAuth 流程会出现 `redirect_uri` 错误，这很可能就是原因。虽然我们正在将客户端 ID 元数据文档（CIMD）作为标准推进，但这也是一项加固措施，使协议符合 OAuth 规范要求。
- 客户端凭据与签发它们的发行者绑定。不能跨授权服务器复用（[SEP-2352](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2352)）。
- 动态客户端注册本身现在已正式弃用，转而使用 CIMD。为向后兼容，DCR 仍可继续工作，但将在未来版本的 MCP 规范中移除。

### 任务

任务从实验性核心中移出，进入 `io.modelcontextprotocol/tasks` 扩展，提供基于轮询的 `tasks/get` 和新的 `tasks/update`（[SEP-2663](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2663)）。变更通知从旧的 HTTP GET 端点迁移到单一的 `subscriptions/listen` 流，客户端可按通知类型选择订阅。

### 弃用项

Roots、Sampling 和 Logging 已被弃用（[SEP-2577](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2577)）。它们仍然可用，并且在至少十二个月内会继续可用。新的实现不应再采用它们。旧版 HTTP+SSE 传输也已正式被视为弃用，并有一年的过渡期。

## SDK

截至今天，四个 Tier 1 SDK 都支持 `2026-07-28`：

- [TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python](https://github.com/modelcontextprotocol/python-sdk)
- [Go](https://github.com/modelcontextprotocol/go-sdk)
- [C#](https://github.com/modelcontextprotocol/csharp-sdk)

除 Tier 1 套件外，[Rust SDK](https://github.com/modelcontextprotocol/rust-sdk) 也在 beta 中支持新规范。

这些 SDK 实现了相关 API，使你能够使用新版本规范同时构建服务器和客户端。正如我们在 [SDK beta 博客文章](/posts/sdk-betas-2026-07-28/) 中提到的，迁移会有一些成本，尤其是对那些确实依赖会话标识符的开发者而言；不过，我们吸收了早期测试反馈，让这一过程变得容易得多。

## 生态系统支持

与任何大型发布一样，我们围绕 MCP 所做的工作离不开生态系统中各方的贡献。我们也特别感谢许多贡献者和合作伙伴，他们在规范正式发布之前帮助我们进行了测试和验证。

{{< quotes >}}
{{< quote name="David Soria Parra" title="技术团队成员，MCP 联合发明者" company="Anthropic" logo="anthropic.svg" >}}
这次新发布是 MCP 自一年前远程 MCP 首次推出以来最重要的一次。它在服务可扩展的 MCP 服务器方面实现了飞跃，并吸收了过去 18 个月中积累的所有经验，为 MCP 的未来提供了坚实的基础。新加入的扩展展示了更广泛开源项目中的持续创新。我很期待看到人们会用 MCP 的新能力做出什么。
{{< /quote >}}
{{< quote name="Alex Salazar" title="首席执行官兼联合创始人" company="Arcade.dev" logo="arcade.svg" >}}
这次发布是迄今为止最明确的信号，表明 MCP 正在成为真正可用于生产的基础设施。最大的变化都是破坏性变更，而社区选择直面这些难题，而不是用表面修补来掩盖缺口。这与我们在合作的企业中看到的情况一致：MCP 已经成为这些团队默认的构建基础，而这次发布正是他们一直在等待的成熟阶段。这是一个围绕生产团队真正需求而实时成长的协议，也是对任何构建企业智能体的人来说向前迈出的一步。
{{< /quote >}}
{{< quote name="Swami Sivasubramanian" title="智能体 AI 副总裁" company="AWS" logo="aws.svg" >}}
AWS 和 Anthropic 致力于支持 MCP 社区，并帮助开发者大规模交付企业级智能体。借助新的 MCP 规范及其无状态协议核心在 Amazon Bedrock AgentCore 中的可用性，开发者可以在标准、可扩展的基础设施上部署 MCP 服务器，而无需管理会话或持久连接。Tasks 是首批官方 MCP 扩展之一，由 AWS 贡献，它为可靠、长时间运行的智能体提供支持，因此开发者可以把更少的时间花在基础设施上，把更多时间用于创新。
{{< /quote >}}
{{< quote name="Brendan Irvine-Broque" title="高级产品管理总监" company="Cloudflare" logo="cloudflare.svg" >}}
MCP 2026-07-28 是迈向让智能体基础设施像 Web 其他部分一样运作的重要一步：无状态、可缓存、可路由，并且具备全球可扩展性。Cloudflare 的 Agents SDK 从第一天起就支持该规范，因此开发者可以直接在 Workers 中运行 MCP 服务器，无需传输会话开销即可调用工具，并启用诸如用于审批的 elicitation 等更丰富的流程。由于 MCP 是开放标准，像 Sentry 和 Linear 这样的 Cloudflare 客户可以在第一天就采用它，并立即将这些改进交付给他们的用户。
{{< /quote >}}
{{< quote name="Josh Clemm" title="工程副总裁" company="Figma" logo="figma.svg" >}}
越来越多的构建者正在使用我们的 MCP 服务器，将生成的输出带入 Figma 画布，在那里他们可以与团队一起探索、迭代和完善，打造出脱颖而出的产品。随着这种用法的增长，我们的无状态架构也能随之扩展，而借助 MCP Apps、Tasks 和企业托管授权，我们还能做更多事情，让设计与代码保持在一个连贯的流程中。
{{< /quote >}}
{{< quote name="Anna Berenberg" title="工程研究员" company="Google Cloud" logo="google-cloud.png" >}}
2026-07-28 版 Model Context Protocol 的发布，代表着企业 AI 可扩展性向前迈出了一大步。通过演进为无状态架构，这一规范消除了大规模部署智能体工作流的阻力。在 Google Cloud，我们很高兴能在我们的开发者工具生态系统中利用这些强大的新能力。这次发布提供了稳健、安全且可扩展的基础，而我们的客户（以及我们自己的团队）需要它来构建下一代 AI 应用，我们也很自豪能继续共同塑造这一开放标准的未来。
{{< /quote >}}
{{< quote name="Austin Parker" title="AI 战略总监" company="Honeycomb" logo="honeycomb.svg" >}}
在 honeycomb.io，我们已经看到了 MCP 的惊人采用率——现在几乎 20% 的每月交互式查询都是由智能体发出的！新的规范发布使我们能够在企业规模运行的同时，支持诸如 elicitation 之类的更高级功能。
{{< /quote >}}
{{< quote name="Enrico Toniato" title="CTO" company="Manufact" logo="manufact.svg" >}}
新版 MCP 规范证明了维护者确实在倾听社区反馈。它解决了我们在 Manufact 遇到的真实问题，无论是在 mcp-use（我们的开源框架）中，还是在我们托管数千个 MCP 服务器的 Manufact Cloud 上。为 mcp-use 提供支持的新 SDK v2，借助新的客户端-服务器拆分，帮助我们将包体积缩小了约 83%，同时让速度提升了 25%。而随着 MCP 变为无状态，我们能够以更高的可靠性、安全性和规模来处理生产流量，而无需不切实际的基础设施变通方案。
{{< /quote >}}
{{< quote name="Tina Schuchman" title="微软 Foundry 工程企业副总裁" company="Microsoft" logo="microsoft.svg" >}}
开放协议能创造出比任何一家公司单独构建更大的生态系统。MCP 是 Microsoft Foundry 的基础，使我们能够从几十个集成扩展到数千个。我们通过 Foundry toolbox 统一的 MCP 端点来利用它，将工具汇聚在一起，同时集中治理、身份和可观测性。借助无状态操作、用于长时间运行工作的 Tasks，以及企业托管身份，下一代 MCP 比以往任何时候都更容易构建安全、可扩展、可用于生产的智能体系统。
{{< /quote >}}
{{< quote name="Sean Roberts" title="应用 AI 副总裁" company="Netlify" logo="netlify.svg" >}}
2026-07-28 规范中的无状态核心使 MCP 成为一流的 HTTP 工作负载，无需再绕开会话管理。我们的客户希望 Netlify 上的 MCP 像平台的其他部分一样简单，而这项新规范从核心上解锁了这一点。将 MCP Apps 构建进新的扩展框架，是在可扩展性、可访问性以及整个生态系统能力方面迈出的巨大一步。
{{< /quote >}}
{{< quote name="Nick Cooper" title="MTS & MCP 核心维护者" company="OpenAI" logo="openai.svg" >}}
MCP 现在已经大约有一年半的历史了。得益于开发者以及与我们合作过的其他人的反馈，它正在演进为一个更成熟的协议，并吸收了数十年来 Web 协议设计的经验。与之前的修订一样，最有趣的部分将是看看人们会用它构建出什么意想不到的东西。
{{< /quote >}}
{{< quote name="Paul D'Ambra" title="产品工程师" company="PostHog" logo="posthog.svg" logo-dark="posthog-white.svg" >}}
将 MCP 迁移到无状态协议，使我们更容易扩展自己的服务，也更容易为客户的 MCP 服务器添加分析功能。这样更容易向人们展示他们的 MCP 工具是如何被使用的，以及哪些工具是他们的用户会希望使用但目前缺失的。很高兴看到这个协议朝着这个方向发展。
{{< /quote >}}
{{< quote name="Jeremiah Lowin" title="首席执行官" company="Prefect" logo="prefect.svg" >}}
对于任何大规模构建 MCP 的人来说，这都是一个里程碑式的发布。FastMCP 一直以来的目标，都是把规范中最强大的能力转化为清晰直观的开发者体验，而我们也很高兴在 FastMCP 4.0 中率先支持后台任务、无状态交互、企业身份验证等更多功能。我们的 MCP 治理平台 Horizon 从一开始就是以无状态方式构建的，以应对巨大的规模，因此看到这种方法成为协议的原生能力令人无比振奋。
{{< /quote >}}
{{< quote name="Tal Peretz" title="联合创始人兼 CPO" company="Runlayer" logo="runlayer.svg" >}}
这次发布让 MCP 比以往任何时候都更适合企业使用。Runlayer 正在把这些进步带给我们平台上的每一家企业，为在其组织内部署 MCP 和智能体提供更简单、更安全的基础。
{{< /quote >}}
{{< quote name="Craig McLuckie" title="首席执行官" company="Stacklok" logo="stacklok.svg" >}}
最新的 MCP 修订版是一个重要里程碑。它体现出的严谨程度和用户反馈表明，这一协议正在成熟，并且这种成熟让企业能够充满信心地在其基础上构建。我们已经实现了这一修订版，转向无状态模型消除了运营复杂性，并使 MCP 能够在企业规模上运行。这是一个强烈的信号，表明这个社区正在被真实的部署经验所塑造。
{{< /quote >}}
{{< quote name="Inian Parameshwaran" title="产品负责人" company="Supabase" logo="supabase.svg" >}}
支持 elicitation 一直在我们的路线图上，但由于 Supabase MCP 以无状态方式运行，这件事并不容易做到。MRTR 改变了这一点——它让我们的工具能够在执行前先与用户确认，例如在创建新项目之前确认成本，或者在执行会删除数据的查询之前确认。我们很高兴能支持 elicitation。
{{< /quote >}}
{{< quote name="Andrew Goodman" title="AI 副总裁" company="Xero" logo="xero.webp" >}}
Anthropic 将前沿模型与持续抬高标准的开发者体验结合在一起。开放的 MCP 2026-07-28 规范中的无状态核心降低了我们需要管理的复杂性，因此我们可以更快、更大规模地向客户交付更多功能。
{{< /quote >}}
{{< /quotes >}}

## 入门

我们很高兴开发者基于新的规范进行构建。要开始，请参考以下资源：

- [规范](https://modelcontextprotocol.io/specification/2026-07-28)
- [完整更新日志](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [文档和指南](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro)

## 感谢

如果没有大量社区贡献者和行业合作伙伴的支持，这个版本是不可能实现的。我们想对在规范、文档、SDK、工作组和兴趣小组等方面做出贡献的数十位关键贡献者表示感谢，同时也要感谢全球成百上千个独立社区，他们为 MCP 的支持与热情奔走呼吁。我们期待着随着协议的发展继续推动其演进！
