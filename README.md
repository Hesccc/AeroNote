# 🚀 AeroNote (基于 Flask + React + TypeScript)

这是一个高颜值、现代化、轻量级的前后端分离个人博客与知识笔记系统。前端视觉风格深度参考了著名的 Hexo Fluid 主题设计，拥有极佳的视觉表现、顺滑的微动画和全面的暗色模式（Dark Mode）自适应。后端提供稳定高效的 RESTful API、智能大模型处理流水线、多数据库支持及多系统对接发布能力。

---

## ✨ 核心特性

### 🎨 极致视觉与交互体验 (Hexo Fluid 风格)
- **卡片式板面布局**：首页大板卡以负外边距悬浮遮挡 Banner，带来强烈的层次感。
- **圆润胶囊徽章**：分类与标签自动采用高通透度的主题色背景配合彩色边框，呈现精致的高级毛玻璃胶囊质感。
- **文章归档时光轴**：按“年份 / 月份”两级树状分组，配备连续贯穿的时间轴线与悬停微动反馈。
- **智能悬浮滚动导航**：首页、归档、分类、标签与文章详情页右侧均配备统一的圆角长方形悬浮上/下箭头导航，页面下滑后优雅淡入，支持一键回到顶部或直达底部。
- **文章目录与阅读进度**：文章详情页左侧内嵌粘性文章目录（TOC）；顶部吸顶呈现 3px 彩色微光平滑阅读进度条。
- **代码块一键复制**：Markdown 代码块右上角支持现代微交互复制图标与安全剪贴板兜底。
- **文章分享海报长图**：纯前端 Canvas 动态渲染 800×1080 极客深色质感分享卡片，自动集成标题、分类、AI 内容引言与自绘防伪二维码，支持一键复制图片与下载 PNG。

### 🌓 全站暗色/亮色主题切换
- **双模自适应**：支持操作系统深浅色首选项（`prefers-color-scheme: dark`）自动切换。
- **手动控制**：导航栏右侧提供 `☀️ 浅色` / `🌙 深色` 手动切换按钮，配置即时持久化到 `localStorage` 中，刷新不闪屏。
- **后台完美适配**：管理后台所有组件全面采用动态 CSS Token 变量，消除了暗色模式下的“白底白字”与翻页序号反色异常。

### 🤖 LLM 大模型智能流水线
- **任务项分类 Prompt 自定义**：支持针对**分类标签提取**、**文章内容摘要**、**错字病句校对**及**实战案例扩写**四个维度独立配置自定义 Prompt 模板，并支持保留 `{category_list}` 与 `{tag_list}` 动态占位符。
- **定时后台调度器 (AI Scheduler)**：支持配置 Unix 标准 Cron 表达式与并发处理线程数，自动化扫描无分类、无标签或无摘要的文章进行批量分析与补全，具备防堆积互斥锁机制。
- **智能创作侧边栏**：文章编辑页面内嵌 AI 辅助抽屉，支持一键提炼摘要、文本润色与深度扩写。

### 📝 写作体验与草稿安全
- **草稿箱与自动暂存 (Auto-Save)**：编辑器后台挂载 25 秒定时心跳，采用 `useRef` 单向解耦，打字不中断计时，自动暂存最新稿件；异常关闭再次进入时提供一键恢复；支持 `QuotaExceededError` 存储配额防护。
- **封面配图弹窗选择**：在文章编辑卡片中一键呼出 OSS 图片库二级弹窗，网格直观展示并高亮当前封面，点击任意卡片即可秒选为文章封面。

### 📦 数据备份与容灾中心 (`/admin/backups`)
- **全站数据与静态资源打包**：一键导出包含全量 SQL Dump、`uploads` 静态图片附件及 Markdown 原稿的完整 ZIP 灾备包。
- **数据库 SQL 导出与在线恢复**：一键生成独立可移植的 `.sql` 脚本；支持从历史备份一键“恢复至此库”，或在界面直接上传外部 `.sql` 文件执行还原（内置指令白名单与高危黑名单拦截）。
- **Markdown 文章全量导出**：全站文章批量导出为独立 `.md` 压缩包，完整保留标准 YAML Frontmatter 元数据。
- **OSS 图片库资源打包**：一键归档所有图片索引元数据 CSV 与本地物理附件。

### 🔌 开放 API 与多平台发布对接 (思源笔记 / Halo 2.x / OIDC SSO)
- **通用 OIDC 单点登录 (SSO)**：支持无缝对接 Keycloak、Authentik、Casdoor、Authing、GitHub、GitLab 等通用身份中心；内置动态 HS256 签名 State 与 Nonce 防护（彻底防御 CSRF 与重放攻击）；支持精确配置 `oidc user ➔ Apps admin` 映射白名单与网络实时探测握手。
- **思源笔记 (Publisher 插件) 原生兼容**：后端内置完整的 **Halo 2.x REST API 兼容层**（`/apis/*`），思源笔记 Publisher 插件中选择【Halo29】平台即可一键打通分类/标签拉取、文档发布与幂等更新。
- **独立开放 API Token**：后台「系统设置」提供专属长效 API 密钥（`sk-open-xxxx`），支持一键生成、复制与重置，独立于管理员日常登录会话。
- **RESTful Webhook 同步**：开放 `POST /api/open/posts/sync` 端点，支持基于 `source_id` 自动识别更新或新建，具备完整幂等性。

