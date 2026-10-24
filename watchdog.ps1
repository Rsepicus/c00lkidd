$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bun = 'C:\Users\Rsepicus\AppData\Roaming\npm\node_modules\bun\bin\bun.exe'
Set-Location $root

while ($true) {
  $process = Start-Process -FilePath $bun `
    -ArgumentList (Join-Path $root 'bot.ts') `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput (Join-Path $root 'bot.log') `
    -RedirectStandardError (Join-Path $root 'bot.err.log')
  $process.WaitForExit()
  Start-Sleep -Seconds 5
}
