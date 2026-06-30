@echo off
echo ========================================
echo   MANTENER LAPTOP ACTIVA - BOT 24/7
echo ========================================
echo.
echo Este script evita que la laptop entre en suspension
echo mientras el bot esta corriendo.
echo.
echo Presiona Ctrl+C para detener
echo ========================================
echo.

REM Evitar que la laptop se suspenda
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 30
powercfg /change monitor-timeout-dc 15

echo [OK] Suspension desactivada
echo [OK] Pantalla se apagara en 30 min (con cable) / 15 min (bateria)
echo.
echo El bot puede correr en segundo plano ahora.
echo.
pause
