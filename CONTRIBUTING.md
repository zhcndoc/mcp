<a id="contributing-to-model-context-protocol" />
# 为模型上下文协议做出贡献

感谢您有兴趣为模型上下文协议规范、模式或文档做出贡献！

本文档概述了如何为该项目做出贡献。

另请参阅[我们文档中的总体 MCP 沟通指南](https://modelcontextprotocol.io/community/communication)，其中解释了有关更改的讨论如何以及在何处进行。

<a id="general-prerequisites" />
## 一般先决条件

需要以下软件才能处理该规范：
- Node.js 固定在 `.nvmrc` 的版本
- 打字稿
- TypeScript JSON Schema（用于生成 JSON 模式）
- [Mintlify](https://mintlify.com/)（与 npm 依赖项一起安装）
- nvm（可选，用于管理 Node 版本）

<a id="getting-started" />
### 入门

1. [分叉存储库](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)
2. 克隆你的分叉：
   ```bash
   git clone https://github.com/YOUR-USERNAME/modelcontextprotocol.git
   cd modelcontextprotocol
   ```

3.安装依赖项：
   ```bash
   nvm install  # install correct Node version
   npm ci       # install locked dependencies
   ```

4.创建新分支：
   ```bash
   git checkout -b feature/your-feature-name
   ```

<a id="schema-changes" />
## 架构更改

架构更改位于 `schema/draft/schema.ts` 中。要验证您的更改，请运行：

```bash
npm run check:schema:ts
```

`schema/draft/schema.json` 和 `docs/specification/draft/schema.mdx` 由 `schema/draft/schema.ts` 生成；不要直接编辑它们。要生成它们，请运行：

```bash
npm run generate:schema
```

<a id="schema-examples" />
### 架构示例

JSON 示例位于 `schema/draft/examples/<TypeName>/<example-name>.json`。每个文件都根据其目录命名的架构类型进行验证，并通过 `schema.ts` 中的 `@includeCode` 标记拉入架构引用。为没有任何类型的类型添加示例是一个有用的小贡献；运行 `npm run check:schema` 来验证它。

<a id="resolving-merge-conflicts-in-generated-files" />
### 解决生成文件中的合并冲突

如果您的分支与生成的文件中的 `main` 发生冲突（`schema/*/schema.json`、`docs/specification/*/schema.mdx`、`docs/seps/*.mdx`），请不要手动解决它们。合并 `main`，解决源文件中的任何冲突（例如 `schema/draft/schema.ts`），然后重新生成并提交：

```bash
git merge main
npm run generate
git add .
git commit
```

这些文件在 `.gitattributes` 中标记为 `-merge`，因此 git 保留分支的副本并将它们标记为冲突，而不是插入冲突标记。

<a id="documentation-changes" />
## 文档更改

文档以 MDX 格式编写，位于 [`docs`](./docs) 目录中。

您可以通过运行以下命令在本地预览文档更改：

```bash
npm run serve:docs
```

并用以下代码对它们进行清理：

```bash
npm run check:docs
npm run format
```

> [!注意]
> 您可以运行所有架构/文档
> 立即更改为 `npm run prep`。

<a id="blog-changes" />
## 博客更改

该博客是使用[Hugo](https://gohugo.io/installation/)构建的，位于[`blog`](./blog)目录中。

要在本地预览博客更改：

```bash
npm run serve:blog
```

<a id="documentation-guidelines" />
### 文档指南

贡献文档时：
- 保持内容清晰、简洁且技术准确
- 遵循现有的文件结构和命名约定
- 在适当的情况下包含代码示例
- 使用正确的 MDX 格式和组件
- 测试所有链接和代码示例
  - 您可以运行 `npm run check:docs:links` 来查找损坏的内部链接。
- 使用适当的标题：教程的“何时使用”、“步骤”和“提示”
- 将新页面放置在适当的部分（概念、教程等）
- 添加新页面时更新`docs.json`
- 遵循现有文件命名约定 (`kebab-case.mdx`)
- 在 MDX 文件中包含正确的 frontmatter

<a id="specification-proposal-guidelines" />
## 规范提案指南

规格变更遵循[SEP 流程](https://modelcontextprotocol.io/community/sep-guidelines)。

提案必须提交给相关部门并在相关部门进行讨论
[工作组](https://modelcontextprotocol.io/community/working-interest-groups)。

只有在工作组同意后，SEP 拉取请求才可以标记为可供审查
[赞助](https://modelcontextprotocol.io/community/sep-guidelines#sponsors) 吧。在此之前，
正在进行的工作位于拉取请求草案中。拉取请求描述必须链接到
根据要求进行讨论
[SEP指南](https://modelcontextprotocol.io/community/sep-guidelines#workflow)。

在起草提案之前，先回顾一下[MCP设计原则](https://modelcontextprotocol.io/community/design-principles)
——符合这些原则的提案可以更快地通过审查。

<a id="reporting-issues" />
## 报告问题

如果您不是 `modelcontextprotocol` GitHub 组织的成员，请通过
提出问题或加入工作组。空白问题被禁用，因此请使用其中之一
[问题模板](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/new/choose)。

SDK 错误属于各自的 SDK 存储库。

<a id="submitting-changes" />
## 提交更改

只有 `modelcontextprotocol` GitHub 组织的成员可以打开拉取请求。

成员资格来自于对问题或工作组和兴趣组的积极态度。如果你
还不是会员，请参阅
[更改规范或文档](https://modelcontextprotocol.io/community/contributing#change-the-specification-or-docs)
了解如何从您的分支获取修复或打开拉取请求。
1. 与相关人员讨论您的改变
   [工作组](https://modelcontextprotocol.io/community/working-interest-groups)并获得批准
2. 检查您是否是 `modelcontextprotocol` 组织的成员，如
   [会员](https://modelcontextprotocol.io/community/contributor-ladder#member) 贡献者阶梯上的角色
3. 将您的更改推送到您的 fork
4. 针对主存储库打开拉取请求并遵循拉取请求模板
5. 对于 SEP，通过 [voting.modelcontextprotocol.io](https://voting.modelcontextprotocol.io) 与核心维护者安排审核

<a id="pull-request-titles" />
### 拉取请求标题

使用常规提交标题：`type(scope): description`。范围是可选的。

允许的类型有 `sep`、`feat`、`fix`、`docs`、`ci`、`build`、`chore`、
`refactor`、`test`、`perf`、`style` 和 `revert`。
| Change                    | 标题示例                                         |
| ------------------------- | ----------------------------------------------------- |
| 新的 SEP，编号之前 | `sep: propose task cancellation`                      |
| 编号 SEP              | `sep(SEP-3398): clarify task cancellation`            |
| 与 SEP 相关的修复      | `fix(SEP-3398): correct the cancellation result type` |
| Documentation             | `docs: clarify authorization`                         |
| CI                        | `ci: validate PR titles`                              |

一旦新的 SEP 具有 PR 编号，请使用 `sep(SEP-XXXX): description`，替换
`XXXX` 与该号码。保留原始 SEP 编号以便后续跟进并链接到
PR 描述中的提案。 SEP 范围使用不带前导的正数
零。其他更改可以使用区域范围（例如 `schema`）或省略它。

标记破坏更改为 `!`，例如 `feat(spec)!: remove the legacy transport`，
并在 PR 描述中的 `BREAKING CHANGE:` 段落中对其进行解释。

`PR title` 检查在标题编辑时重新运行，并在推出期间提供建议。

单独的分支提交不需要这种格式或重写。当南瓜合并时，
使用检查过的标题并在正文中保留披露内容和共同作者预告片。

<a id="ai-contributions" />
## 人工智能贡献

如果您使用任何类型的人工智能辅助来为模型上下文协议做出贡献，它必须是
在拉取请求或问题中披露。完整政策请参见 [AI_POLICY.md](AI_POLICY.md)，
包括披露预期以及我们对人工智能辅助贡献的期望。

<a id="license" />
## 许可证

通过贡献，您同意您的代码或规范贡献将被
根据 Apache License 2.0 获得许可。文档贡献（不包括
规范）已获得 CC-BY 4.0 许可。请参阅 [许可证](LICENSE) 文件
详细信息。

<a id="security" />
## 安全

请查看我们的[安全政策](SECURITY.md) 以报告安全问题。