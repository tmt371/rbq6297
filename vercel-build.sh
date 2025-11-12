#!/bin/bash

# 發生錯誤時立即停止
set -e

echo "STEP 1: Injecting Firebase API Key..."
# 1. 複製範例檔
cp 04-core-code/config/firebase-config.example.js 04-core-code/config/firebase-config.js

# 2. 執行金鑰替換 (已移除 \$)
# Vercel 的 shell 會自動將 $FIREBASE_API_KEY 擴展為其值
sed -i "s/\[在此貼上您的 Google API 金鑰\]/$FIREBASE_API_KEY/g" 04-core-code/config/firebase-config.js

echo "STEP 2: Creating 'public' output directory..."
# 3. 建立 Vercel 需要的 public 資料夾
mkdir public

echo "STEP 3: Copying root files (index.html, style.css)..."
# 4. 複製根目錄的檔案
cp index.html style.css public/

echo "STEP 4: Copying project folders (03-data-models, 04-core-code)..."
# 5. 複製所有的程式碼和資料夾
cp -r 03-data-models 04-core-code public/

echo "Build Complete. Output generated in 'public' directory."
