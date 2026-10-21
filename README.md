# 双燃 Duo Fit · 双人健康打卡

一个为两个人设计的运动、饮食与健康减脂打卡空间。前端为 React + Vite，数据层支持两种模式：

- **云端模式（正式使用）**：Supabase 提供共享数据库 + 登录 + 实时同步，两人读写同一份数据。
- **本地模式（仅预览）**：未配置 Supabase 时自动回退到浏览器 `localStorage`，方便本地查看样式。

---

## 一、本地开发

```bash
# 1. 安装依赖（node ≥ 18）
pnpm install        # 或 npm install

# 2. 启动开发服务器
pnpm dev            # 或 npm run dev
# 打开 http://localhost:5173
```

未配置 `.env` 时，页面底部会显示「本地模式」，此时数据仅存本机浏览器。

---

## 二、接入 Supabase（让两人数据一致）

### 1. 创建 Supabase 项目

1. 打开 https://supabase.com 并注册/登录。
2. 点击 **New project**，填写项目名（如 `duoran`），数据库密码任意设置，区域选离你最近的即可。
3. 创建完成后，进入 **Project Settings → API**，记下两个值：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public key**（`eyJ...` 开头）

### 2. 建表 + 权限策略

1. 进入 **SQL Editor**，新建查询。
2. 把本仓库 `supabase/schema.sql` 的全部内容粘贴进去，点 **Run**。
3. 这一步会创建 `profiles`（成员档案）和 `records`（打卡记录）两张表，并开启行级安全（RLS）和实时订阅。脚本是幂等的，可重复执行。

### 3. 配置登录（Authentication）

1. 进入 **Authentication → Providers → Email**，确认 **Email** 已启用，勾选 **Password**。
2. 建议临时关闭 **Confirm email**（`Authentication → Sign In / Up → Email` 里的 "Confirm email" 开关关掉），避免首次登录还要去邮箱点确认链接；之后如需更严谨再打开。
3. **创建两个账号**（一人一个）：
   - 进入 **Authentication → Users → Add user → Create new user**。
   - 填写两人的邮箱和密码，各建一个（例如 `lin@example.com`、`zhou@example.com`）。
   - 把账号分别交给两人使用。

> 说明：登录后首次进入会提示「你是哪一位？」，各自认领自己的档案（林诺娅 / 钟滨）。认领后，两人的打卡互不串号，且都能看到对方的记录。

### 4. 配置前端环境变量

1. 复制 `.env.example` 为 `.env`：

   ```bash
   cp .env.example .env
   ```

2. 填入第二步拿到的值：

   ```dotenv
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. 重启开发服务器（`pnpm dev`）。此时应出现登录页，登录并认领档案后即可使用；一个人打卡，另一个人的页面会**实时自动刷新**。

---

## 三、部署上线（生成可分享的公网网址）

前端是纯静态站点，推荐用 Vercel / Netlify / Cloudflare Pages 免费托管。

### 方式 A：Vercel（推荐）

1. 把本仓库推送到 GitHub。
2. 打开 https://vercel.com ，**Add New → Project**，导入该仓库。
3. 框架选 **Vite**，构建命令默认 `vite build`，输出目录默认 `dist`。
4. 在 **Environment Variables** 里添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 点击 **Deploy**。完成后会得到一个 `https://xxxx.vercel.app` 的公网地址，把链接发给对方即可。
6. （可选）在 Vercel 的 **Settings → Domains** 绑定你自己的域名。

### 方式 B：Netlify / Cloudflare Pages

流程类似：连接仓库 → 构建命令 `vite build` → 发布目录 `dist` → 填两个环境变量 → 部署。

---

## 四、数据一致性是怎么保证的

- **唯一数据源**：两人的记录都写进 Supabase 的 `records` 表，不再依赖各自浏览器。
- **实时同步**：前端订阅了 `records` 表的 Realtime 变更（INSERT/UPDATE/DELETE），一方保存，另一方页面立即更新。
- **权限隔离**：RLS 策略保证「每人只能增/改/删自己档案的记录，但双方都能查看全部」。
- **去重**：`records` 表对 `(profile_id, date)` 建了唯一约束，每人每天一条，重复打卡会覆盖当天记录。

---

## 五、目录结构（本次改造新增/变更）

