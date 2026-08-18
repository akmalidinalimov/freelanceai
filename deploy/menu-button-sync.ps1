# Backfills the Telegram Mini App menu button for users paired before the marker existed.
#
# Telegram stores that button per chat and never refreshes it, and the webhook only sets it
# when a user messages the bot — so anyone paired earlier still launches an unmarked URL and
# sees our web chrome flash on EVERY launch. This pushes a current, marked button to all of
# them. It sends the user nothing, and it is safe to re-run: setting the same button twice is
# a silent no-op.
#
# Runs from YOUR machine, not the VPS — the endpoint is public HTTPS and CRON_SECRET already
# lives in .env.deploy.local (git-ignored). The secret is never printed.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
$secret = $dv['CRON_SECRET']
if (-not $secret) { throw "CRON_SECRET missing from .env.deploy.local" }

$base = "https://gigora.ai/api/cron/menu-button-sync"
$headers = @{ Authorization = "Bearer $secret" }
$cursor = $null
$round = 0
$ok = 0; $failed = 0; $blocked = 0; $processed = 0

do {
  $round++
  $uri = if ($cursor) { "${base}?cursor=$cursor" } else { $base }
  $r = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers

  if ($r.skipped -eq "locked") {
    "another sync is already running - stopping (re-run when it finishes)"
    break
  }

  $ok += $r.ok; $failed += $r.failed; $blocked += $r.blocked; $processed += $r.processed
  if ($round -eq 1 -and $r.total) { "targets: $($r.total) paired users" }
  "round ${round}: processed=$($r.processed) ok=$($r.ok) failed=$($r.failed) blocked=$($r.blocked) done=$($r.done)"

  # Guard against a cursor that never advances (would otherwise loop forever).
  if (-not $r.done -and $r.nextCursor -eq $cursor) {
    throw "cursor did not advance ($cursor) - stopping to avoid an infinite loop"
  }
  $cursor = $r.nextCursor
} while (-not $r.done)

""
"TOTAL  processed=$processed  ok=$ok  failed=$failed  blocked=$blocked"
if ($failed -gt 0) { "NOTE: $failed call(s) failed - re-run to retry them" }
if ($blocked -gt 0) { "NOTE: $blocked user(s) had blocked the bot - now marked, future fan-outs skip them" }
