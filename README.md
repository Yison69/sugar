# 摄影师小程序 + Web 管理端（微信云开发）

本仓库包含：
- 微信小程序（作品/服务套餐可选项加减价/预约/点赞）
- 独立 Web 管理端（账号密码登录，公网可访问）
- 微信云开发：云数据库 + 云存储 + 云函数（`mpApi` / `adminApi`）

交付部署（客户可在线管理内容）：见 [DELIVERY.md](file:///Users/huangyisong/Desktop/cs/miniprogram/sugar/docs/DELIVERY.md)

## 目录结构
- `miniprogram/`：微信小程序代码
- `cloudfunctions/`：云函数（`mpApi`、`adminApi`）
- `src/`：Web 管理端（React + TS + Vite）
- `shared/`：前后端共享类型（用于 Web 端）

## 本地启动（Web 管理端）
1. 安装依赖
```bash
npm install
```

2. 选择运行模式（二选一）

### A. 本地离线模式（推荐先用这个）
不依赖云开发控制台配置；数据保存在浏览器本地（localStorage）。

在项目根目录创建 `.env.local`：
```bash
VITE_ADMIN_MODE="local"
VITE_LOCAL_SETUP_KEY="随便设一串"
```

启动后打开：
- `http://localhost:5173/setup` 初始化管理员
- `http://localhost:5173/login` 登录

### B. 云开发模式
需要云开发 Web 安全域名/登录授权等配置。

注意：部分云开发免费套餐不支持添加自定义「身份认证安全来源/安全域名」（会报 `FreePackageDenied`）。这种情况下，本地 `localhost` 无法使用云开发模式；建议改为部署到云开发托管/WeDa 的默认域名访问，或升级套餐。

在项目根目录创建 `.env.local`：
```bash
VITE_CLOUDBASE_ENV_ID="<你的 envId>"

# 可选：某些环境需要 clientId（通常是 envId 的后半段）
VITE_CLOUDBASE_CLIENT_ID="<可选>"
```

3. 启动
```bash
npm run dev
```

## 微信开发者工具（小程序 + 云开发）
1. 用微信开发者工具导入本仓库（会读取根目录 `project.config.json`）。
2. 将 `project.config.json` 里的 `appid` 改为你的小程序 AppID。
3. 在微信开发者工具中开通云开发，并创建一个云开发环境（得到 `envId`）。
4. 将 `miniprogram/app.js` 里的 `globalData.envId` 改为你的 `envId`。
5. 在云开发控制台/开发者工具中上传并部署云函数：
   - `cloudfunctions/mpApi`
   - `cloudfunctions/adminApi`

## 云数据库集合（建议）
建议创建以下集合：
- `works`：作品
- `packages`：套餐
- `likes`：点赞记录（去重用）
- `bookings`：预约记录
- `admin_users`：管理员账号
- `admin_sessions`：管理员登录态
- `config`：配置（使用 `contact` 文档保存微信号与二维码）

权限建议：所有集合设置为“仅云函数可读写”，由云函数控制访问与校验。

## 初始化管理员账号
`adminApi` 提供一次性初始化能力（需你在云函数环境变量里配置 `ADMIN_SETUP_KEY`）。

1. 在云函数 `adminApi` 环境变量中设置：
- `ADMIN_SETUP_KEY=你自定义的一串随机字符串`

2. 打开 Web 的初始化页面（只允许首次创建）：
- `http://localhost:5173/setup`
- 填入 `ADMIN_SETUP_KEY`、账号和密码

3. 打开 Web 管理端 `/login` 使用账号密码登录。

## 配置预约页展示的微信号/二维码
`miniprogram/pages/detail/index` 会读取 `config/contact` 文档：
- `wechatText`：你的微信号文字
- `wechatQrUrl`：二维码图片 URL 或 `cloud://` fileID

可以通过 Web 管理端「设置」页面修改。

## 图片/视频地址（本地文件如何变成 URL）
管理端目前保存的是字符串字段（如 `coverUrl`、作品 `imageUrls`），因此你需要把本地图片/视频先上传到一个“公网可访问”的位置，再把得到的地址填进管理端。

推荐做法：上传到云开发【存储】后复制 `cloud://` fileID（本项目的 `mpApi` 会自动把 `cloud://` 转成临时 HTTPS URL，便于小程序直接展示）。
# sugar
