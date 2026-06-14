#!/bin/bash
# travel-diary server 启动脚本（必须在项目目录运行）
# 用法：./start-server.sh
cd "$(dirname "$0")"
exec python3 -m http.server 8730 --bind 127.0.0.1