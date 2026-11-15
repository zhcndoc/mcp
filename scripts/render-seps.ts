#!/usr/bin/env tsx
/**
 * Script to render SEPs (Specification Enhancement Proposals) into Mintlify docs format.
 *
 * This script:
 * 1. Reads all SEP markdown files from the seps/ directory
 * 2. Parses their metadata (title, status, type, authors, etc.)
 * 3. Generates an index page with a tabular overview
 * 4. Generates individual MDX files for each SEP in docs/seps/
 * 5. Updates docs/docs.json with the SEPs navigation tab and a /seps/{number}
 *    redirect for each SEP
 *
 * Usage: npx tsx scripts/render-seps.ts [--check]
 *   --check: Verify generated files are up to date (exit 1 if not)
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const SEPS_DIR = path.join(__dirname, "..", "seps");
const DOCS_SEPS_DIR = path.join(__dirname, "..", "docs", "seps");
const DOCS_JSON_PATH = path.join(__dirname, "..", "docs", "docs.json");

interface SEPMetadata {
  number: string;
  title: string;
  status: string;
  type: string;
  created: string;
  accepted?: string;
  authors: string;
  sponsor: string;
  prNumber: string;
  slug: string;
  filename: string;
}

function canonicalStatus(status: string): string {
  const value = status.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "最终版": "final",
    "最终": "final",
    "已定稿": "final",
    "草案": "draft",
    "审查中": "in-review",
    "审查": "in-review",
    "已接受": "accepted",
    "接受": "accepted",
    "已拒绝": "rejected",
    "被拒绝": "rejected",
    "撤回": "withdrawn",
    "已撤回": "withdrawn",
    "取代": "superseded",
    "已取代": "superseded",
    "休眠": "dormant",
    "休眠状态": "dormant",
  };
  return aliases[value] ?? value;
}

function displayStatus(status: string): string {
  const labels: Record<string, string> = {
    final: "最终版",
    draft: "草案",
    "in-review": "审查中",
    accepted: "已接受",
    rejected: "已拒绝",
    withdrawn: "已撤回",
    superseded: "已取代",
    dormant: "休眠",
  };
  return labels[canonicalStatus(status)] ?? status;
}

function displayType(type: string): string {
  const value = type.trim().toLowerCase();
  const labels: Record<string, string> = {
    "standards track": "标准轨道",
    "standard track": "标准轨道",
    "标准轨道": "标准轨道",
    "标准跟踪": "标准轨道",
    informational: "信息类",
    "信息": "信息类",
    "信息性": "信息类",
    process: "流程",
    "流程": "流程",
    "extensions track": "扩展轨道",
    "扩展轨道": "扩展轨道",
  };
  return labels[value] ?? type;
}

/**
 * Parse SEP metadata from markdown content
 */
