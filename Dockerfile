# ==========================================
# 阶段 1: 前端构建 (Node.js 20 Alpine)
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 先拷贝 package.json 与 lock 缓存依赖层
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# 拷贝前端全部源码并执行类型检查与生产打包
COPY frontend/ ./
RUN npm run build

# ==========================================
# 阶段 2: 生产一体化镜像 (Python 3.11 + Nginx)
# ==========================================
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_ENV=production \
    FLASK_HOST=127.0.0.1 \
    FLASK_PORT=5000

# 安装系统运行级依赖与 Nginx，并移除 Debian 默认自带的欢迎页面与站点
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    gcc \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* /var/www/html/*

# 安装后端依赖 (利用 Docker 缓存层)
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir gunicorn && \
    pip install --no-cache-dir .

# 拷贝后端核心业务代码
COPY apps/ ./apps/
COPY main.py .

# 拷贝阶段 1 构建的前端静态产物至 Nginx 静态目录
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# 拷贝并配置 Nginx 与容器启动入口脚本 (只放 conf.d，彻底移除 sites-enabled 防止重复 default_server 崩溃)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -rf /etc/nginx/sites-enabled/* /etc/nginx/sites-available/*
COPY docker/entrypoint.sh /app/entrypoint.sh

# 消除 Windows 下可能存在的 CRLF 换行符并赋予可执行权限
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# 创建必要目录
RUN mkdir -p uploads temp/images temp/backups logs

# 暴露统一 HTTP 服务端口
EXPOSE 80

ENTRYPOINT ["/app/entrypoint.sh"]
