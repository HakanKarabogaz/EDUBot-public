/**
 * preload.js
 * Electron Preload Script - Secure IPC Bridge
 * Bu dosya renderer process ile main process arasında güvenli köprü sağlar
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose protected methods to renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
    /* (channel, data ifadesi CSV yüklemede sorun yarattığı için birden fazla parametremiz olduğundan args ile değiştirildi) */
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
        console.log('🔧 Preload: Event listener ekleniyor:', channel);
        ipcRenderer.on(channel, (event, ...args) => {
            console.log('🔔 Preload: Event yakalandı:', channel, args);
            callback(...args);
        });
    },
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
        },

    // ==================== DASHBOARD API ====================
    
    getWorkflows: () => ipcRenderer.invoke('db:getWorkflows'),
    getTodayStats: () => ipcRenderer.invoke('db:getTodayStats'),
    getRecentLogs: (limit) => ipcRenderer.invoke('db:getRecentLogs', limit),
    startWorkflow: (workflowId) => ipcRenderer.invoke('workflow:start', workflowId),
    deleteWorkflow: (workflowId) => ipcRenderer.invoke('db:deleteWorkflow', workflowId),
    // ==================== SCREENS ====================
    
    screens: {
        create: (name, url, description) => 
            ipcRenderer.invoke('db:createScreen', name, url, description),
        
        get: (id) => 
            ipcRenderer.invoke('db:getScreen', id),
        
        getAll: () => 
            ipcRenderer.invoke('db:getAllScreens'),
        
        update: (id, data) => 
            ipcRenderer.invoke('db:updateScreen', id, data),
        
        delete: (id) => 
            ipcRenderer.invoke('db:deleteScreen', id)
    },

    // ==================== WORKFLOWS ====================
    
    workflows: {
        create: (screenId, name, mode, timeout) => 
            ipcRenderer.invoke('db:createWorkflow', screenId, name, mode, timeout),
        
        get: (id) => 
            ipcRenderer.invoke('db:getWorkflow', id),
        
        getAll: () => 
            ipcRenderer.invoke('db:getAllWorkflows'),
        
        update: (id, data) => 
            ipcRenderer.invoke('db:updateWorkflow', id, data),
        
        delete: (id) => 
            ipcRenderer.invoke('db:deleteWorkflow', id),
        
        duplicate: (workflowId, newName) => 
            ipcRenderer.invoke('workflow:duplicate', workflowId, newName)
    },

    // ==================== WORKFLOW EXECUTOR ====================
    
    workflow: {
        continue: () => 
            ipcRenderer.invoke('workflow:continue'),
        stop: () => 
            ipcRenderer.invoke('workflow:stop')
    },

    execution: {
        execute: (workflowId, dataSourceId, options) => 
            ipcRenderer.invoke('workflow:execute', workflowId, dataSourceId, options),
        pause: () => 
            ipcRenderer.invoke('workflow:pause'),
        resume: () => 
            ipcRenderer.invoke('workflow:resume'),
        stop: () => 
            ipcRenderer.invoke('workflow:stop')
    },

    // ==================== STEPS ====================
    
    steps: {
        create: (workflowId, stepOrder, actionType, elementSelectors, inputData, waitCondition) => 
            ipcRenderer.invoke('db:createStep', workflowId, stepOrder, actionType, elementSelectors, inputData, waitCondition),
        
        get: (id) => 
            ipcRenderer.invoke('db:getStep', id),
        
        getAll: (workflowId) => 
            ipcRenderer.invoke('db:getSteps', workflowId),
        
        update: (id, data) => 
            ipcRenderer.invoke('db:updateStep', id, data),
        
        delete: (id) => 
            ipcRenderer.invoke('db:deleteStep', id),
        
        reorder: (workflowId, stepIds) => 
            ipcRenderer.invoke('db:reorderSteps', workflowId, stepIds)
    },

    // ==================== DATA SOURCES ====================
    
    dataSources: {
        create: (name, dataType, query, content) => 
            ipcRenderer.invoke('db:createDataSource', name, dataType, query, content),
        
        get: (id) => 
            ipcRenderer.invoke('db:getDataSource', id),
        
        getAll: () => 
            ipcRenderer.invoke('db:getAllDataSources'),
        
        update: (id, data) => 
            ipcRenderer.invoke('db:updateDataSource', id, data),
        
        delete: (id) => 
            ipcRenderer.invoke('db:deleteDataSource', id),
        
        // ✅ Eksik olan loadRecords metodunu ekliyoruz
        loadRecords: (id) => 
            ipcRenderer.invoke('db:loadDataSourceRecords', id)
    },

    // ==================== LOGS ====================
    
    logs: {
        create: (workflowId, stepId, recordIndex, status, message, errorDetails, executionTime) => 
            ipcRenderer.invoke('db:createLog', workflowId, stepId, recordIndex, status, message, errorDetails, executionTime),
        
        get: (workflowId, limit) => 
            ipcRenderer.invoke('db:getLogs', workflowId, limit),
        
        getAll: (filters, limit) => 
            ipcRenderer.invoke('db:getAllLogs', filters, limit),
        
        clearOld: (daysToKeep) => 
            ipcRenderer.invoke('db:clearOldLogs', daysToKeep)
    },

    // ==================== RECORDS QUEUE ====================
    
    queue: {
        add: (workflowId, records) => 
            ipcRenderer.invoke('db:queueRecords', workflowId, records),
        
        getNext: (workflowId) => 
            ipcRenderer.invoke('db:getNextRecord', workflowId),
        
        updateStatus: (id, status, errorMessage) => 
            ipcRenderer.invoke('db:updateRecordStatus', id, status, errorMessage),
        
        getStats: (workflowId) => 
            ipcRenderer.invoke('db:getQueueStats', workflowId),
        
        clearCompleted: (workflowId) => 
            ipcRenderer.invoke('db:clearCompletedRecords', workflowId)
    },

    // ==================== UTILITY ====================
    
    getStats: () => 
        ipcRenderer.invoke('db:getStats'),

    // ==================== MENU EVENTS ====================
    
    onMenuNewWorkflow: (callback) => {
        ipcRenderer.on('menu-new-workflow', callback);
    },

    onMenuSettings: (callback) => {
        ipcRenderer.on('menu-settings', callback);
    },

    onMenuHelp: (callback) => {
        ipcRenderer.on('menu-help', callback);
    },

    onMenuAbout: (callback) => {
        ipcRenderer.on('menu-about', callback);
    },

    // ==================== WORKFLOW EXECUTION ✅ AKTİF ====================
    
    execution: {
        // Workflow'u çalıştır
        execute: (workflowId, dataSourceId, options = {}) => 
            ipcRenderer.invoke('workflow:execute', workflowId, dataSourceId, options),
        
        // Workflow'u durdur
        stop: () => 
            ipcRenderer.invoke('workflow:stop'),
        
        // Workflow'u duraklat
        pause: () => 
            ipcRenderer.invoke('workflow:pause'),
        
        // Workflow'u devam ettir
        resume: () => 
            ipcRenderer.invoke('workflow:resume'),
        
        // Workflow durumunu kontrol et
        getStatus: () =>
            ipcRenderer.invoke('workflow:status'),
        
        // Event listener'lar (Gelecekte progress tracking için)
        onProgress: (callback) => {
            ipcRenderer.on('execution:progress', (event, data) => callback(data));
        },
        
        onComplete: (callback) => {
            ipcRenderer.on('execution:complete', (event, data) => callback(data));
        },
        
        onError: (callback) => {
            ipcRenderer.on('execution:error', (event, data) => callback(data));
        }
    },

    // ==================== ELEMENT PICKER (Gelecekte eklenecek) ====================
    
    elementPicker: {
        start: (url) => 
            ipcRenderer.invoke('picker:start', url),
        
        stop: () => 
            ipcRenderer.invoke('picker:stop'),
        
        onElementSelected: (callback) => {
            ipcRenderer.on('picker:element-selected', (event, data) => callback(data));
        }
    },

    // ==================== DEBUG/MAINTENANCE ====================
    
    debug: {
        resetWorkflow3: () => ipcRenderer.invoke('debug:resetWorkflow3'),
        deleteStepsByWorkflow: (workflowId) => ipcRenderer.invoke('db:deleteStepsByWorkflow', workflowId)
    }
});

console.log('✅ Preload script loaded - electronAPI exposed');