# Deploys the FreelanceAI Docker Compose project to the Hostinger VPS by calling the
# Hostinger API directly. Reads the Hostinger token from .mcp.json and the deploy
# secrets from .env.deploy.local (both git-ignored). Secrets are sent to the API only —
# never printed. Safe to commit (contains no secrets).
# By default, runs the full post-deploy verification once the app is live. Pass
# -SkipVerify to only submit the deploy (fire-and-forget).
# -Sha <commit>: deploy a specific commit instead of origin/main's tip. This is the
# ROLLBACK lever: redeploying yesterday's SHA restores yesterday's code deterministically.
param([switch]$SkipVerify, [string]$Sha)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vmId = 1411263

# Pin the deploy to one commit: migrate + app containers both check out exactly this
# SHA, so a push mid-deploy can't skew them apart.
if (-not $Sha) {
  $remote = git -C $root ls-remote origin main 2>$null
  if ($LASTEXITCODE -eq 0 -and $remote) { $Sha = ($remote -split "\s+")[0] }
}
if ($Sha) { "deploying commit: $Sha" } else { "WARNING: could not resolve origin/main SHA - containers will use :latest image" }

# The app+migrate containers PULL ghcr.io/<repo>:<sha> (built by the image workflow on
# push). Wait until that image exists — deploying before the build finishes would fail.
if ($Sha) {
  $img = "akmalidinalimov/freelanceai"
  $tok = (Invoke-RestMethod "https://ghcr.io/token?scope=repository:${img}:pull").token
  $mh = @{
    Authorization = "Bearer $tok"
    Accept        = "application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json"
  }
  $deadline = (Get-Date).AddMinutes(15)
  $ready = $false
  Write-Host "waiting for image ghcr.io/${img}:$Sha ..." -NoNewline
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Method Head -Uri "https://ghcr.io/v2/$img/manifests/$Sha" -Headers $mh -UseBasicParsing | Out-Null
      $ready = $true; break
    } catch { Write-Host "." -NoNewline; Start-Sleep -Seconds 20 }
  }
  Write-Host ""
  if (-not $ready) { throw "image for $Sha not in GHCR after 15 min - check the 'image' workflow run" }
  "image ready: ghcr.io/${img}:$Sha"
}

# Hostinger API token (from the local MCP config)
$mcp = Get-Content "$root\.mcp.json" -Raw | ConvertFrom-Json
$hToken = $mcp.mcpServers.hostinger.env.HOSTINGER_API_TOKEN
if (-not $hToken) { throw "HOSTINGER_API_TOKEN not found in .mcp.json" }

# Deploy secrets (from the git-ignored env file)
$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
# PII_ENCRYPTION_KEY is REQUIRED: encryptPII fails closed (throws) in production, so a
# deploy that stripped the key would 500 every KYC/Instagram PII write.
$needed = 'POSTGRES_PASSWORD', 'SESSION_SECRET', 'CLOUDFLARE_TUNNEL_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET', 'AUTH_SECRET', 'PII_ENCRYPTION_KEY'
foreach ($k in $needed) {
  if (-not $dv[$k] -or $dv[$k] -match 'PASTE_') { throw "$k missing/placeholder in .env.deploy.local" }
}
# Optional vars: included only if present (e.g. the admin allowlist may be empty).
$optional = 'ADMIN_TELEGRAM_IDS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
'S3_ENDPOINT', 'S3_BUCKET', 'S3_PRIVATE_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL',
'RESEND_API_KEY', 'EMAIL_FROM', 'CRON_SECRET',
'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'
$lines = @($needed | ForEach-Object { "$_=$($dv[$_])" })
foreach ($k in $optional) { if ($dv[$k] -and $dv[$k] -notmatch 'PASTE_') { $lines += "$k=$($dv[$k])" } }
if ($Sha) { $lines += "GIT_SHA=$Sha" }
# [string] casts avoid a PowerShell 5.1 ConvertTo-Json quirk that wraps strings as {value,Count}.
$envStr = [string]($lines -join "`n")
$content = [string](Get-Content "$root\deploy\docker-compose.prod.yml" -Raw)

# Call the Hostinger API (replaces the existing 'freelanceai' project)
$obj = [pscustomobject]@{ project_name = "freelanceai"; content = $content; environment = $envStr }
$bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
$headers = @{ Authorization = "Bearer $hToken"; Accept = "application/json" }
$uri = "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vmId/docker"
$resp = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $bytes
"deploy submitted: action id=$($resp.id) name=$($resp.name) state=$($resp.state)"

# Post-deploy verification: wait for the new build to come up, then run the full prod
# check suite (smoke + deep sweep + R2). Skips only if -SkipVerify was passed.
if (-not $SkipVerify) {
  Write-Host "`n--- Post-deploy verification (waits for prod, then smoke + deep sweep + R2) ---"
  node "$root\deploy\verify-prod.mjs"
  if ($LASTEXITCODE -ne 0) { throw "Post-deploy verification FAILED (see output above)" }
  Write-Host "`nDeploy + verification complete."
}
