@echo off
echo Emergency Fix for queue_number Issue
echo ===================================
echo.

cd /d "c:\Users\sanga\OneDrive\Desktop\No-Q"

echo Step 1: Adding queue_number column if missing...
psql -h localhost -U postgres -d noq_db -c "ALTER TABLE patients ADD COLUMN IF NOT EXISTS queue_number INTEGER;" 2>nul

if errorlevel 1 (
    echo PostgreSQL command failed. Trying alternative approach...
    echo Please run fix-issues.bat manually to add the missing column.
) else (
    echo ✅ queue_number column check completed
)

echo.
echo Step 2: Starting the server...
echo.
echo If you still get the queue_number error, the server needs to be restarted.
echo Press Ctrl+C to stop the current server, then run this script again.
echo.

npm start

pause