function parseSEPMetadata(content: string, filename: string): SEPMetadata | null {
  // Skip template, README, and 0000- placeholder drafts
  if (filename === "TEMPLATE.md" || filename === "README.md" || filename.startsWith("0000-")) {
    return null;
  }

  // Extract SEP number and slug from filename (e.g., "1850-pr-based-sep-workflow.md")
  const filenameMatch = filename.match(/^(\d+)-(.+)\.md$/);
  if (!filenameMatch) {
    console.warn(`Warning: Skipping ${filename} - doesn't match SEP naming convention`);
    return null;
  }

  const [, number, slug] = filenameMatch;

  // Parse title from first heading
  const titleMatch = content.match(/^#\s+SEP-\d+[:：]\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled";

  // Parse metadata fields using regex
  const statusMatch = content.match(/^\s*-\s*\*\*(?:Status|状态)\*\*[:：]\s*(.+)$/m);
  const typeMatch = content.match(/^\s*-\s*\*\*(?:Type|类型)\*\*[:：]\s*(.+)$/m);
  const createdMatch = content.match(/^\s*-\s*\*\*(?:Created|创建日期|创建时间|创建于|创建)\*\*[:：]\s*(.+)$/m);
  const acceptedMatch = content.match(/^\s*-\s*\*\*(?:Accepted|接受日期|接受时间|接受)\*\*[:：]\s*(.+)$/m);
  const authorsMatch = content.match(
    /^[ \t]*-[ \t]*\*\*(?:Author\(s\)|作者)\*\*[:：][ \t]*([^\n]*(?:\n[ \t]+(?![-*+][ \t])[^\n]*)*)/m
  );
  const sponsorMatch = content.match(/^\s*-\s*\*\*(?:Sponsor|赞助人|赞助者|发起人)\*\*[:：]\s*(.+)$/m);
  const prMatch = content.match(/^\s*-\s*\*\*(?:PR|问题)\*\*[:：].*?(?:#|\/pull\/)(\d+)/m);

  return {
    number,
    title,
    status: statusMatch ? statusMatch[1].trim() : "Unknown",
    type: typeMatch ? typeMatch[1].trim() : "Unknown",
    created: createdMatch ? createdMatch[1].trim() : "Unknown",
    accepted: acceptedMatch ? acceptedMatch[1].trim() : undefined,
    authors: authorsMatch ? authorsMatch[1].replace(/\s+/g, " ").trim() : "Unknown",
    sponsor: sponsorMatch ? sponsorMatch[1].trim() : "None",
    prNumber: prMatch ? prMatch[1] : number,
    slug,
    filename,
  };
}

/**
 * Convert GitHub usernames to links
 */
function formatAuthors(authors: string): string {
  return authors.replace(/@([\w-]+)/g, "[@$1](https://github.com/$1)");
}

/**
 * Format PR number as a GitHub link
 */
function formatPrLink(prNumber: string): string {
  return `[#${prNumber}](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/${prNumber})`;
}

/**
 * Truncate title to max length, adding ellipsis if needed
 */
function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 1).trim() + "…";
}

/**
 * Get status badge color for Mintlify
 */
function getStatusBadgeColor(status: string): string {
  const statusLower = canonicalStatus(status);
  if (statusLower === "final") return "green";
  if (statusLower === "accepted") return "blue";
  if (statusLower === "in-review") return "yellow";
  if (statusLower === "draft") return "gray";
  if (statusLower === "rejected" || statusLower === "withdrawn") return "red";
  if (statusLower === "dormant") return "orange";
  if (statusLower === "superseded") return "purple";
  return "gray";
}

/**
 * Notice injected into every Final SEP page. Final SEPs are point-in-time
 * historical records and are not edited after finalization.
 */
const FINAL_SEP_NOTICE = `<Note>
  本 SEP 已达到 Final 状态，作为已接受设计的历史记录保留。定稿后对协议所作的变更不会反映在此处。权威要求请参阅[当前规范](/specification/latest)及其变更日志。
</Note>`;

function normalizeMarkdownHardBreaks(content: string): string {
  const lines = content.split("\n");
  let inFence = false;
  let fenceChar = "";
  let fenceSize = 0;

  return lines.map((line) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
        fenceSize = fence[1].length;
      } else if (fence[1][0] === fenceChar && fence[1].length >= fenceSize) {
        inFence = false;
      }
      return line;
    }
    if (inFence || /^\s*\|/.test(line)) return line;
    return line.replace(/[ \t]{2,}$/, "<br />");
  }).join("\n");
}

/**
 * Generate MDX content for a single SEP page
 */
