@echo off
echo Updating Story Builder...
git pull origin claude/real-time-story-builder-cWkNR
echo.
echo Starting server...
npx serve .
pause
