@echo off
powershell -NoProfile -Command "$self = $PID; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -like '*discord-bots\c00lkidd\watchdog.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
powershell -NoProfile -Command "$self = $PID; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -like '*discord-bots\c00lkidd\bot.ts*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
