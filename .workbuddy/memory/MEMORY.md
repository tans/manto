# 项目长期记忆 — Manto（馒头新闻）

## 项目位置
- 本地仓库：`/Users/ke/code/manto`
- 生产服务器：`root@43.167.248.105`（SSH key `~/code/ssh/keys/shared_dev_rsa`），部署目录 `/data/manto`
- 线上域名：`https://manto.xin`，MCP 端点 `https://manto.xin/mcp`，健康检查 `/api/health`
- 部署与运维细节见仓库 `DEPLOYMENT.md`（rsync + docker compose，证书 cron 每天 03:17）

## 技术栈约定
- 运行时 Bun（不是 Node），包管理 bun，测试 `bun test`，类型检查 `bun run check`
- Web 框架 Hono + `Bun.serve`，数据库 `bun:sqlite`（WAL 模式），校验 zod
- 本地默认端口 `41875`，数据库路径 `./data/manto.sqlite`（可用 `MANTO_DB_PATH` 覆盖）

## 产品定位
Agent 优先的发布/搜索网络。无密码账户（邮箱 + 一次性 API Key），10 个 MCP 工具（Streamable HTTP），同时提供等价 `/v1` HTTP API。首页是给 Agent 看的纯文本接口说明（含 llms.txt / robots.txt / sitemap.xml）。

## 关键业务规则
- 发布配额：`min(30, 3 + floor(log2(valid_post_count+1))*2)` 条/日
- 排序：`relevance × (0.75 + 0.20 × account_score + 0.05)`，freshness 项当前为常数 0.05（未真正实现）
- 创始倍率：前 100 名 2.0×，101–1000 名 1.5×，1001–10000 名 1.2×，之后 1.0×
- 单一账户在自然结果中最多 3 条；推广位每天最多 1 个，按 `daily_budget_cents` 排序
- 充值接 OnePay（默认 `https://onepay.minapp.xin`），回调走 `/v1/payments/onepay/callback`

## 已知待办 / 风险（2026-09-03 盘点）
1. 邮件找回通道未实现：`src/mail.ts` 是 stub，`email_tokens` 表写入了 token 但无任何端点消费，丢失 API Key = 永久失去账户
2. 全站无 rate limiting，充值/建号可被刷
3. `search` 把用户输入直接拼进 FTS5 MATCH，存在查询语法注入导致 400
4. MCP 端点（tools/list / tools/call / 401 分支）无测试覆盖
5. PRODUCT.md 仍写「8-tool contract」，实际 10 个工具；freshness 公式、单账户 3 条限制描述与实现不符
6. 首页已引入 daisyUI CDN 与充值表单 JS，与 PRODUCT.md「纯文本、无 JS 也要可用」的约束漂移
