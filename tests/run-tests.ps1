# Hypersheet Test Runner
# Run from the project root

param(
    [string]$Target = "grid",
    [string]$Url = "http://localhost:8000"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "=== Hypersheet E2E Test Runner ===" -ForegroundColor Cyan
Write-Host "Target: $Target"
Write-Host "URL: $Url"
Write-Host ""

# Check if Playwright is installed
$playwright = Get-Command npx -ErrorAction SilentlyContinue
if (-not $playwright) {
    Write-Host "ERROR: Node.js / npx not found. Install Node.js first." -ForegroundColor Red
    exit 1
}

# Determine which test file to run
$testFile = switch ($Target) {
    "grid" { "tests/playwright/grid.spec.js" }
    "keyboard" { "tests/playwright/keyboard-shortcuts.spec.js" }
    "errors" { "tests/playwright/error-capture.spec.js" }
    "all" { "tests/playwright/" }
    default { "tests/playwright/$Target.spec.js" }
}

# Check if test file exists
if (-not (Test-Path $testFile)) {
    Write-Host "ERROR: Test file not found: $testFile" -ForegroundColor Red
    exit 1
}

Write-Host "Test file: $testFile" -ForegroundColor Yellow

# Set grid URL env var
$env:GRID_URL = $Url

# Run Playwright tests
Write-Host "`nRunning Playwright tests..." -ForegroundColor Green
npx playwright test $testFile --config=tests/playwright/playwright.config.js --reporter=list

$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Host "`n✅ All tests passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Some tests failed (exit code: $exitCode)" -ForegroundColor Red
}
exit $exitCode