function generateSEPPage(sep: SEPMetadata, originalContent: string): string {
  // Remove the header metadata section and title from original content for the body
  // Find where the Abstract section starts
  const englishAbstractIndex = originalContent.indexOf("## Abstract");
  const chineseAbstractIndex = originalContent.indexOf("## 摘要");
  const abstractIndex = englishAbstractIndex >= 0 ? englishAbstractIndex : chineseAbstractIndex;
  const body = normalizeMarkdownHardBreaks(abstractIndex !== -1 ? originalContent.slice(abstractIndex) : originalContent);

  // Final SEPs get a notice marking them as historical records
  const isFinal = canonicalStatus(sep.status) === "final";
  const notice = isFinal ? `${FINAL_SEP_NOTICE}\n\n` : "";
  const statusLabel = displayStatus(sep.status);
  const typeLabel = displayType(sep.type);

  return `---
title: "SEP-${sep.number}: ${sep.title}"
sidebarTitle: "SEP-${sep.number}: ${truncateTitle(sep.title, 40)}"
description: "${sep.title}"
---

<div className="flex items-center gap-2 mb-4">
  <Badge color="${getStatusBadgeColor(sep.status)}" shape="pill">${statusLabel}</Badge>
  <Badge color="gray" shape="pill">${typeLabel}</Badge>
</div>

${notice}| 字段 | 值 |
| --- | --- |
| **SEP** | ${sep.number} |
| **标题** | ${sep.title} |
| **状态** | ${statusLabel} |
| **类型** | ${typeLabel} |
| **创建日期** | ${sep.created} |
${sep.accepted ? `| **接受日期** | ${sep.accepted} |\n` : ""}| **作者** | ${formatAuthors(sep.authors)} |
| **赞助人** | ${formatAuthors(sep.sponsor)} |
| **PR** | ${formatPrLink(sep.prNumber)} |

---

${body}
`;
}

/**
 * Generate the SEP index page with tabular overview
 */
