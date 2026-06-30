@echo off
echo ========================================
echo   INICIAR BOT EN SEGUNDO PLANO
echo ========================================
echo.
echo Iniciando bot en segundo plano...
echo Puedes minimizar esta ventana o cerrarla.
echo.

REM Iniciar bot en segundo plano (sin ventana visible)
start /B node bot.js

echo [OK] Bot iniciado en segundo plano
echo.
echo Para ver si esta corriendo:
echo   - Abre el Administrador de Tareas
echo   - Busca "Node.js JavaScript Runtime"
echo.
echo Para detenerlo:
echo   - Usa detener-bot.bat
echo   - O cierra el proceso en el Administrador de Tareas
echo.
pause
