# Deploys the FreelanceAI Docker Compose project to the Hostinger VPS by calling the
# Hostinger API directly. Reads the Hostinger token from .mcp.json and the deploy
# secrets from .env.deploy.local (both git-ignored). Secrets are sent to the API only —
# never printed. Safe to commit (contains no secrets).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vmId = 1411263

# Hostinger API token (from the local MCP config)
$mcp = Get-Content "$root\.mcp.json" -Raw | ConvertFrom-Json
$hToken = $mcp.mcpServers.hostinger.env.HOSTINGER_API_TOKEN
if (-not $hToken) { throw "HOSTINGER_API_TOKEN not found in .mcp.json" }

# Deploy secrets (from the git-ignored env file)
$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
$needed = 'POSTGRES_PASSWORD', 'SESSION_SECRET', 'CLOUDFLARE_TUNNEL_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET', 'AUTH_SECRET'
foreach ($k in $needed) {
  if (-not $dv[$k] -or $dv[$k] -match 'PASTE_') { throw "$k missing/placeholder in .env.deploy.local" }
}
# Optional vars: included only if present (e.g. the admin allowlist may be empty).
$optional = 'ADMIN_TELEGRAM_IDS', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'
$lines = @($needed | ForEach-Object { "$_=$($dv[$_])" })
foreach ($k in $optional) { if ($dv[$k] -and $dv[$k] -notmatch 'PASTE_') { $lines += "$k=$($dv[$k])" } }
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