function generateIndexPage(seps: SEPMetadata[]): string {
  // Sort SEPs by number (descending - newest first)
  const sortedSeps = [...seps].sort((a, b) => parseInt(b.number) - parseInt(a.number));

  // Group by status for summary
  const byStatus = sortedSeps.reduce(
    (acc, sep) => {
      const status = canonicalStatus(sep.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Generate table rows
  const tableRows = sortedSeps
    .map((sep) => {
      const statusLabel = displayStatus(sep.status);
      const statusBadge = `<Badge color="${getStatusBadgeColor(sep.status)}" shape="pill">${statusLabel}</Badge>`;
      return `| [SEP-${sep.number}](/seps/${sep.number}-${sep.slug}) | ${sep.title} | ${statusBadge} | ${displayType(sep.type)} | ${sep.created} |`;
    })
    .join("\n");

  // Generate status summary
  const statusSummary = Object.entries(byStatus)
    .map(([status, count]) => `- **${displayStatus(status)}**：${count}`)
    .join("\n");

  return `---
title: 规范增强提案（SEP）
sidebarTitle: SEP 索引
description: MCP 规范增强提案索引
---

规范增强提案（SEP）是提议修改 Model Context Protocol 的主要机制。每份 SEP 都会为拟议功能提供简明的技术规范和设计理由。

每份 SEP 都可通过编号访问，路径格式为 \`/seps/<number>\`（例如 [/seps/1850](/seps/1850)）。

<Card title="提交 SEP" icon="file-plus" href="/community/sep-guidelines">
  了解如何提交规范增强提案。
</Card>

## 概览

${statusSummary}

## 所有 SEP

| SEP | 标题 | 状态 | 类型 | 创建日期 |
| --- | --- | --- | --- | --- |
${tableRows}

## SEP 状态说明

| 状态 | 定义 |
| --- | --- |
| <Badge color="gray" shape="pill">草案</Badge> | 已有赞助人，正在进行非正式审查的 SEP。 |
| <Badge color="yellow" shape="pill">审查中</Badge> | 已准备好由核心维护者正式审查的 SEP。 |
| <Badge color="blue" shape="pill">已接受</Badge> | 已接受，等待参考实现完成的 SEP。 |
| <Badge color="green" shape="pill">最终版</Badge> | 参考实现等产物已完成并定稿的 SEP。 |
| <Badge color="red" shape="pill">已拒绝</Badge> | 被核心维护者拒绝的 SEP。 |
| <Badge color="red" shape="pill">已撤回</Badge> | 作者已撤回的 SEP。 |
| <Badge color="purple" shape="pill">已取代</Badge> | 已被更新 SEP 取代的 SEP。 |
| <Badge color="orange" shape="pill">休眠</Badge> | 尚未找到赞助人并已关闭六个月的 SEP。 |
`;
}

/**
 * Read all SEP files and parse their metadata
 */
function readAllSEPs(): { metadata: SEPMetadata; content: string }[] {
  const files = fs.readdirSync(SEPS_DIR).filter((f) => f.endsWith(".md"));
  const seps: { metadata: SEPMetadata; content: string }[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(SEPS_DIR, file), "utf-8");
    const metadata = parseSEPMetadata(content, file);
    if (metadata) {
      seps.push({ metadata, content });
    }
  }

  return seps;
}

/**
 * Group SEPs by status for navigation
 */
function groupSepsByStatus(seps: SEPMetadata[]): Record<string, SEPMetadata[]> {
  const groups: Record<string, SEPMetadata[]> = {};

  // Define status order for navigation
  const statusOrder = ["final", "accepted", "in-review", "draft", "withdrawn", "rejected", "superseded", "dormant"];

  for (const sep of seps) {
    const status = canonicalStatus(sep.status);
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(sep);
  }

  // Sort each group by SEP number
  for (const status of Object.keys(groups)) {
    groups[status].sort((a, b) => parseInt(a.number) - parseInt(b.number));
  }

  // Return in preferred order
  const orderedGroups: Record<string, SEPMetadata[]> = {};
  for (const status of statusOrder) {
    if (groups[status]) {
      orderedGroups[status] = groups[status];
    }
  }
  // Add any remaining statuses not in the predefined order
  for (const status of Object.keys(groups)) {
    if (!orderedGroups[status]) {
      orderedGroups[status] = groups[status];
    }
  }

  return orderedGroups;
}

/**
 * Matches the short SEP redirect sources managed by this script (e.g. "/seps/1850").
 */
const SEP_SHORT_LINK_SOURCE = /^\/seps\/\d+$/;

/**
 * Update docs.json to include SEPs as a top-level tab, grouped by status,
 * and a /seps/{number} redirect to each SEP page
 */
function updateDocsJson(seps: SEPMetadata[]): string {
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, "utf-8"));

  // Group SEPs by status
  const groupedSeps = groupSepsByStatus(seps);

  // Build nested navigation structure
  const sepSubgroups: Array<string | { group: string; pages: string[] }> = [];

  for (const [status, statusSeps] of Object.entries(groupedSeps)) {
    if (statusSeps.length === 0) continue;

    const pages = statusSeps.map((sep) => `seps/${sep.number}-${sep.slug}`);

    sepSubgroups.push({
      group: displayStatus(status),
      pages,
    });
  }

  const sepsTab = {
    tab: "SEPs",
    pages: ["seps/index", ...sepSubgroups],
  };

  // Remove any legacy SEPs group from the Community tab
  const communityTab = docsJson.navigation.tabs.find((tab: { tab: string }) => tab.tab === "Community" || tab.tab === "社区");
  if (communityTab) {
    communityTab.pages = communityTab.pages.filter(
      (item: { group?: string } | string) => !(typeof item === "object" && item.group === "SEPs")
    );
  }

  // Find existing SEPs tab
  const sepsTabIndex = docsJson.navigation.tabs.findIndex((tab: { tab: string }) => tab.tab === "SEPs" || tab.tab === "SEP");

  if (sepsTabIndex >= 0) {
    docsJson.navigation.tabs[sepsTabIndex] = sepsTab;
  } else {
    // Insert before the Community tab if present, otherwise append
    const communityIndex = docsJson.navigation.tabs.findIndex((tab: { tab: string }) => tab.tab === "Community");
    if (communityIndex >= 0) {
      docsJson.navigation.tabs.splice(communityIndex, 0, sepsTab);
    } else {
      docsJson.navigation.tabs.push(sepsTab);
    }
  }

  // Replace the managed /seps/{number} redirects, leaving hand-written redirects untouched
  const otherRedirects = (docsJson.redirects ?? []).filter(
    (redirect: { source: string }) => !SEP_SHORT_LINK_SOURCE.test(redirect.source)
  );
  const sepRedirects = [...seps]
    .sort((a, b) => parseInt(a.number) - parseInt(b.number))
    .map((sep) => ({
      source: `/seps/${sep.number}`,
      destination: `/seps/${sep.number}-${sep.slug}`,
    }));
  docsJson.redirects = [...otherRedirects, ...sepRedirects];

  return JSON.stringify(docsJson, null, 2) + "\n";
}

