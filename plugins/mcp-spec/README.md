<a id="mcp-spec-plugin-for-claude" />
# Claude 的 MCP Spec 插件

研究和贡献模型上下文协议规范的技能。

<a id="installation" />
## 安装

<a id="claude-code" />
### 克劳德·代码

```bash
/plugin marketplace add modelcontextprotocol/modelcontextprotocol
```

<a id="claude-cowork" />
### 克劳德·科沃克

导航至自定义 >> 浏览插件 >> 个人 >> 加号按钮 >> 从 GitHub 添加市场并添加 `modelcontextprotocol/modelcontextprotocol`

<a id="available-skills" />
## 可用技能

### `/search-mcp-github <topic>`

搜索 MCP GitHub 讨论、问题和拉取请求以查找有关主题的相关信息。

**搜索来源：**
- [组织级讨论](https://github.com/orgs/modelcontextprotocol/discussions)
- [规范级别讨论](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions)
- [规范级别问题](https://github.com/modelcontextprotocol/modelcontextprotocol/issues)
- [规范级别拉取请求](https://github.com/modelcontextprotocol/modelcontextprotocol/pulls)
**Example:**

```
/search-mcp-github Tool Annotations
```

**注意：** 该技能搜索开放和封闭的问题/PR，这对于理解过去的决策和历史背景非常重要。

### `/draft-sep <idea>`

研究起草符合【SEP治理流程】（https://modelcontextprotocol.io/community/sep-guidelines）的规范增强提案。盖茨询问该想法是否值得 SEP，采访作者，检查现有规范覆盖范围和现有技术，然后填写模板的必填和可选部分并写入 `seps/0000-{slug}.md`。 （可选）打开草稿 PR，回填 SEP 编号，并运行 `npm run generate:seps` 和 `npm run format:docs`，以便 CI 保持绿色。

**先决条件：** 从该存储库或其分支的本地克隆运行（该技能读取 `seps/TEMPLATE.md` 并写入 `seps/`）。

**Example:**

```
/draft-sep add websocket transport
```

**注意：** 在编写任何内容之前，该技能将提出澄清问题（SEP 类型、重大变更状态、原型、先前讨论、赞助商、安全性）。 SEP 指南要求工作组赞助 SEP，如果没有这样做，该技能将被标记。如果没有发起人，它打开的拉取请求只是用于公开开发想法的拉取请求草案。