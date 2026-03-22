# Comprehensive script to rename darkagent to wardex throughout the project

Write-Host "Starting comprehensive rename: darkagent -> wardex" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Files to process (excluding node_modules, .git, dist, cache)
$filesToProcess = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\node_modules\\' -and
    $_.FullName -notmatch '\\.git\\' -and
    $_.FullName -notmatch '\\dist\\' -and
    $_.FullName -notmatch '\\cache\\' -and
    $_.FullName -notmatch '\\artifacts\\' -and
    $_.Extension -match '\.(js|jsx|ts|tsx|json|md|sol|txt|env|example|yaml|yml|toml)$'
}

$totalFiles = $filesToProcess.Count
$processedFiles = 0
$modifiedFiles = 0

Write-Host "Found $totalFiles files to process" -ForegroundColor Yellow
Write-Host ""

foreach ($file in $filesToProcess) {
    $processedFiles++
    $relativePath = $file.FullName.Replace((Get-Location).Path, "").TrimStart('\')
    
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction Stop
        $originalContent = $content
        
        # Replace all variations
        $content = $content -replace 'darkagent', 'wardex'
        $content = $content -replace 'DarkAgent', 'Wardex'
        $content = $content -replace 'DARKAGENT', 'WARDEX'
        $content = $content -replace 'darkAgent', 'wardex'
        
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            $modifiedFiles++
            Write-Host "[$processedFiles/$totalFiles] Modified: $relativePath" -ForegroundColor Green
        } else {
            Write-Host "[$processedFiles/$totalFiles] Skipped: $relativePath" -ForegroundColor Gray
        }
    } catch {
        Write-Host "[$processedFiles/$totalFiles] Error: $relativePath - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rename complete!" -ForegroundColor Green
Write-Host "Total files processed: $processedFiles" -ForegroundColor Yellow
Write-Host "Files modified: $modifiedFiles" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review changes: git diff" -ForegroundColor White
Write-Host "2. Test compilation: npm run compile" -ForegroundColor White
Write-Host "3. Commit changes: git add . && git commit -m 'Rename darkagent to wardex'" -ForegroundColor White
Write-Host "4. Push changes: git push" -ForegroundColor White