### 🛡️ 架构安全与性能加固
- **SQL LIKE 防注入**：全局封装 `escape_like` 通配符转义，彻底防御 `%` 与 `_` 引发的全表扫描 DoS 攻击。
- **数据库核心索引**：在 `posts` 表落地 `(deleted, status, create_time, id)` 联合覆盖索引，并在分类标签关系表建立复合索引，杜绝大表 `filesort` 慢查询。
- **并发原子计数**：详情页阅读量采用 SQL 表达式原子自增，杜绝高并发丢失更新。
- **Token 联动失效**：修改管理员密码后自动刷新时间戳凭据，历史已签发 Token 1 秒内全面强制失效。
- **多数据库方言兼容**：同时原生支持 **MySQL 8.x**、**MariaDB** 与 **PostgreSQL**，并自动在系统监控大屏中动态识别数据库方言。

---

## 🛠️ 技术栈清单

### 💻 前端 (Frontend)
- **构建工具**：Vite 8.x
- **核心框架**：React 19.x + TypeScript 5.x
- **代码规范**：Oxlint (零告警通过)
- **路由系统**：React Router DOM 7.x
- **内容渲染**：React-Markdown + Remark-GFM + Prism.js (语法高亮)
- **样式与动效**：原生 CSS 变量控制系统 + 深度定制毛玻璃/悬浮动效

### 🐍 后端 (Backend)
- **核心框架**：Flask 3.x
- **WSGI 服务器**：Gunicorn (生产环境多工作进程)
- **ORM 映射**：SQLAlchemy & Flask-SQLAlchemy 3.x
- **数据库驱动**：PyMySQL (MySQL/MariaDB) + Psycopg2 (PostgreSQL)
- **大模型集成**：OpenAI 官方兼容规范接口
- **任务调度**：Croniter + 线程池并发执行器
- **图像与监控**：Pillow + psutil

---

## 🚀 部署方式

### 方式一：Docker Compose 容器化一键部署 (生产推荐 ⭐⭐⭐⭐⭐)

无需在服务器安装复杂的 Python/Node/数据库环境，Docker 会自动拉起隔离的数据库、后端与前端 Nginx 网关。

1. **准备配置文件**：
   ```bash
   cp .env.example .env
   ```
   修改 `.env` 中的 `SECRET_KEY`、数据库密码与大模型 API Key。

2. **一键构建并启动集群**：
   ```bash
   docker compose up -d --build
   ```

3. **访问服务**：
   - 博客前台与后台：`http://<服务器IP或域名>:80`（端口可在 `.env` 中通过 `FRONTEND_PORT` 配置）
   - 统一一体化镜像内置高性能 Nginx，自动完成前端 SPA 路由转发、Gzip 静态加速与后端 API 反向代理。

---

### 方式二：本地原生开发与调试

#### 1. 前置准备
确保本地安装有：
- Node.js (推荐 v18+)
- Python (推荐 >= 3.11)
- MySQL / MariaDB / PostgreSQL 数据库服务

#### 2. 后端服务配置与启动
1. 激活虚拟环境并安装依赖：
   ```bash
   # 使用 pip 安装本地依赖
   pip install -e .
   ```
2. 复制并调整环境变量文件 `.env`：
   ```ini
   FLASK_ENV=development
   FLASK_HOST=127.0.0.1
   FLASK_PORT=5000
   SECRET_KEY=your-secure-random-secret-key

   # 选择数据库类型: mysql | mariadb | postgresql
   DB_TYPE=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=blog
   ```
3. 运行后端服务：
   ```bash
   python main.py
   ```

#### 3. 前端服务配置与启动
1. 进入 `frontend/` 目录：
   ```bash
   cd frontend
   npm install
   ```
2. 启动前端 Vite 热更新服务器：
   ```bash
   npm run dev
   ```
3. 编译前端生产产物：
   ```bash
   npm run build
   ```

---

## 🔒 账号与安全信息

- **管理后台入口**：`/admin` (未登录自动跳转 `/login`)
- **默认管理员账号**：`admin`
- **默认管理员密码**：`admin` (登录后请第一时间在「修改密码」界面更新为强密码，系统会自动无感升级为安全哈希存储)
- **开放 API 密钥获取**：登录后台 -> 点击进入「系统设置」 -> 切换至「开放 API 与同步」标签页，即可查看专属 API Token 与思源笔记配置指南。