/**
 * Main function
 */
async function main() {
  const checkMode = process.argv.includes("--check");

  console.log("Reading SEP files...");
  const seps = readAllSEPs();
  console.log(`Found ${seps.length} SEP(s)`);

  if (seps.length === 0) {
    console.log("No SEPs found to render.");
    return;
  }

  // Ensure output directory exists
  if (!fs.existsSync(DOCS_SEPS_DIR)) {
    fs.mkdirSync(DOCS_SEPS_DIR, { recursive: true });
  }

  // Track all expected files for check mode
  const expectedFiles: { path: string; content: string }[] = [];

  // Generate index page
  const indexPath = path.join(DOCS_SEPS_DIR, "index.mdx");
  const indexContent = generateIndexPage(seps.map((s) => s.metadata));
  expectedFiles.push({ path: indexPath, content: indexContent });

  // Generate individual SEP pages
  for (const { metadata, content } of seps) {
    const sepPath = path.join(DOCS_SEPS_DIR, `${metadata.number}-${metadata.slug}.mdx`);
    const sepContent = generateSEPPage(metadata, content);
    expectedFiles.push({ path: sepPath, content: sepContent });
  }

  // Generate updated docs.json
  const docsJsonContent = updateDocsJson(seps.map((s) => s.metadata));
  expectedFiles.push({ path: DOCS_JSON_PATH, content: docsJsonContent });

  if (checkMode) {
    // Check mode: verify all files match expected content (after formatting)
    // Write to temp files, format with Prettier, then compare
    const tempDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "seps-check-"));
    let hasChanges = false;

    try {
      // Write expected content to temp files
      const tempFiles: { original: string; temp: string }[] = [];
      for (const { path: filePath, content } of expectedFiles) {
        const tempPath = path.join(tempDir, path.basename(filePath));
        fs.writeFileSync(tempPath, content, "utf-8");
        tempFiles.push({ original: filePath, temp: tempPath });
      }

      // Format MDX files with Prettier
      const mdxTempFiles = tempFiles.filter(({ temp }) => temp.endsWith(".mdx")).map(({ temp }) => temp);
      if (mdxTempFiles.length > 0) {
        execFileSync(npx, ["prettier", "--write", ...mdxTempFiles], { stdio: "pipe" });
      }

      // Compare formatted temp files with existing files
      for (const { original, temp } of tempFiles) {
        if (!fs.existsSync(original)) {
          console.error(`Missing file: ${original}`);
          hasChanges = true;
          continue;
        }
        const existing = fs.readFileSync(original, "utf-8");
        const formatted = fs.readFileSync(temp, "utf-8");
        if (existing !== formatted) {
          console.error(`File out of date: ${original}`);
          hasChanges = true;
        }
      }
    } finally {
      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    if (hasChanges) {
      console.error("\nSEP documentation is out of date. Run 'npm run generate:seps' to update.");
      process.exit(1);
    }
    console.log("All SEP documentation is up to date.");
  } else {
    // Write mode: generate all files
    for (const { path: filePath, content } of expectedFiles) {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Generated: ${path.relative(process.cwd(), filePath)}`);
    }

    // Format generated files with Prettier
    const filesToFormat = expectedFiles
      .filter(({ path: p }) => p.endsWith(".mdx"))
      .map(({ path: p }) => path.relative(process.cwd(), p));
    if (filesToFormat.length > 0) {
      console.log("\nFormatting generated files with Prettier...");
      execFileSync(npx, ["prettier", "--write", ...filesToFormat], { stdio: "inherit" });
    }

    console.log("\nSEP documentation generated successfully!");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
