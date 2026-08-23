# Marks pre-existing Telegram accounts as onboarded.
#
# New Telegram accounts are created onboarded, because Telegram already gives us the name. Every
# account made before that change still carries onboardingCompleted=false, and the bot's /start
# handler reads that as "unfinished profile": it sends the onboarding nudge and returns early, so
# those users get no welcome, no refreshed reply keyboard and no menu button, and land in a
# registration form new users no longer see.
#
# Runs from YOUR machine: the endpoint is public HTTPS and CRON_SECRET already lives in
# .env.deploy.local. Sends nothing to anyone, and is safe to run twice.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
$secret = $dv['CRON_SECRET']
if (-not $secret) { throw "CRON_SECRET missing from .env.deploy.local" }

$r = Invoke-RestMethod -Method Post -Uri "https://gigora.ai/api/cron/onboarding-backfill" `
  -Headers @{ Authorization = "Bearer $secret" }

"pending before: $($r.pending)"
"updated:        $($r.updated)"
if ($r.updated -gt 0) {
  "$($r.updated) existing user(s) will now get the welcome and keyboard on /start instead of the onboarding form."
} else {
  "nothing to do - every Telegram account is already marked onboarded."
}
