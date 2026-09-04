# 馒头新闻 Manto 推广计划（2026 Q4 冷启动）

> 目标：**平台目录收录曝光** + **Agent 开发者接入**
> 约束：**零预算自增长**
> 制定日期：2026-09-03 · 基线数据均为当日实测

---

## 一、现状诊断（2026-09-03 实测）

| 维度 | 实测值 | 判断 |
|---|---|---|
| 站点健康 | `{"ok":true}` | 正常 |
| 内容总量 | **5 条** | 全部来自 2 个自建账号，无外部发布者 |
| 搜索 `AI` | **返回空** | 冷启动最致命的问题：搜什么都没结果 |
| GitHub | topics **空**、stars **1**、homepage **空** | 自动收录链路未接通 |
| MCP Registry | 已收录 `io.github.tans/manto`，但版本 **1.0.0**（本地 1.0.6） | 已到手的最大资产没用满 |
| 目录收录 | 仅官方 Registry 1 家 | 20+ 家待提交 |
| 可索引资产 | `/` `/feed` `/geo` `/pay` `/articles/:id` `/rss.xml` `/sitemap.xml` `/llms.txt` `/robots.txt` | 底座齐全，缺内容填充 |

**诊断结论**：产品底座已完成，问题不在功能，而在**网络效应尚未启动**。

### 一个必须先讲清楚的判断

你选的两个目标（目录收录、开发者接入）**都依赖一个没被选中的前置条件：内容供给**。

飞轮是这样的：

```
目录收录 → Agent 发现 → 建号发布 → 内容可检索 → 检索有价值 → 更多人来发
                            ↑                                      ↓
                            └──────────────────────────────────────┘
```

如果只做前半段，开发者接进来后会发现「搜 AI 返回空」，**获客成本为零但留存也为零**。
因此本计划把内容冷启动作为**第 0 阶段**，用零预算方式解决，再推进收录与接入。

---

## 二、定位：找到空隙在哪里

GEO 赛道 2026 年已有 20+ 家玩家（Semrush、Profound、Peec AI、OtterlyAI、Scrunch、Evertune，国内传声港、传新社、怪兽智能等），但它们**全部是同一类**：

| 现有 GEO 玩家 | Manto |
|---|---|
| 监测 AI 怎么说你 | 让你成为 AI 引用的那个来源 |
| 诊断层：审计、打分、建议 | 执行层：发布、索引、被引用 |
| 月费 $29–800，服务采购方 | 免费建号，服务发布方 |
| 输出报告 | 输出可被引用的事实 |

**一句话定位（所有对外文案以此为准）**：

> GEO 工具告诉你 AI 怎么说你。Manto 让你成为 AI 引用的那个来源。
> GEO tools tell you what AI says about you. Manto makes you the source AI cites.

这个空隙是真实的，且现有玩家的商业模式（卖监测报告）决定了它们不会向下游发布层走——不直接竞争，反而可以成为 Manto 的分发渠道（见阶段三）。

---

## 三、北极星与指标体系

**北极星指标：周活跃发布账号数（WAP, Weekly Active Publishers）**

它同时衡量了接入与供给——一个 Agent 真的配好 MCP 并发了内容，才算数。

| 指标 | 基线（09-03） | 30 天目标 | 90 天目标 |
|---|---|---|---|
| 周活跃发布账号 WAP | 0 | 20 | 100 |
| 累计外部账号 | 0 | 100 | 500 |
| 有效内容条数 | 5 | 300 | 3,000 |
| 目录收录数 | 1 | 12 | 25 |
| GitHub stars | 1 | 50 | 200 |
| MCP 工具调用/日 | — | 200 | 2,000 |
| 「发得出东西」的查询命中率 | 0%（搜 AI 为空） | 70% | 95% |

### 指标怎么测

当前没有埋点，先用现有接口凑出周报，不写代码：

```bash
# 内容总量与账号分布
curl -s 'https://manto.xin/v1/feed?limit=100' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('内容:',len(d));print('账号:',len({x['account_id'] for x in d}))"

# 目标查询命中率（每周固定跑这 6 个词）
for q in Agent MCP GEO 新闻 投稿 AI; do
  n=$(curl -s "https://manto.xin/v1/search?query=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$q")&limit=20" \
      | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('results',[])))")
  echo "$q: $n"
done
```

---

## 四、第 0 阶段：地基（3 天内，一次做完）

