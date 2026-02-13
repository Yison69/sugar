# 交付部署（客户可在线管理内容）

目标：客户在任意电脑通过一个公网地址访问 Web 管理端（账号密码登录），上传图片/视频、增删改套餐/作品并立刻同步到小程序展示（用户端下拉刷新/重新进入页面即可看到最新内容）。

本项目由三部分组成：
- 小程序（`miniprogram/`）
- 云函数 + 云数据库/云存储（`cloudfunctions/`）
- Web 管理端（`src/`，构建产物为静态站点）

## 0. 关键约束（免费套餐常见）
如果云开发控制台在添加「身份认证安全来源/安全域名」时报 `FreePackageDenied`，代表当前套餐不允许把 `localhost` 加入白名单。

此时不要用本地 `http://localhost:5173` 作为交付形态。

交付建议：把 Web 管理端部署到云开发/WeDa 的默认域名，通过默认域名访问（无需添加自定义安全来源）。

## 1. 云开发环境准备
1) 创建云开发环境（得到 `envId`，形如 `cloud1-xxxx`）。
2) 创建云数据库集合（建议）：`works`、`packages`、`likes`、`bookings`、`admin_users`、`admin_sessions`、`config`。
3) 权限建议：所有集合设置为“仅云函数可读写”（由 `mpApi/adminApi` 控制权限与校验）。

## 2. 部署云函数（必须）
在微信开发者工具 / 云开发控制台中部署：
- `cloudfunctions/mpApi`
- `cloudfunctions/adminApi`

### 配置管理员初始化口令
在云函数 `adminApi` 的环境变量中设置：
- `ADMIN_SETUP_KEY=你自定义的一串随机字符串`

该口令只用于首次初始化管理员账号。

## 3. 部署 Web 管理端（推荐：云端默认域名）
Web 管理端是静态站点，构建后上传到云开发托管/WeDa。

### 3.1 构建
在项目根目录执行：
```bash
npm install
npm run build
```

构建产物在 `dist/`。

### 3.2 上传到云端托管
在云开发/WeDa 控制台找到“静态网站托管/网站托管/前端托管”（不同入口命名可能不同），把 `dist/` 上传并发布。

发布后会获得一个默认访问域名（所有电脑均可访问）。

## 4. 配置 Web 运行时参数（无需重新打包）
Web 管理端会在运行时读取 `/runtime-config.json`。

在你部署的站点根目录找到 `runtime-config.json`（来自 `public/runtime-config.json`），将其中字段改为：
```json
{
  "adminMode": "cloud",
  "basePath": "",
  "adminApiHttpBase": "",
  "cloudbaseEnvId": "你的 envId",
  "cloudbaseClientId": "可选，不填会自动从 envId 推导"
}
```

说明：
- `cloudbaseEnvId` 推荐填写；如果你使用的是 `*.tcloudbaseapp.com` 默认域名，系统会尝试从域名自动推导 envId（仍建议填写，避免以后换域名）。
- 默认域名部署时通常不需要再配置 `localhost` 白名单。

`adminApiHttpBase`（重要兜底）：
- 当 CloudBase Web 身份认证受套餐/安全来源影响导致前端无法获得 credentials（报 `credentials not found`）时，可以改用「HTTP 访问服务」直连云函数。
- 配置方法：在 CloudBase 控制台开启 HTTP 访问服务，并将触发路径映射到云函数 `adminApi`，复制“公网访问”域名作为 `adminApiHttpBase`。

### 使用 HTTP 访问服务（推荐：避免 `credentials not found`）
1) CloudBase 控制台 →「HTTP 访问服务」→ 开启。
2) 在「域名关联资源」点击“新增”，选择：
   - 触发类型：云函数
   - 关联资源：`adminApi`
   - 触发路径：`/api/*`
   - 公网访问：开启
   - 身份认证：关闭
   - 跨域校验：建议先关闭（或按控制台要求把你的管理端域名加入允许列表）
3) 保存后复制“公网访问”域名（形如 `https://xxxx...`），填入站点的 `/runtime-config.json`：
```json
{
  "adminMode": "cloud",
  "cloudbaseEnvId": "你的 envId",
  "adminApiHttpBase": "https://你的HTTP访问服务域名"
}
```

说明：
- 配置了 `adminApiHttpBase` 后，管理端登录/初始化/增删改查将走 HTTP，不再依赖 CloudBase Web 身份认证。
- 图片上传也会走 HTTP 上传接口（单文件建议 ≤8MB）。

## 5. Supabase + Vercel（替代方案：更稳定）
当 CloudBase Web 身份认证/HTTP 访问服务经常受限或配置复杂时，可改为：
- 数据：Supabase（Postgres + Storage）
- 管理端：Vercel 部署（同域名提供 `/api/*` 后端）
- 小程序：可通过 HTTPS 调用 Vercel 的 `/api/mp/rpc` 获取作品/套餐/预约

需要配置 Vercel 环境变量（见项目根目录 `.env.vercel.example`）：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `ADMIN_SETUP_KEY`

部署后访问：
- 初始化管理员：`/#/setup`
- 登录：`/#/login`

`basePath` 说明：
- 如果你的静态网站托管「应用路径」是 `/`，则保持 `basePath` 为空。
- 如果你的静态网站托管「应用路径」是 `/sugar_web_admin`，则设置 `basePath` 为 `/sugar_web_admin`。

## 5. Web 端初始化管理员账号
1) 打开：`https://你的站点域名/setup`
2) 输入：
   - Setup Key：与 `adminApi` 环境变量 `ADMIN_SETUP_KEY` 一致
   - Username / Password：客户的管理员账号密码
3) 成功后跳转到：`/login` 登录。

## 6. 客户日常使用流程（内容同步到小程序）
### 6.1 上传图片/视频
在 Web 管理端的「作品/套餐/设置」页面使用“上传”按钮：
- 选择本地文件 → 自动上传到云存储 → 自动回填 `cloud://` fileID → 点击“保存”。

小程序端会把 `cloud://` 转为临时 HTTPS 并展示。

### 6.2 新增/修改/删除套餐与作品
在 Web 管理端新增/修改/删除并保存后：
- 小程序用户端：下拉刷新/重新进入页面即可看到更新。

## 7. 验收清单
- Web 管理端在不同电脑/不同网络下可通过同一公网域名访问
- 账号密码登录有效（非本地浏览器缓存）
- 上传封面/图片/视频后，小程序列表与详情页可正常显示
- Web 新增套餐/作品后，小程序下拉刷新可看到新内容

## 常见问题
### 打开 `/login` 或 `/setup` 报 404/重定向过多
本项目管理端使用 Hash 路由（`/#/login`、`/#/setup`），不依赖静态托管的 404 重写规则。

建议：
- 访问登录页：`https://你的域名/#/login`
- 访问初始化页：`https://你的域名/#/setup`
- 静态网站托管的「路由配置/重定向规则」保持默认或清空，避免循环重定向
