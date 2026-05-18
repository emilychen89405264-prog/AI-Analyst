@echo off
cd /d "c:\Users\emily\OneDrive\Desktop\WE_Happy\AI-Analyst"

:: 1. 啟動 MT5 (如果你的安裝路徑不同，請修改)
start "" "C:\Program Files\MetaTrader 5\terminal64.exe"

:: 等待 10 秒讓 MT5 完全啟動
timeout /t 10 /nobreak >nul

:: 2. 啟動 Node.js 伺服器
start "AI Server" cmd /c "npm run server"

:: 3. 啟動 Ngrok
start "Ngrok" cmd /c "npx ngrok http --url=operation-liqueur-salad.ngrok-free.dev 3001"

:: 4. 啟動 Python Bot (如果 server.ts 已經會呼叫則不需要，視情況開啟)
:: start "MT5 AI Bot" cmd /c "python mt5_ai_bot.py"
