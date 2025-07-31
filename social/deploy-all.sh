#!/bin/bash

# Social Connect Workers 一鍵部署腳本
# 部署 Telegram Worker、Telegram Bot Worker 和 Twitter Summary Worker

set -e  # 遇到錯誤立即退出

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日誌函數
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 檢查是否在正確的目錄
if [ ! -d "telegram-worker" ] || [ ! -d "telegram-bot-worker" ] || [ ! -d "twitter-summary-worker" ]; then
    log_error "請在 social-connect 目錄中執行此腳本"
    exit 1
fi

# 檢查 wrangler 是否安裝
if ! command -v wrangler &> /dev/null; then
    log_error "wrangler CLI 未安裝，請先安裝: npm install -g wrangler"
    exit 1
fi

# 檢查是否已登入 Cloudflare
if ! wrangler whoami &> /dev/null; then
    log_error "請先登入 Cloudflare: wrangler login"
    exit 1
fi

log_info "開始部署 Social Connect Workers..."
echo "=================================="

# 部署 Telegram Worker (新聞摘要推送)
log_info "部署 Telegram Worker..."
cd telegram-worker
log_info "安裝依賴..."
pnpm install
log_info "部署到 Cloudflare Workers..."
pnpm run deploy
if [ $? -eq 0 ]; then
    log_success "Telegram Worker 部署成功"
else
    log_error "Telegram Worker 部署失敗"
    exit 1
fi
cd ..

echo ""

# 部署 Telegram Bot Worker (互動機器人)
log_info "部署 Telegram Bot Worker..."
cd telegram-bot-worker
log_info "安裝依賴..."
pnpm install
log_info "部署到 Cloudflare Workers..."
pnpm run deploy
if [ $? -eq 0 ]; then
    log_success "Telegram Bot Worker 部署成功"
else
    log_error "Telegram Bot Worker 部署失敗"
    exit 1
fi
cd ..

echo ""

# 部署 Twitter Summary Worker (Twitter 自動發文)
log_info "部署 Twitter Summary Worker..."
cd twitter-summary-worker
log_info "安裝依賴..."
pnpm install
log_info "部署到 Cloudflare Workers..."
pnpm run deploy
if [ $? -eq 0 ]; then
    log_success "Twitter Summary Worker 部署成功"
else
    log_error "Twitter Summary Worker 部署失敗"
    exit 1
fi
cd ..

echo ""
echo "=================================="
log_success "🎉 所有 Social Connect Workers 部署完成！"
echo ""
log_info "部署的 Workers:"
log_info "1. 📱 Telegram Worker - 每3小時推送新聞摘要到 Telegram"
log_info "2. 🤖 Telegram Bot Worker - Telegram 互動機器人"
log_info "3. 🐦 Twitter Summary Worker - 每4小時自動發布重要新聞到 Twitter"
echo ""
log_warning "請確保："
log_warning "1. 所有環境變數都已在 Cloudflare Workers 設定"
log_warning "2. Cron triggers 已正確配置"
log_warning "3. 資料庫表格已創建 (執行 twitter_posts_table.sql)"
echo ""
log_info "查看部署狀態: wrangler deployments list"
log_info "查看即時日誌: wrangler tail <worker-name>"