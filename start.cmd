@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "Start-Process -FilePath 'C:\Users\Rsepicus\AppData\Roaming\npm\node_modules\bun\bin\bun.exe' -ArgumentList '%~dp0watchdog.ts' -WorkingDirectory '%~dp0' -WindowStyle Hidden -RedirectStandardOutput '%~dp0bot.log' -RedirectStandardError '%~dp0bot.err.log'"
