@echo off
chcp 65001 >nul
title Origo Squad
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale o Node.js 22 LTS em https://nodejs.org e abra este arquivo de novo. & pause & exit /b 1)
if not exist node_modules (
  echo Instalando o squad pela primeira vez, leva um minuto...
  call npm install || (pause & exit /b 1)
)
if not exist .env copy .env.exemplo .env >nul
node servidor.mjs
pause
