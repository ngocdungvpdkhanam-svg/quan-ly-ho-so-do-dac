@echo off
chcp 65001 > nul
title Đẩy mã nguồn lên GitHub để triển khai Cloud
echo =======================================================================
echo   HƯỚNG DẪN ĐẨY DỰ ÁN LÊN GITHUB ĐỂ NỐI VÀO RENDER.COM HOẶC RAILWAY
echo =======================================================================
echo.
echo Bước 1: Mở https://github.com/new và tạo 1 kho lưu trữ (Repository) mới.
echo         Đặt tên là: quan-ly-ho-so-do-dac (để chế độ Public hoặc Private)
echo.
echo Bước 2: Copy đường dẫn repository vừa tạo (Ví dụ: https://github.com/username/quan-ly-ho-so-do-dac.git)
echo.
set /p REPO_URL="Dán đường dẫn GitHub của bạn vào đây: "

if "%REPO_URL%"=="" (
    echo Chưa nhập đường dẫn. Vui lòng chạy lại!
    pause
    exit /b
)

echo.
echo Đang đồng bộ mã nguồn lên GitHub...
cd /d "%~dp0"
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo =======================================================================
echo HOÀN TẤT ĐẨY MÃ NGUỒN LÊN GITHUB!
echo Bây giờ bạn chỉ cần vào https://dashboard.render.com -> New Web Service
echo -> Chọn kho GitHub này -> Bấm Deploy là xong!
echo =======================================================================
pause
