#!/bin/bash

# Git 歷史清理腳本 - 移除敏感 API keys

set -e  # 遇到錯誤立即退出

echo "🚨 開始清理 Git 歷史中的敏感信息..."

# 確保在正確的目錄
cd /Users/chinyu/Documents/OpenNews

# 檢查是否安裝了 git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo "📦 安裝 git-filter-repo..."
    pip3 install git-filter-repo
fi

# 創建包含敏感文件的列表
echo "📝 創建敏感文件列表..."
cat > sensitive-files.txt << 'EOF'
social/twitter-summary/wrangler.jsonc
social-connect/twitter-summary-worker/wrangler.jsonc
social-connect/telegram-worker/wrangler.jsonc
social-connect/telegram-bot-worker/wrangler.jsonc
telegram/wrangler.jsonc
telegram-bot/wrangler.jsonc
twitter-summary/wrangler.jsonc
EOF

echo "📋 將要移除的敏感文件："
cat sensitive-files.txt

# 備份當前狀態
echo "💾 創建備份..."
git branch backup-before-cleanup 2>/dev/null || echo "備份分支已存在"

# 使用 git filter-repo 移除敏感文件
echo "🧹 從 Git 歷史中移除敏感文件..."
git filter-repo --paths-from-file sensitive-files.txt --invert-paths --force

# 清理 reflog 和垃圾回收
echo "🗑️  清理本地 Git 數據..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Git 歷史清理完成！"
echo ""
echo "⚠️  接下來需要執行："
echo "1. git remote add origin <your-github-url>  # 重新添加遠程倉庫"
echo "2. git push origin --force --all           # Force push 所有分支"
echo "3. git push origin --force --tags          # Force push 所有標籤"
echo ""
echo "🚨 重要提醒："
echo "- 通知所有協作者重新 clone 這個倉庫"
echo "- 確保已經撤銷了所有暴露的 API keys"
echo "- 檢查 GitHub 上的 commit 歷史確認清理成功"

# 清理臨時文件
rm -f sensitive-files.txt

echo "🎉 腳本執行完成！"