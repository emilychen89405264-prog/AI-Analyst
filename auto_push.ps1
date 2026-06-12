# auto_push.ps1
# 每天自動把 trade_history.json 從 MT5 複製到 GitHub repo 並推送
# 由 Windows 工作排程器每天呼叫

# ── 設定區（請依實際路徑修改）──────────────────────────────
$MT5FilesPath = "C:\Users\emily\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Files\trade_history.json"
$RepoDirPath  = "C:\Users\emily\OneDrive\Desktop\WE_Happy\AI-Analyst"
$RepoJsonPath = "$RepoDirPath\trade_history.json"
# ────────────────────────────────────────────────────────────

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host "[$timestamp] AutoSync 開始執行..."

# 1. 確認 MT5 JSON 存在
if (-not (Test-Path $MT5FilesPath)) {
    Write-Host "❌ 找不到 MT5 JSON 檔案: $MT5FilesPath"
    Write-Host "   請確認 AutoSync_EA 已在 MT5 執行並完成匯出"
    exit 1
}

# 2. 複製 JSON 到 repo
Copy-Item -Path $MT5FilesPath -Destination $RepoJsonPath -Force
Write-Host "✅ 已複製 JSON 到 repo"

# 3. Git push
Set-Location $RepoDirPath

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "ℹ️  沒有變更，跳過 commit"
    exit 0
}

git add trade_history.json
git commit -m "auto: update trade history $timestamp"
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 成功推送到 GitHub！Vercel 將自動部署。"
} else {
    Write-Host "❌ git push 失敗，請確認 GitHub 憑證設定"
    exit 1
}