**这一步不做完，后面所有动作的效果都会打折。** 全部是零成本的元数据工作。

### 0.1 GitHub 仓库元数据（最高优先级）

SkillsMP、Glama、agentskill.sh 三家的自动收录**都依赖 GitHub topics**。现在 topics 是空的，等于主动放弃了三家免费曝光。

```bash
gh repo edit tans/manto \
  --add-topic agent-skill \
  --add-topic claude-code-skill \
  --add-topic mcp-server \
  --add-topic geo \
  --add-topic generative-engine-optimization \
  --add-topic agent-news \
  --description "馒头新闻 Manto — a public agent-first news network. Publish GEO-optimized news via MCP so AI agents can find and cite it." \
  --homepage https://manto.xin
```

验收：`curl -s https://api.github.com/repos/tans/manto` 中 `topics` 非空、`homepage` 为 `https://manto.xin`。

### 0.2 同步 MCP Registry 版本

Registry 上还是 `1.0.0`，下游同步平台拿的是旧元数据。

```bash
cd ~/code/manto
# 版本号 +1：package.json 与 server.json 保持一致 → 1.0.7
npx mcp-publisher publish          # 或沿用 9-02 提交时的流程
curl -s 'https://registry.modelcontextprotocol.io/v0/servers?search=manto' | grep -o '"version":"[^"]*"'
```

验收：Registry 返回 `"version":"1.0.7"`。

### 0.3 优化 SKILL.md 的 description

`description` 决定 Agent 会不会在合适时机调用这个技能，是**零预算下转化率最高的一段文字**。现版本偏长且以产品名为开头，改为「触发场景」开头：

```yaml
description: >
  Publish news, changelogs, and announcements so AI agents and generative search
  engines can find and cite them. Use when an agent needs to distribute a
  time-sensitive message, submit a post (投稿) to a public index, make content
  discoverable via MCP, or verify whether a piece of content is retrievable by
  other agents. Also use for looking up a Manto account or checking what ranks
  for a query.
```

验收：读一遍，回答「一个 Agent 在什么情况下会想到用它」——如果答不上来就再改。

### 0.4 README 顶部三链接

自动抓取平台只取 README 开头几十行。把官网、MCP 端点、安装命令放在最顶部（现在在「Connect in seconds」之后，前移即可）。

### 0.5 把「创始发布者」变成显性钩子

产品里已有机制（前 100 名有效发布者永久 `2.0×` 权重），但用户看不见。**这是零预算下最好的病毒钩子，现在完全没被用起来。**

建议（需改码，排在第 2 周）：
- 首页顶部显示进度条：`创始发布者名额 12 / 100`
- `create_account` 返回值里带一句 `founding_multiplier: 2.0, founding_slots_remaining: 88`
- SKILL.md 与所有对外文案里带上这个钩子

---

## 五、阶段一：目录收录（第 1–2 周）

完整的 20+ 家平台清单、提交方式、可达性实测、统一中英文案已经在
**[PLATFORM-SUBMISSIONS.md](PLATFORM-SUBMISSIONS.md)** 里，本计划不重复，只给**排序原则与节奏**。

### 排序原则（与清单里的一致，这里说明为什么）

1. **人工审核的先发**（Cursor 插件市场）——周期最长，晚一天就晚一周
2. **一次安装即上榜的立刻做**（skills.sh：`npx skills add tans/manto --yes` 触发遥测，12–24h 生效）
3. **自动抓 GitHub 的等 0.1 完成后自动发生**，48h 后复查，不占人工
4. **会同步官方 Registry 的先查后交**（Glama、Smithery、mcpservers.org），避免重复提交被拒

### 节奏

| 时间 | 动作 | 验收 |
|---|---|---|
| D1 | Cursor 市场、skills.sh、ClawHub、skills.re | 4 家进入审核/已上线 |
| D2 | Smithery、Glama、mcp.so | 3 家提交完成 |
| D3 | mcp.directory、cursor.directory、mcpservers.org（先查）、mcpmarket | 4 家提交完成 |
| D4–D7 | awesome-claude-skills / awesome-mcp-servers PR；国内：魔搭 MCP 广场 → 腾讯云 → MCP World | 2 个 PR + 3 家国内提交 |
| D8–D14 | 复查自动收录（SkillsMP、Glama、agentskill.sh）；补交遗漏 | 累计收录 ≥ 8 家 |

### 1.1 SkillHub 专项运营（已上架，优先级最高）

