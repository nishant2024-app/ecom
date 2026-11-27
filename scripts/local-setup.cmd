@echo off
rem Windows launcher: scripts\local-setup.cmd you@gmail.com
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0local-setup.ps1" %*
