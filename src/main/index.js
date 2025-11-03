const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const DatabaseManager = require('./database');
// ✅ WorkflowExecutor'ı import ediyoruz
const WorkflowExecutor = require('./workflow-executor');
const IPCHandlers = require('./ipc-handlers');

let mainWindow;
let db = null;
let workflowExecutor = null; // ✅ WorkflowExecutor instance'ı
let ipcHandlers = null;

function createWindow() {
  // ✅ Orijinal preload'a geri dön
  const preloadPath = path.resolve(__dirname, '../preload.js');
  console.log('🔧 Preload path:', preloadPath);
  console.log('📁 Preload exists:', require('fs').existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,    
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true, 
      sandbox: false, // ✅ Electron 28'de sandbox false gerekli
      enableRemoteModule: false,
      preload: preloadPath
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    titleBarStyle: 'default'
  });

  // ✅ Preload yüklenme durumunu kontrol et
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('🌐 Page loaded, checking preload...');
  });

  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('❌ Preload error:', preloadPath, error);
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // 1. Database'i başlat (SQLite3 ile)
    console.log('🔧 Database başlatılıyor...');
    try {
      db = new DatabaseManager();
      await db.init();
      console.log('✅ Database başlatıldı');
    } catch (dbError) {
      console.error('⚠️ Database hatası (devam ediliyor):', dbError.message);
      // Database olmadan devam et
    }
    
    // 2. WorkflowExecutor'ı başlat
    console.log('🔧 Initializing Workflow Executor...');
    workflowExecutor = new WorkflowExecutor();
    if (db) {
      await workflowExecutor.initialize(db); // Database instance'ını geç
    }
    console.log('✅ WorkflowExecutor başlatıldı');
    
    // 3. IPC Handler'ları başlat
    console.log('🔧 IPC Handlers başlatılıyor...');
    ipcHandlers = new IPCHandlers();
    await ipcHandlers.initialize();
    
    // WorkflowExecutor'ı IPC Handlers'a bağla
    if (workflowExecutor) {
      ipcHandlers.setWorkflowExecutor(workflowExecutor);
    }
    
    console.log('✅ IPC Handler\'lar kaydedildi');
    
    // 4. Window'u oluştur
    createWindow();
  } catch (error) {
    console.error('❌ Başlatma hatası:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ==================== IPC HANDLERS ====================

function registerIPCHandlers() {
  
  // ==================== SCREENS ====================
  
  ipcMain.handle('db:createScreen', async (event, data) => {
    try {
      const id = await db.createScreen(data);
      return { success: true, data: { id } };
    } catch (error) {
      console.error('Screen oluşturma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getScreens', async () => {
    try {
      const screens = await db.getAllScreens();
      return screens;//eski durum: { success: true, data: screens }; değil, direk array dönüldü
    } catch (error) {
      console.error('Screen listesi alma hatası:', error);
      return [];//hata durumunda boş array eski:{ success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getScreen', async (event, id) => {
    try {
      const screen = await db.getScreen(id);
      return { success: true, data: screen };
    } catch (error) {
      console.error('Screen alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:updateScreen', async (event, id, data) => {
    try {
      await db.updateScreen(id, data);
      return { success: true };
    } catch (error) {
      console.error('Screen güncelleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:deleteScreen', async (event, id) => {
    try {
      await db.deleteScreen(id);
      return { success: true };
    } catch (error) {
      console.error('Screen silme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== WORKFLOWS ====================

  ipcMain.handle('db:createWorkflow', async (event, data) => {
    try {
      const id = await db.createWorkflow(data);
      return { success: true, data: { id } };
    } catch (error) {
      console.error('Workflow oluşturma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getWorkflows', async () => {
    try {
      const workflows = await db.getAllWorkflows();
      return workflows; // Dashboard direkt array bekliyor
    } catch (error) {
      console.error('Workflow listesi alma hatası:', error);
      return [];
    }
  });

  ipcMain.handle('db:getWorkflow', async (event, id) => {
    try {
      const workflow = await db.getWorkflow(id);
      const steps = await db.getSteps(id);
      return { success: true, data: { ...workflow, steps } };
    } catch (error) {
      console.error('Workflow alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:updateWorkflow', async (event, id, data) => {
    try {
      await db.updateWorkflow(id, data);
      return { success: true };
    } catch (error) {
      console.error('Workflow güncelleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:deleteWorkflow', async (event, id) => {
    try {
      await db.deleteWorkflow(id);
      return { success: true };
    } catch (error) {
      console.error('Workflow silme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== STEPS ====================

  ipcMain.handle('db:createStep', async (event, data) => {
    try {
      const id = await db.createStep(data);
      return { success: true, data: { id } };
    } catch (error) {
      console.error('Step oluşturma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getSteps', async (event, workflowId) => {
    try {
      const steps = await db.getSteps(workflowId);
      return { success: true, data: steps };
    } catch (error) {
      console.error('Step listesi alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:updateStep', async (event, id, data) => {
    try {
      await db.updateStep(id, data);
      return { success: true };
    } catch (error) {
      console.error('Step güncelleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:deleteStep', async (event, id) => {
    try {
      await db.deleteStep(id);
      return { success: true };
    } catch (error) {
      console.error('Step silme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:reorderSteps', async (event, workflowId, stepIds) => {
    try {
      await db.reorderSteps(workflowId, stepIds);
      return { success: true };
    } catch (error) {
      console.error('Step sıralama hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== DATA SOURCES ====================

  ipcMain.handle('db:createDataSource', async (event, data) => {
    try {
      const id = await db.createDataSource(data);
      return { success: true, data: { id } };
    } catch (error) {
      console.error('Data source oluşturma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ✅ Frontend'de getAll() çağrılıyor
  ipcMain.handle('db:getAllDataSources', async () => {
    try {
      const sources = await db.getAllDataSources();
      return sources; // Direkt array dön
    } catch (error) {
      console.error('Data source listesi alma hatası:', error);
      return []; // Hata durumunda boş array
    }
  });

  //yukarıda yine var bu blok o yüzden iptal ettim sonra kaldırılacak tamamen
  //ipcMain.handle('db:getDataSource', async (event, id) => {
  // try {
  //   const source = db.getDataSource(id);
  //    return { success: true, data: source };
  //  } catch (error) {
  //    console.error('Data source alma hatası:', error);
  //    return { success: false, message: error.message };
  //  }
  //});

  ipcMain.handle('db:updateDataSource', async (event, id, data) => {
    try {
      await db.updateDataSource(id, data);
      return { success: true };
    } catch (error) {
      console.error('Data source güncelleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:deleteDataSource', async (event, id) => {
    try {
      await db.deleteDataSource(id);
      return { success: true };
    } catch (error) {
      console.error('Data source silme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== EXECUTION LOGS ====================

  ipcMain.handle('db:createLog', async (event, workflowId, stepId, recordIndex, status, message, errorDetails, executionTime) => {
    try {
      const id = await db.createLog(workflowId, stepId, recordIndex, status, message, errorDetails, executionTime);
      return { success: true, data: { id } };
    } catch (error) {
      console.error('Log oluşturma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getLogs', async (event, workflowId, limit) => {
    try {
      const logs = await db.getLogs(workflowId, limit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Log alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getAllLogs', async (event, filters, limit) => {
    try {
      const logs = await db.getAllLogs(filters, limit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('Tüm logları alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getRecentLogs', async (event, limit = 5) => {
    try {
      const logs = await db.getAllLogs({}, limit);
      return logs.data || [];
    } catch (error) {
      console.error('Son logları alma hatası:', error);
      return [];
    }
  });

  ipcMain.handle('db:clearOldLogs', async (event, daysToKeep) => {
    try {
      await db.clearOldLogs(daysToKeep);
      return { success: true };
    } catch (error) {
      console.error('Eski logları temizleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== RECORDS QUEUE ====================

  ipcMain.handle('db:queueRecords', async (event, workflowId, records) => {
    try {
      await db.queueRecords(workflowId, records);
      return { success: true };
    } catch (error) {
      console.error('Kayıt kuyruğa ekleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getNextRecord', async (event, workflowId) => {
    try {
      const record = await db.getNextRecord(workflowId);
      return { success: true, data: record };
    } catch (error) {
      console.error('Sonraki kayıt alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:updateRecordStatus', async (event, id, status, errorMessage) => {
    try {
      await db.updateRecordStatus(id, status, errorMessage);
      return { success: true };
    } catch (error) {
      console.error('Kayıt durumu güncelleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:getQueueStats', async (event, workflowId) => {
    try {
      const stats = await db.getQueueStats(workflowId);
      return { success: true, data: stats };
    } catch (error) {
      console.error('Kuyruk istatistikleri alma hatası:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('db:clearCompletedRecords', async (event, workflowId) => {
    try {
      await db.clearCompletedRecords(workflowId);
      return { success: true };
    } catch (error) {
      console.error('Tamamlanan kayıtları temizleme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== DASHBOARD STATS ====================

  ipcMain.handle('db:getTodayStats', async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allLogs = await db.getAllLogs({ date: today }, 1000);
      const logs = allLogs.data || [];
      
      // Execution time ortalaması hesapla
      const executionTimes = logs
        .filter(log => log.execution_time)
        .map(log => log.execution_time);
      const avgTime = executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length / 1000)
        : 0;
      
      const stats = {
        todayTotal: logs.filter(log => log.status === 'started').length,
        todaySuccess: logs.filter(log => log.status === 'success').length,
        todayFailed: logs.filter(log => log.status === 'failed').length,
        avgTime: avgTime
      };
      
      return stats;
    } catch (error) {
      console.error('Dashboard istatistikleri alma hatası:', error);
      return {
        todayTotal: 0,
        todaySuccess: 0,
        todayFailed: 0,
        avgTime: 0
      };
    }
  });

  // ==================== WORKFLOW EXECUTION ====================

  ipcMain.handle('workflow:start', async (event, workflowId) => {
    try {
      console.log(`🚀 Workflow başlatılıyor: ${workflowId}`);
      
      // Workflow bilgilerini al
      const workflow = await db.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error('Workflow bulunamadı');
      }
      
      // Log kaydı oluştur
      await db.createLog(
        workflowId,
        null,
        null,
        'started',
        `Workflow başlatıldı: ${workflow.name}`,
        null,
        null
      );
      
      // TODO: Burada gerçek workflow execution logic'i eklenecek
      // Şimdilik sadece başarılı log kaydı oluşturuyoruz
      
      setTimeout(async () => {
        await db.createLog(
          workflowId,
          null,
          null,
          'success',
          `Workflow tamamlandı: ${workflow.name}`,
          null,
          2000
        );
      }, 2000);
      
      return { success: true, message: 'Workflow başlatıldı' };
    } catch (error) {
      console.error('Workflow başlatma hatası:', error);
      
      await db.createLog(
        workflowId,
        null,
        null,
        'failed',
        `Workflow başlatma hatası: ${error.message}`,
        error.stack,
        null
      );
      
      return { success: false, message: error.message };
    }
  });

  // ==================== UTILITY ====================

  ipcMain.handle('db:getStats', async () => {
    try {
      const stats = await db.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('İstatistik alma hatası:', error);
      return { success: false, message: error.message };
    }
  });
// ====================  WorkflowRunner için eklendi 05102025 1940 ====================
// ==================== WORKFLOW RUNNER ====================

// ✅ Veri kaynağından kayıtları yükle (Frontend'de loadRecords() olarak çağrılıyor)
ipcMain.handle('db:loadDataSourceRecords', async (event, sourceId) => {
  try {
    const source = await db.getDataSource(sourceId);
    if (!source) {
      throw new Error('Veri kaynağı bulunamadı');
    }

    // CSV ise parse et
    if (source.data_type === 'csv') {
      return { success: true, data: source.content };
    }
    
    // Static ise direkt dön
    if (source.data_type === 'static') {
      return { success: true, data: source.content };
    }

    return { success: true, data: [] };
  } catch (error) {
    console.error('Kayıtlar yüklenemedi:', error);
    return { success: false, message: error.message };
  }
});

// Workflow'u çalıştır (tek kayıt)
ipcMain.handle('workflow:execute', async (event, workflowId, recordData) => {
  try {
    console.log(`🚀 Workflow çalıştırılıyor: ${workflowId}`, recordData);
    
    // TODO: WorkflowExecutor entegrasyonu
    // Şimdilik mock response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { 
      success: true, 
      message: 'Kayıt işlendi',
      data: recordData 
    };
  } catch (error) {
    console.error('Workflow execution hatası:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

  // ==================== FILE OPERATIONS ====================

  ipcMain.handle('select-csv-file', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fs = require('fs').promises;
        const data = await fs.readFile(filePath, 'utf8');
        return { 
          success: true, 
          data: {
            path: filePath,
            content: data,
            name: path.basename(filePath)
          }
        };
      }
      
      return { success: false, message: 'Dosya seçilmedi' };
    } catch (error) {
      console.error('CSV dosya seçme hatası:', error);
      return { success: false, message: error.message };
    }
  });

  // ==================== SYSTEM INFO ====================

  ipcMain.handle('get-system-info', async () => {
    try {
      const os = require('os');
      return {
        success: true,
        data: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          chromeVersion: process.versions.chrome,
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpus: os.cpus().length
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // ==================== WORKFLOW EXECUTION ====================

  // ✅ Eski handler'ları temizle (eğer varsa)
  try {
    ipcMain.removeHandler('workflow:execute');
    ipcMain.removeHandler('workflow:stop');
    ipcMain.removeHandler('workflow:pause');
    ipcMain.removeHandler('workflow:resume');
    ipcMain.removeHandler('workflow:status');
  } catch (error) {
    // Handler yoksa sorun değil
  }

  // Workflow çalıştırma
  ipcMain.handle('workflow:execute', async (event, workflowId, dataSourceId, options = {}) => {
    try {
      console.log(`🚀 Starting workflow execution: ${workflowId} with data source: ${dataSourceId}`);
      
      if (!workflowExecutor) {
        throw new Error('WorkflowExecutor not initialized');
      }

      const result = await workflowExecutor.executeWorkflow(workflowId, dataSourceId, options);
      
      console.log(`✅ Workflow execution completed:`, result);
      return { success: true, data: result };
      
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      return { success: false, message: error.message };
    }
  });

  // Workflow durdurmak için
  ipcMain.handle('workflow:stop', async (event) => {
    try {
      if (workflowExecutor) {
        await workflowExecutor.stop();
        return { success: true, message: 'Workflow stopped' };
      }
      return { success: false, message: 'No workflow running' };
    } catch (error) {
      console.error('❌ Workflow stop failed:', error);
      return { success: false, message: error.message };
    }
  });

  // Workflow pause/resume için
  ipcMain.handle('workflow:pause', async (event) => {
    try {
      if (workflowExecutor) {
        workflowExecutor.pause();
        return { success: true, message: 'Workflow paused' };
      }
      return { success: false, message: 'No workflow running' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('workflow:resume', async (event) => {
    try {
      if (workflowExecutor) {
        workflowExecutor.resume();
        return { success: true, message: 'Workflow resumed' };
      }
      return { success: false, message: 'No workflow running' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Workflow durumunu kontrol etmek için
  ipcMain.handle('workflow:status', async (event) => {
    try {
      if (workflowExecutor) {
        return {
          success: true,
          data: {
            isRunning: workflowExecutor.isRunning,
            isPaused: workflowExecutor.isPaused,
            currentWorkflowId: workflowExecutor.currentWorkflowId,
            currentStepIndex: workflowExecutor.currentStepIndex
          }
        };
      }
      return { success: true, data: { isRunning: false, isPaused: false } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}

console.log('✅ EduBot Main Process başlatıldı');