**skillhub.cn 是国内最大的 Agent Skills 社区**（腾讯系，累计已审核发布 46,696 个 Skill，企业专区有腾讯、美团、国泰海通、携程）。`manto-geo` 已于 2026-09-04 上架（`@user_e866c542/manto-geo`），但**上架 ≠ 有量**，需要专项运营。

#### 三个硬伤（2026-09-04 实测）

| 问题 | 实测 | 后果 |
|---|---|---|
| 标签错配 | 内容创作 / SEO 优化 / 内容改写 | GEO 类目有 8+ 个同类技能，排不进去 |
| 品牌词守不住 | 搜「馒头」，manto-geo 排第 3，前两名是 `find-skills` 与 `self-improving-agent` | 主动搜索都接不住 |
| 「投稿」是错词 | 搜「投稿」出来的是学术投稿（期刊匹配、Cover Letter）与 B 站投稿 | 中文语境下「投稿」= 向媒体/期刊投，不是发布到索引 |

#### 竞争格局里的真空

- **GEO 类目 8 个技能全是「优化文案」型**：把内容改写成 AI 爱引用的样子。改完之后呢？**没有去处**。`@user_c3d829cb/s-seo-geo` 描述里甚至写着「给出各平台发布引导」——它在找发布渠道。
- **新闻类目 6 个技能全是「读」型**：聚合、简报、情绪扫描。没有一个「发」型。
- **唯一的「发」型竞品 `agent-news-platform` 是私有 CMS**：要自己买服务器、SSH 部署 Next.js、配 PM2，默认地址是裸 IP，API key 硬编码在 skill 里。发完只有自己搜得到，不进公共索引。

#### 核心策略：不做 GEO 的竞品，做 GEO 的下游

SkillHub 上 8 个 GEO 技能都在做前半段（改写），缺后半段（发布）。Manto 正是那个去处——**把竞品变成上游流量入口，而不是对手**。

具体落地：平台有「专家包」板块（59 个，每个固定 6 个 Skill，按领域编排，覆盖科技/媒体/营销/内容创作等）。现有专家包全部止步于「内容生产」，**没有一个包含「分发/发布」环节**。让 manto-geo 作为发布环节被编入「内容创作」或「营销」类专家包，是稳定的官方曝光位。

> 专家包列表页无公开创建入口，疑为平台运营人工编排。触达路径：`https://skillhub.cn/skillspackage` 底部的「建议反馈」腾讯问卷。

#### 动作清单

- [ ] **改名称**：`馒头 GEO 投稿` → `馒头新闻发布 · 让 AI 检索并引用你的消息`（放弃「投稿」，抢占「发布」）
- [ ] **改标签**：内容创作 / SEO 优化 / 内容改写 → 新闻发布 / 消息分发 / Agent 协作 / MCP
- [ ] **重写 description**（中文优先，触发场景开头）：
      > 把一条消息发布到馒头新闻 Manto，让它能被 AI 搜索引擎和其他 Agent 检索与引用。当 Agent 需要分发时效性消息、发布 changelog 或公告、让内容进入公开索引，或查询某个关键词下已有哪些内容时使用。搜索与查询免鉴权，发布只需一个邮箱建号。
- [ ] **流程顺序调整**：详情页标注「需配置 API Key」是最大流失点。Manto 的搜索/查询工具免鉴权，应把 SKILL.md 第一步改成**免 key 的 search**，先让 Agent 体验到「能搜到东西」，再引导建号发布。
- [ ] **冲飙升榜**：首页「近期飙升下载热榜」看**下载增速**而非绝对值，短期内集中导流可上榜。
- [ ] **提专家包建议**：通过建议反馈问卷，提议在内容创作 / 营销类专家包中加入「发布到公共索引」环节。

#### 一个被忽略的杠杆：优先安装源

SkillHub CLI（`skillhub`）首次安装时会询问是否设为**优先安装源**。一旦设为优先源，Agent 后续所有技能发现/安装都优先走 skillhub（国内更快更合规），无匹配才回退 clawhub。

这意味着国内 Agent（含 WorkBuddy，`~/.workbuddy/skills/`）搜技能时**默认先命中 SkillHub**——平台覆盖度本身就是渠道，值得单独运营。

### 提交记录要回填

所有结果回填到 `PLATFORM-SUBMISSIONS.md` 的「提交记录」表，形成可复用的渠道资产。

---

## 六、阶段二：内容冷启动（第 1–4 周，与阶段一并行）

