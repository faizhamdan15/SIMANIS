$ErrorActionPreference = "Stop"
$InstallDir = Join-Path $env:ProgramFiles "SIMANIS Scanner Bridge"
$DataDir = Join-Path $env:ProgramData "SIMANIS-Scanner-Bridge"
$Exe = Join-Path $InstallDir "SIMANIS-Scanner-Bridge.exe"
$Task = "SIMANIS Scanner Bridge"

New-Item -ItemType Directory -Force -Path $InstallDir,$DataDir | Out-Null
Copy-Item "$PSScriptRoot\SIMANIS-Scanner-Bridge.exe" $Exe -Force

$token = Read-Host "Masukkan DEVICE TOKEN SIMANIS Scanner Bridge"
$port = Read-Host "COM port scanner (kosongkan untuk auto)"
if ([string]::IsNullOrWhiteSpace($port)) { $port = "auto" }

@{
  api_url = "https://zevdqmrlcrnwkeqejbxm.supabase.co/functions/v1/scanner-bridge"
  device_token = $token
  device_name = "SIMANIS Scanner Bridge - Kiosk Utama"
  scanner_port = $port
  baud_rate = 9600
  reconnect_seconds = 3
  http_timeout_seconds = 10
} | ConvertTo-Json | Set-Content (Join-Path $DataDir "config.json") -Encoding UTF8

schtasks.exe /Delete /TN $Task /F 2>$null | Out-Null
$TaskRun = '"' + $Exe + '"'
schtasks.exe /Create /TN $Task /TR $TaskRun /SC ONLOGON /RL HIGHEST /F | Out-Null
Start-Process $Exe -WorkingDirectory $InstallDir

Write-Host "SIMANIS Scanner Bridge terpasang dan dijalankan." -ForegroundColor Green
