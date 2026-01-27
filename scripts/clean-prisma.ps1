# Clean Prisma / Node artifacts and reinstall. Run from repo root.
# Usage: .\scripts\clean-prisma.ps1
# Optional: pass -KillNode to stop node processes using this repo (use with caution).

param(
    [switch]$KillNode
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot | Split-Path -Parent
Set-Location $root

Write-Host "Cleaning RCCalendar workspace..." -ForegroundColor Cyan

if ($KillNode) {
    Write-Host "Stopping node processes in repo tree (optional)..." -ForegroundColor Yellow
    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($root) } | Stop-Process -Force -ErrorAction SilentlyContinue
}

$dirs = @(
    "node_modules",
    "apps\api\dist",
    "apps\web\.next"
)
foreach ($d in $dirs) {
    $p = Join-Path $root $d
    if (Test-Path $p) {
        Write-Host "  Removing $d ..." -ForegroundColor Gray
        Remove-Item -Recurse -Force $p
    }
}

Write-Host "Pruning pnpm store..." -ForegroundColor Cyan
pnpm store prune

Write-Host "Running pnpm install..." -ForegroundColor Cyan
pnpm install

Write-Host "Done. Next: pnpm db:generate, pnpm db:migrate, pnpm db:seed" -ForegroundColor Green