```
supabase/schema.sql      # 建表 + RLS + 实时订阅脚本（在 Supabase SQL Editor 运行）
.env.example             # 环境变量模板
src/supabase.js          # Supabase 客户端（未配置则回退本地模式）
src/auth.jsx             # 登录会话 + 档案绑定（AuthProvider / useAuth）
src/records.js           # 记录数据层：查询 / 实时订阅 / 增删（useRecords）
src/auth-ui.jsx          # 登录页 / 认领档案页
src/auth.css             # 登录相关样式
src/App.jsx              # 主界面（接入新数据层与登录门）
```

---

## 六、常见问题

- **登录后一直显示「正在连接」**：确认 `.env` 里的 `VITE_SUPABASE_URL` 没有拼错，且已在 Supabase 里运行过 `schema.sql`。
- **认领档案提示「可能已被认领」**：说明该档案已被另一个账号绑定。让两个账号分别认领不同的档案，或联系管理员在 `profiles` 表里把 `user_id` 清空后重试。
- **邮箱链接收不到邮件**：Supabase 免费项目邮件有配额限制，建议优先用「密码登录」；若必须用邮箱链接，需在 Supabase 配置自定义 SMTP。
- **想改目标热量/体重等**：登录后通过侧栏「个人与目标设置」修改；云端模式会同步保存到 Supabase。

---

## 七、已部署项目的后续更新（GitHub + Supabase + Netlify）

1. 在 Supabase Dashboard → SQL Editor，运行当前版本 `supabase/schema.sql`。脚本会为现有 `profiles` 增加目标字段，并创建 `activity_log` 历史记录表及 RLS/Realtime 配置；使用幂等建表和列升级语句，可用于升级已有项目，不会删除现有打卡记录。
2. 将本次代码提交并推送到 GitHub 当前部署分支。Netlify 连接仓库后会自动安装依赖、执行 `npm run build` 并发布 `dist`。
3. Netlify → Site configuration → Environment variables 检查 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 存在。若环境变量有变化，需重新触发一次部署。
4. 等 Netlify Deploys 显示 Published 后，用两个账号分别登录，验证目标设置保存、彼此实时可见；各做一次打卡，再点右上角铃铛检查活动历史。

本次功能说明：个人目标写入 Supabase `profiles`；铃铛读取共享 `activity_log` 中的打卡、目标更新及初始化事件；云端“初始化”只清空**当前登录者自己的记录**，符合现有 RLS 权限，不会清空伴侣的记录。本地模式下仍使用浏览器本地存储。

---

## 八、做成安卓 App（PWA，免商店安装）

网站已支持 PWA（渐进式 Web 应用）。用手机 Chrome 打开网站 → 添加到主屏幕，即可像原生 App 一样全屏运行、有独立图标，且随网站自动更新、无需上架商店。

### 首次启用步骤

1. **生成图标**（只需一次，用你电脑上已装的 Node，无需安装任何东西）：

   ```bash
   cd G:\deepseekai\sport_web
   node scripts/generate-icons.mjs
   ```

   会在 `public/` 下生成 `icon-192.png`、`icon-512.png`、`icon-maskable-512.png`。

2. **提交并推送**（Netlify 会自动重新构建部署）：

   ```bash
   git add .
   git commit -m "添加 PWA：可安装到手机主屏幕"
   git push
   ```

3. 等 Netlify Deploys 显示 Published。

### 在安卓手机上安装

1. 用 **Chrome 浏览器**打开你的网站（Netlify 地址）。
2. 点右上角 **⋮ 菜单 → 安装应用 / 添加到主屏幕**。
3. 确认后，手机桌面会出现「双燃」图标；点开即为**全屏**运行，体验和原生 App 一致。

> 提示：数据同步、登录、打卡等所有功能与网页版完全一致（同一个 Supabase 后端）。若「安装应用」没出现，多刷新一两次或等 Chrome 完成对 PWA 的检测。

### 补充说明

- `public/manifest.webmanifest`：App 名称、图标、全屏显示等配置。
- `public/sw.js`：Service Worker，缓存静态资源，弱网/离线时也能打开界面（数据同步需联网）。
- `scripts/generate-icons.mjs`：零依赖的图标生成脚本，可重复运行。
- 若日后想要**真正的 `.apk` 安装包或上架应用商店**，可用 Capacitor 把本项目打包成原生安卓应用（需要 Android Studio 与签名），需要时再单独处理。
