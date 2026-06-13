param(
  [Parameter(Mandatory = $true)]
  [string]$Otp
)

$tarballs = Get-ChildItem "$PSScriptRoot\..\dist\tarballs\*.tgz"
Write-Host "Publishing $($tarballs.Count) packages..." -ForegroundColor Cyan

foreach ($tb in $tarballs) {
  Write-Host "  Publishing $($tb.Name)..." -NoNewline
  npm publish $tb.FullName --access public --otp $Otp
  if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
  } else {
    Write-Host " FAILED" -ForegroundColor Red
  }
}
