# Registers the Telegram bot webhook for deep-link login. Reads the bot token and
# webhook secret from .env.deploy.local (git-ignored). The bot token is never printed.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
$token = $dv['TELEGRAM_BOT_TOKEN']
$secret = $dv['TELEGRAM_WEBHOOK_SECRET']
if (-not $token -or -not $secret) { throw "TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET missing" }

$webhookUrl = "https://freelanceai.aicreator.academy/api/telegram/webhook"
$body = @{ url = $webhookUrl; secret_token = $secret; allowed_updates = @("message"); drop_pending_updates = $true } | ConvertTo-Json
$set = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -ContentType "application/json" -Body $body
"setWebhook: ok=$($set.ok) desc=$($set.description)"

$info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
"webhook url: $($info.result.url)"
"pending updates: $($info.result.pending_update_count)"
"last error: $($info.result.last_error_message)"