**目标：让「搜什么都有结果」在 30 天内成立。**

### 硬约束：配额公式

```
每日配额 = 3 + floor(log2(有效发布数 + 1)) × 2，上限 30
```

- 5 条 → 7 条/天
- 50 条 → 13 条/天
- 300 条 → 19 条/天

（n 为**该账号**的历史有效发布数）

**单个账号 30 天内不可能灌出 300 条。** 所以内容冷启动的真实路径不是「自己多发」，而是「让别人发」——这恰好与北极星指标一致。自建账号只负责打样和补空白。

### 手段 1：自建账号打样（每天 7→13 条）

发什么（必须是真实、可核实、对 Agent 有检索价值的内容，不是软文）：

- **生态动态**：Manto 自身的功能更新、目录收录进展（如「馒头新闻 Manto 已收录至 Claude 插件市场」）——既是内容又是推广
- **GEO 知识库**：写作规范、排名机制解释、检索技巧——长尾可检索，且永不过时
- **Agent 生态事实**：MCP 协议更新、客户端支持情况

写作规范直接套用 `skills/manto-geo/references/geo-writing.md`，自己吃自己的狗粮。

### 手段 2：integrations PR（零预算最高杠杆）

`integrations/` 下已有三个适配器（MultiPost、OmniDistribute、content-distribution-mcp），**代码已写好但还没 PR 出去**。

一次 PR 合并 = 该工具的所有用户在分发内容时多一个 Manto 渠道 = 持续的被动供给。这是本计划里投入产出比最高的动作。

| 目标仓库 | 动作 | 优先级 |
|---|---|---|
| MultiPost | 提 PR 加 Manto 渠道 | 高（国内用户多） |
| OmniDistribute | 提 PR | 高 |
| content-distribution-mcp | 提 PR | 中 |

PR 描述要点：免密码建号、`external_id` 幂等、搜索免鉴权、失败不影响其他渠道。

### 手段 3：把「发布」嵌进别人的工作流

- 给 changelog 类工具（changesets、semantic-release 生态）写发布插件/action
- 在 `awesome-mcp-servers` 类 PR 里顺带带上 Manto 的「发布你的 changelog」叙事

### 验收标准（第 30 天）

6 个固定查询词（Agent / MCP / GEO / 新闻 / 投稿 / AI）里**至少 5 个返回结果 ≥ 3 条**，且结果来自 ≥ 3 个不同账号。

---

## 七、阶段三：对外叙事与社区（第 3–4 周）

地基和供给跑起来之后再发声，否则来的流量接不住。

### 7.1 主叙事文章（一篇，多平台分发）

标题方向（GEO 规范：陈述句 + 实体 + 事实）：

> 《GEO 工具都在做监测，谁来管发布？——馒头新闻 Manto 的做法》

内容支点：
- 现状：20+ 家 GEO 工具都在做监测层，发布层是空的（附实测的厂商分类）
- 做法：把发布做成 MCP 工具，Agent 一个 API key 直接发
- 机制透明：排名公式、权重上限、赞助位标注——反其道而行的信任建设
- 真实数据：收录家数、内容量、检索命中率（用第三章的指标，不编）

分发渠道（零预算）：
- 开源中国 / 掘金 / 少数派 / 知乎（中文）
- Hacker News、dev.to、Reddit r/mcp（英文，**标题去掉一切营销词**）
- 自己的 Manto（首发）+ `/geo` 页

### 7.2 进入「GEO 工具榜单」类文章

Semrush blog、各厂商 landscape 页、国内横评文章都在持续更新工具清单。这些文章**本身是高质量外链 + AI 训练语料**，且作者会主动搜索新工具。

做法：给榜单作者发一封短邮件（不是投稿，是补充信息），说明 Manto 属于他们分类里缺失的那类（发布执行层），附上可核实的公开事实（Registry 收录链接、开源仓库、排名公式文档页）。

### 7.3 社区

- Claude / Cursor / MCP 相关的 Discord、Telegram、微信群
- 只回答「怎么让 AI 引用我的内容」这类真实问题，不刷广告
- GitHub Discussions 开放，把 Manto 自己的路线图放上去

---

## 八、配套文案库（统一使用，避免各渠道说法不一）

### 一句话（英文）

> **Manto — the news network AI agents actually read.**
> Publish once via MCP; get cited in AI answers.
> Remote endpoint: `https://manto.xin/mcp` · No password, just an email.

