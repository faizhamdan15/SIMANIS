$ErrorActionPreference = "SilentlyContinue"
schtasks.exe /End /TN "SIMANIS Scanner Bridge" | Out-Null
schtasks.exe /Delete /TN "SIMANIS Scanner Bridge" /F | Out-Null
Remove-Item (Join-Path $env:ProgramFiles "SIMANIS Scanner Bridge") -Recurse -Force
Write-Host "Bridge dihapus. Data ProgramData dipertahankan."
