# Manto 部署文档

## 部署信息

| 项目 | 配置 |
| --- | --- |
| 域名 | `manto.xin` |
| 服务器 | `43.167.248.105` |
| SSH 用户 | `root` |
| SSH 私钥 | `~/code/ssh/keys/shared_dev_rsa` |
| 部署目录 | `/data/manto` |
| 容器名 | `manto` |
| 应用端口 | `127.0.0.1:41875` |
| 健康检查 | `https://manto.xin/api/health` |

公网流量由 1Panel 内置 OpenResty 终止 HTTPS，再反向代理到仅监听本机的 Manto 容器。SQLite 文件持久化在 `/data/manto/data/manto.sqlite`，发布代码时不要覆盖 `data/`。

## 首次部署

在本地项目目录执行：

```bash
ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105 \
  'mkdir -p /data/manto/data && chmod 700 /data/manto/data'

rsync -az --delete \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'node_modules/' \
  -e 'ssh -i ~/code/ssh/keys/shared_dev_rsa' \
  ./ root@43.167.248.105:/data/manto/

ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105 \
  'cd /data/manto && docker compose up -d --build'
```

如需 OnePay，在服务器创建 `/data/manto/.env`：

```dotenv
PUBLIC_URL=https://manto.xin
ONEPAY_CREATE_URL=
ONEPAY_QUERY_URL=
```

`.env` 不随代码同步，也不要提交到仓库。

## 配置 1Panel 反向代理

登录 `http://43.167.248.105:8090/tencentcloud`，在 **网站 -> 创建网站 -> 反向代理** 中填写：

- 主域名：`manto.xin`
- 代理地址：`http://127.0.0.1:41875`
- 发送域名：`$host`
- 缓存：关闭

代理配置应保留以下请求头：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;
proxy_buffering off;
proxy_cache off;
```

在该网站的 **HTTPS** 页面申请 Let's Encrypt 证书，开启 HTTP 跳转 HTTPS。证书签发前需确认 `manto.xin` 的 A 记录为 `43.167.248.105`。

## 验证

服务器内部验证容器：

```bash
ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105 \
  'cd /data/manto && docker compose ps && curl -fsS http://127.0.0.1:41875/api/health'
```

本地验证公网入口与证书：

```bash
curl -fsS https://manto.xin/api/health
curl -fsS https://manto.xin/
openssl s_client -connect manto.xin:443 -servername manto.xin </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

预期健康检查返回 `{"ok":true,"service":"manto",...}`，根路径返回服务版本与 MCP 地址。

## 更新发布

先在本地确认代码已提交，再执行：

```bash
bun run check
bun test

rsync -az --delete \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude 'data/' \
  --exclude 'node_modules/' \
  -e 'ssh -i ~/code/ssh/keys/shared_dev_rsa' \
  ./ root@43.167.248.105:/data/manto/

ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105 \
  'cd /data/manto && docker compose up -d --build && docker compose ps'
```

发布后必须再次检查内网和公网两个健康检查，不能只以容器处于 `running` 状态作为成功依据。

## 备份与恢复

SQLite 使用 WAL 模式，运行中不要只复制单个数据库文件。用 SQLite 在线备份命令生成一致快照：

```bash
ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105 \
  'cd /data/manto && mkdir -p backups && docker compose exec -T manto bun -e '\''import { Database } from "bun:sqlite"; const db = new Database("/data/manto.sqlite"); await db.run("VACUUM INTO /data/manto-backup.sqlite")'\'' && mv data/manto-backup.sqlite backups/manto-$(date +%Y%m%d-%H%M%S).sqlite'
```

恢复前先停止容器并保留当前数据，再替换数据库：

```bash
ssh -i ~/code/ssh/keys/shared_dev_rsa root@43.167.248.105
cd /data/manto
docker compose down
mv data/manto.sqlite "data/manto.sqlite.before-restore-$(date +%Y%m%d-%H%M%S)"
cp backups/<备份文件>.sqlite data/manto.sqlite
docker compose up -d
```

## 回滚与排障

代码回滚使用已确认的 Git 提交，在本地切换到目标版本后重新执行更新发布。数据库变更必须单独按备份恢复，不要通过覆盖整个 `/data/manto` 回滚。

常用命令：

```bash
cd /data/manto
docker compose ps
docker compose logs --tail=200 manto
docker compose restart manto
curl -fsS http://127.0.0.1:41875/api/health
```

若内网健康但公网失败，检查 1Panel 网站配置、OpenResty 日志和证书；若内网也失败，先检查容器日志与 `/data/manto/data` 权限及磁盘空间。
