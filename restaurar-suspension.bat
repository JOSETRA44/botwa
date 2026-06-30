@echo off
echo ========================================
echo   RESTAURAR CONFIGURACION NORMAL
echo ========================================
echo.
echo Restaurando configuracion de energia...
echo.

REM Restaurar suspension normal
powercfg /change standby-timeout-ac 30
powercfg /change standby-timeout-dc 15
powercfg /change monitor-timeout-ac 10
powercfg /change monitor-timeout-dc 5

echo [OK] Suspension restaurada a valores normales
echo [OK] Laptop: 30 min (cable) / 15 min (bateria)
echo [OK] Pantalla: 10 min (cable) / 5 min (bateria)
echo.
pause
