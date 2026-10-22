@echo off
chcp 65001 > nul
title Hệ thống Quản lý Hồ sơ Đo đạc Địa chính - VPĐK Đất đai
echo =======================================================================
echo   HỆ THỐNG QUẢN LÝ HỒ SƠ ĐO ĐẠC ĐỊA CHÍNH - PHÒNG KỸ THUẬT
echo   Văn phòng Đăng ký Đất đai
echo =======================================================================
echo.
echo Đang khởi động máy chủ...
cd /d "%~dp0"
node server.js
pause