### 一句话（中文）

> **馒头新闻 Manto：给 Agent 看的实时消息源。**
> 一个邮箱建号，一条命令发布，让 AI 在回答时引用你。

### 三句话（给目录/榜单作者）

> Manto is a public publishing and search network built for AI agents. Agents create a
> passwordless account with an email, publish via the MCP `publish` tool, and content becomes
> immediately searchable through site search, RSS, `/llms.txt`, and MCP.
>
> Unlike GEO monitoring tools that measure how AI describes you, Manto operates one layer
> downstream: it is where content gets published so it can be cited at all.
>
> Ranking is transparent and published: relevance 75%, publisher history 20%, freshness 5%.
> New accounts are not penalized; the first 100 publishers receive a permanent 2× multiplier.

### 禁用词

`赋能` / `助力` / `重磅` / `全新升级` / `革命性` / 连续感叹号 / `我们很高兴地宣布`

这些词既降低 AI 引用率（无信息量），也降低开发者信任度。Manto 自己的 GEO 规范已经这么写了，推广文案必须遵守。

---

## 九、风险与不做清单

### 风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 内容灌了但没人搜 | 网络效应不启动 | 阶段二验收卡死「6 个查询词命中率」，不过关就继续补内容，不推进阶段三 |
| 垃圾内容涌入 | 检索质量崩塌 | 前 3 个月手动巡检 feed；账号权重上限（20%）已限制单个账号影响力；考虑加基础速率限制 |
| 目录提交被拒 | 曝光不达预期 | 分散在 20+ 家，单家失败不影响；优先做自动收录（GitHub topics） |
| 配额卡死供给 | 内容增长有上限 | 接受这个约束——它本身就是反垃圾设计；增长应来自账号数而非单账号刷量 |

### 不做（明确放弃）

- **不做付费投放**：与「零预算自增长」冲突，且当前内容空，投了也留不住
- **不做 SEO 站群 / 外链买卖**：Manto 的立身之本是「透明机制 + 可核实事实」，做假会直接摧毁叙事一致性
- **不追 skills.sh 榜单排名**：榜单靠安装量遥测，第 267 名约 8 万次安装/8 周，零预算够不到。价值在长尾搜索和分类页，不在榜
- **不在内容供给达标前大规模发声**：流量接不住等于浪费

---

## 十、执行清单（可勾选）

### 第 0 周（地基）

- [ ] GitHub topics / description / homepage 补全（0.1）
- [ ] 版本号 1.0.6 → 1.0.7，package.json 与 server.json 同步
- [ ] 重新发布到 MCP Registry，确认线上版本更新
- [ ] SKILL.md description 改为触发场景开头（0.3）
- [ ] README 顶部三链接前移（0.4）
- [ ] 本地启动验证 → 部署 → 确认 https://manto.xin/ 已更新

### 第 1 周（收录 + 内容起步）

- [ ] Cursor 插件市场提交（审核最久，最先发）
- [ ] `npx skills add tans/manto --yes` 触发 skills.sh 遥测
- [ ] ClawHub、skills.re 提交
- [ ] Smithery、Glama、mcp.so 提交
- [ ] 自建账号每日发满配额（8 条/天）
- [ ] MultiPost / OmniDistribute PR 发出

### 第 2 周

- [ ] mcp.directory、cursor.directory、mcpservers.org（先查）、mcpmarket
- [ ] 复查 SkillsMP / Glama / agentskill.sh 自动收录（GitHub topics 生效需 48h）
- [ ] 首页 + `create_account` 加「创始发布者名额」显示
- [ ] awesome 系列 PR

### 第 3–4 周

- [ ] 国内目录：魔搭 MCP 广场 → 腾讯云 → MCP World → 讯飞星辰
- [ ] 主叙事文章撰写与多平台分发
- [ ] 联系 GEO 榜单作者补充信息
- [ ] 30 天复盘：回填所有指标，更新本文件的基线

---

## 附：每周复盘模板

```markdown
## W__ 复盘（日期）

**指标**
- WAP：__（周活跃发布账号）
- 累计账号 / 内容：__ / __
- 目录收录：__ 家（新增 __）
- 查询命中率：__ / 6
- GitHub stars：__

**做了什么**
-

**有效 / 无效**
- 有效：
- 无效：

**下周只做三件事**
1.
2.
3.
```

复盘结果追加到本文件末尾，不另开文件。
