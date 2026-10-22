@echo off
chcp 65001 > nul
title Mở kết nối Online 4G tức thì qua Cloudflare/Localtunnel
echo =======================================================================
echo   PHÁT LINK TRANG WEB RA INTERNET CHO ĐIỆN THOẠI 4G TRUY CẬP
echo =======================================================================
echo.
echo Đang tạo link HTTPS công khai...
npx --yes localtunnel --port 3000
pause
