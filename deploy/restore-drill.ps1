# Runs the backup restore drill as a throwaway Docker project ("restoredrill") on the
# VPS — separate from prod. Reads secrets like deploy-vps.ps1 (never prints them).
# Results appear in the project logs; delete the project afterwards.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$vmId = 1411263

$mcp = Get-Content "$root\.mcp.json" -Raw | ConvertFrom-Json
$hToken = $mcp.mcpServers.hostinger.env.HOSTINGER_API_TOKEN
if (-not $hToken) { throw "HOSTINGER_API_TOKEN not found in .mcp.json" }

$dv = @{}
Get-Content "$root\.env.deploy.local" | Where-Object { $_ -match '^\s*[A-Z]' } | ForEach-Object {
  $k, $v = $_ -split '=', 2; $dv[$k.Trim()] = $v.Trim()
}
$needed = 'S3_ENDPOINT', 'S3_PRIVATE_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'
foreach ($k in $needed) { if (-not $dv[$k]) { throw "$k missing in .env.deploy.local" } }

$envStr = [string](($needed | ForEach-Object { "$_=$($dv[$_])" }) -join "`n")
$content = [string](Get-Content "$root\deploy\restore-drill-compose.yml" -Raw)

$obj = [pscustomobject]@{ project_name = "restoredrill"; content = $content; environment = $envStr }
$bytes = [System.Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
$headers = @{ Authorization = "Bearer $hToken"; Accept = "application/json" }
$uri = "https://developers.hostinger.com/api/vps/v1/virtual-machines/$vmId/docker"
$resp = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json" -Body $bytes
"restore drill submitted: action id=$($resp.id) state=$($resp.state) - check project logs for [drill] lines, then DELETE the restoredrill project"
