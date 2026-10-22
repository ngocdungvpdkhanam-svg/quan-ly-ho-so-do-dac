[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "   ĐỒNG BỘ MÃ NGUỒN LÊN GITHUB ĐỂ KÍCH HOẠT TRANG WEB TRÊN RENDER" -ForegroundColor Yellow
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Bạn hãy mở https://github.com/new trên trình duyệt và bấm 'Create repository'." -ForegroundColor White
Write-Host "2. Copy link repository (Ví dụ: https://github.com/ten-cua-ban/quan-ly-ho-so-do-dac.git)" -ForegroundColor White
Write-Host ""

$repoUrl = Read-Host "Dán đường dẫn GitHub của bạn vào đây"
if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "Chưa nhập đường link. Vui lòng chạy lại!" -ForegroundColor Red
    pause
    exit
}

$repoUrl = $repoUrl.Trim()
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Đang đẩy toàn bộ mã nguồn lên GitHub: $repoUrl ..." -ForegroundColor Green

git remote remove origin 2>$null
git remote add origin $repoUrl
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Cyan
    Write-Host " THÀNH CÔNG! Toàn bộ mã nguồn đã có trên GitHub." -ForegroundColor Green
    Write-Host " Bây giờ bạn vào: https://dashboard.render.com -> New Web Service để mở web!" -ForegroundColor Yellow
    Write-Host "=======================================================================" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Có thể cần đăng nhập tài khoản GitHub hoặc kiểm tra lại đường link." -ForegroundColor Red
}

pause
