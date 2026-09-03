# 开源 GEO / 分发工具投稿插件

给现有的开源内容分发工具加 Manto 适配器，让用户在这些工具里**多勾一个平台**就能投稿到馒头新闻。

调研时间 2026-09-03，以下 star 数与最近提交均经 GitHub API 核实。

| 目标项目 | Star | 语言 | 最近提交 | 插件文件 | 难度 |
|---|---|---|---|---|---|
| [leaperone/MultiPost-Extension](https://github.com/leaperone/MultiPost-Extension) | 3231 | TypeScript | 2026-09-01 | `multipost-extension/manto.ts` | 低 |
| [chirag127/OmniDistribute](https://github.com/chirag127/OmniDistribute) | 1 | TypeScript | 2026-08-26 | `omnidistribute/manto.ts` | 低 |
| [AutomateLab-tech/content-distribution-mcp](https://github.com/AutomateLab-tech/content-distribution-mcp) | 5 | TypeScript | 2026-06-08 | `content-distribution-mcp/manto.ts` | 低 |

## 共性设计

三个适配器都用**幂等发布**，这是 Manto 相对其他平台的一个优势：

- 用内容自身的稳定标识（slug / canonical URL / 标题）作为 `external_id`
- 内容未变时服务端返回 `unchanged`，**不消耗每日配额**
- 内容变化时原地更新，不会产生重复条目
- 因此重试、重跑工作流永远是安全的

对比之下，多数平台的适配器要自己维护"发过没有"的状态。

---

## 1. MultiPost-Extension（优先，3.2k star）

浏览器扩展，一键把内容同步到 30 个平台。新增平台是"一平台一文件"的成熟模式。

### 改动清单

| 文件 | 改动 |
|---|---|
| `src/sync/dynamic/manto.ts` | **新增**，内容见 `multipost-extension/manto.ts` |
| `src/sync/dynamic.ts` | 加 import + `DynamicInfoMap` 条目 |
| `locales/zh_CN/messages.json` | 加 `platformManto` |
| `locales/en/messages.json` | 加 `platformManto` |

### src/sync/dynamic.ts

import 按字母序，插在 `DynamicMaimai` 之前：

```ts
import { DynamicManto } from "./dynamic/manto";
```

条目（建议放在 `DYNAMIC_MAIMAI` 之前）：

```ts
  DYNAMIC_MANTO: {
    type: "DYNAMIC",
    name: "DYNAMIC_MANTO",
    homeUrl: "https://manto.xin",
    faviconUrl: "https://manto.xin/favicon.ico",
    platformName: chrome.i18n.getMessage("platformManto"),
    // 纯 API 平台，不需要表单页面；指向同源站点可避免跨域
    injectUrl: "https://manto.xin/",
    injectFunction: DynamicManto,
    tags: ["CN", "International"],
    accountKey: "manto",
  },
```

`accountKey` 不需要对应 `src/sync/account/manto.ts`——`DYNAMIC_WEBHOOK` 用
`accountKey: "webhook"` 且没有账号文件，同样可工作。

### locales

i18n 是 WXT 格式（`{"key": {"message": "...", "description": "..."}}`）：

```json
"platformManto": { "message": "馒头新闻", "description": "馒头新闻平台名称" }
```

```json
"platformManto": { "message": "Manto", "description": "Manto platform name" }
```

### 注意事项

- 仓库根目录**没有 CONTRIBUTING.md**，但有 `CLAUDE.md` 和 `commitlint.config.js`
  （husky + commitlint），**commit message 必须合规**，建议格式
  `feat(sync): add Manto dynamic publishing platform`
- 建议先开 issue 对齐再提 PR，避免白做
- 用户的 API Key 通过 `extraConfig` 配置，不经过 Manto 以外的任何服务

---

## 2. OmniDistribute

Markdown 源文件扇出到 30+ 平台的 CLI。`Adapter` 接口只有 4 个方法，是所有候选里最干净的。

### 改动清单

| 文件 | 改动 |
|---|---|
| `src/adapters/manto.ts` | **新增**，内容见 `omnidistribute/manto.ts` |
| `src/publish.ts` | 加 import + `ADAPTERS` 数组条目 |
| `.env.example` | 加 `MANTO_API_KEY` |
| `src/adapters/manto.test.ts` | 可选，参考 `devto.test.ts` |

### src/publish.ts

```ts
import { MantoAdapter } from "./adapters/manto.js";
```

加入 `ADAPTERS` 数组：

```ts
const ADAPTERS: Adapter[] = [
  new DevToAdapter(),
  // ...
  new MantoAdapter(),
];
```

### 设计说明

- 用 `post.slug` 作为 `external_id`，与 Manto 的幂等语义天然匹配
- `url` 优先取 `canonicalUrl`（源站地址，把 SEO 权重还给原站），回退到 `publishedUrl`
- `update()` 直接复用 `publish()`：Manto 没有独立的更新端点，同 `external_id` 重新发布即原地更新
- `daily_quota_exceeded` 会被识别并明确提示"重试无用"，区别于普通网络错误

### 风险

项目只有 1 star，维护者响应速度未知；建议 PR 里附上运行截图/日志。

---

## 3. content-distribution-mcp

多渠道分发的 MCP Server。与 Manto 同属 MCP 生态，叙事最顺："把 Manto 加为一条分发通道"。

### 改动清单

| 文件 | 改动 |
|---|---|
| `src/adapters/manto.ts` | **新增**，内容见 `content-distribution-mcp/manto.ts` |
| `src/adapters/index.ts` | 加 import + `buildAdapterMap()` 条目 |
| `README.md` | 加 `MANTO_API_KEY` 配置说明 |

### src/adapters/index.ts

```ts
import { MantoAdapter } from "./manto.js";
```

```ts
export function buildAdapterMap(): Record<string, ChannelAdapter> {
  // ...
  return {
    devto: new DevToAdapter(),
    manto: new MantoAdapter(),
    // ...
  };
}
```

### 设计说明

- `external_id` 取值优先级：`extras.manto_external_id` > `canonical_url` > 标题 slug。
  这样调用方既可控，又不会因缺失配置而失去幂等性
- `unpublish()` 从 liveUrl 反解 `content_id`（`/articles/<id>`）后调 DELETE
- `hints()` 如实声明：只索引纯文本、不支持图片，让上层调度器正确裁剪内容

### 风险

项目 29 commits、5 star，治理流程尚未成型；建议先在 issue 里自我介绍再提 PR。

---

## 未采纳的候选

| 项目 | 定位 | 不优先的原因 |
|---|---|---|
| [elmohq/elmo](https://github.com/elmohq/elmo) | AEO/GEO 可见度平台，291★ | 生态位最高但要签 CLA，且它是监测工具，加"发布"能力属于产品方向问题，需先论证 |
| [open-aeo/open-aeo](https://github.com/open-aeo/open-aeo) | 自托管引用监控 | 2★，方向是"查引用"而非发布 |
| [mverab/eGEOagents](https://github.com/mverab/eGEOagents) | GEO 工具箱，171★ | 面向分析，无发布通道抽象 |
| [cxcscmu/AutoGEO](https://github.com/cxcscmu/AutoGEO) | ICLR'26 论文代码 | 研究型，非产品 |
| vitepress/docusaurus/mkdocs 的 llms.txt 插件 | 构建期生成 llms.txt | 解决"被抓取"而非"投稿"，只能加构建钩子，收益间接 |

## 提交前自查

- [ ] 适配器只通过 `process.env` / profile credentials 读取密钥，无硬编码
- [ ] 所有对外请求都带超时与错误处理
- [ ] `external_id` 已设置，重复运行不产生重复内容
- [ ] commit message 符合目标仓库规范（尤其 MultiPost 有 commitlint）
- [ ] PR 描述里说明 Manto 是什么、为什么值得加、如何拿到 API Key
- [ ] 已在本地跑通一次真实发布并附日志
