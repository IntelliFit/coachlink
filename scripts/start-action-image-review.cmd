@echo off
cd /d "%~dp0.."
node scripts/action-image-review-server.mjs
pause
