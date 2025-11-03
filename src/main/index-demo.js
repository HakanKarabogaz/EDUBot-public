/**
 * Main Process Entry Point - Demo Version
 * 
 * ⚠️ This is a placeholder file for the public repository.
 * The actual Electron main process logic is in the private repository.
 * 
 * Production version includes:
 * - Electron BrowserWindow configuration
 * - Database initialization and connection management
 * - Workflow executor integration
 * - IPC handlers registration (workflows, data sources, logs, hybrid imports)
 * - Menu bar and system tray integration
 * - Auto-updater configuration
 * - Crash reporting
 * - Performance monitoring
 * - Security policies (CSP, sandbox, contextIsolation)
 * - File system operations
 * - External URL handling
 * - Window state persistence
 * 
 * For the complete implementation, see the private EDUBot repository.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    // Production implementation in private repository
    console.log('Creating main window (demo version)');
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload.js')
        }
    });

    // Load renderer process
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
