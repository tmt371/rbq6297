# 輸出檔案的名稱 (建議副檔名可改為 .txt 或 .xml，這裡使用 .txt 方便您隨時點開看)
$outputFile = "codebase_snapshot.txt"

# 定義要從快照中明確排除的檔案
$excludeFile = "04-core-code\config\firebase-config.js"

# 執行前先清空舊檔案，確保快照的純淨度
if (Test-Path $outputFile) {
    Clear-Content $outputFile
}

# 定義要包含的專案原始碼檔案/資料夾列表
$includePaths = @(
    ".gitignore",
    ".gitattributes",
    "package.json",
    "package-lock.json",
    "index.html",
    "admin.html",
    "style.css",
    "jest.config.js",
    "babel.config.js",
    ".eslintrc.json",
    ".prettierrc.json",
    "03-data-models",
    "04-core-code"
)

# 遍歷所有指定的路徑
Get-ChildItem -Path $includePaths -Recurse | Where-Object { 
    !$_.PSIsContainer -and 
    $_.FullName -notlike "*\node_modules\*" -and 
    $_.FullName -notlike "*$excludeFile" 
} | ForEach-Object {
    # 取得相對於腳本執行位置的相對路徑
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    
    # 標準化路徑分隔符，將 Windows 的 '\' 轉換為 UNIX 的 '/'
    $normalizedPath = $relativePath.Replace("\", "/")

    # 【核心修改區】改成 AI 讀取專用的 XML 標籤格式
    Add-Content -Path $outputFile -Value "<file path=`"$normalizedPath`">"
    Add-Content -Path $outputFile -Value (Get-Content $_.FullName -Raw)
    Add-Content -Path $outputFile -Value "</file>`n"
}

Write-Host "Codebase snapshot created successfully (Firebase config excluded): $outputFile"