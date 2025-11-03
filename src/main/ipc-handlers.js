const { ipcMain } = require('electron');
const Database = require('./database');

class IPCHandlers {
    constructor() {
        this.db = null;
        this.workflowExecutor = null;
    }

    async initialize() {
        this.db = new Database();
        await this.db.init();
        
        // Clear existing handlers to prevent duplicates
        ipcMain.removeAllListeners();
        
        this.registerHandlers();
    }

    registerHandlers() {
        // ==================== SCREENS ====================
        
        ipcMain.handle('db:createScreen', async (event, name, url, description) => {
            return await this.db.createScreen(name, url, description);
        });

        ipcMain.handle('db:getScreen', async (event, id) => {
            return await this.db.getScreen(id);
        });

        ipcMain.handle('db:getAllScreens', async () => {
            return await this.db.getAllScreens();
        });

        ipcMain.handle('db:updateScreen', async (event, id, data) => {
            return await this.db.updateScreen(id, data);
        });

        ipcMain.handle('db:deleteScreen', async (event, id) => {
            return await this.db.deleteScreen(id);
        });

        // Alias for compatibility
        ipcMain.handle('db:getScreens', async () => {
            return await this.db.getAllScreens();
        });

        // ==================== WORKFLOWS ====================
        
        ipcMain.handle('db:createWorkflow', async (event, workflowData) => {
            // Eski format için backward compatibility
            if (typeof workflowData === 'string') {
                return await this.db.createWorkflow(workflowData, arguments[2], arguments[3], arguments[4]);
            }
            
            // Yeni format için
            return await this.db.createWorkflow(workflowData);
        });

        ipcMain.handle('db:getWorkflow', async (event, id) => {
            return await this.db.getWorkflow(id);
        });

        ipcMain.handle('db:getAllWorkflows', async () => {
            return await this.db.getAllWorkflows();
        });

        // Alias for compatibility
        ipcMain.handle('db:getWorkflows', async () => {
            return await this.db.getAllWorkflows();
        });

        ipcMain.handle('db:updateWorkflow', async (event, id, data) => {
            console.log('🔧 IPC updateWorkflow - ID:', id, 'Data:', data);
            return await this.db.updateWorkflow(id, data);
        });

        ipcMain.handle('db:deleteWorkflow', async (event, id) => {
            return await this.db.deleteWorkflow(id);
        });

        ipcMain.handle('workflow:duplicate', async (event, workflowId, newName) => {
            console.log(`🔧 IPC workflow:duplicate - Kaynak ID: ${workflowId}, Yeni Ad: "${newName}"`);
            
            try {
                // Input validation
                if (!workflowId || typeof workflowId !== 'number') {
                    throw new Error('Geçersiz workflow ID');
                }
                
                if (!newName || typeof newName !== 'string') {
                    throw new Error('Geçersiz workflow adı');
                }

                const trimmedName = newName.trim();
                
                if (trimmedName.length < 3) {
                    throw new Error('Workflow adı en az 3 karakter olmalıdır');
                }

                if (trimmedName.length > 100) {
                    throw new Error('Workflow adı en fazla 100 karakter olabilir');
                }

                // Call database method to duplicate workflow
                const newWorkflowId = await this.db.duplicateWorkflow(workflowId, trimmedName);
                
                console.log(`✅ IPC workflow:duplicate başarılı - Yeni ID: ${newWorkflowId}`);
                
                return {
                    success: true,
                    workflowId: newWorkflowId,
                    message: `Workflow başarıyla kopyalandı: "${trimmedName}"`
                };
                
            } catch (error) {
                console.error('❌ IPC workflow:duplicate hatası:', error);
                
                return {
                    success: false,
                    error: error.message || 'Workflow kopyalama başarısız oldu'
                };
            }
        });

        // ==================== STEPS ====================
        
        ipcMain.handle('db:createStep', async (event, stepData) => {
            // Eski format için backward compatibility
            if (typeof stepData === 'number') {
                return await this.db.createStep({
                    workflow_id: stepData,
                    step_order: arguments[2],
                    action_type: arguments[3],
                    selector: arguments[4],
                    value: arguments[5],
                    wait_after: arguments[6]
                });
            }
            
            // Yeni format için
            return await this.db.createStep(stepData);
        });

        ipcMain.handle('db:getStep', async (event, id) => {
            return await this.db.getStep(id);
        });

        ipcMain.handle('db:getSteps', async (event, workflowId) => {
            return await this.db.getStepsByWorkflow(workflowId);
        });

        // Alias for compatibility
        ipcMain.handle('db:getStepsByWorkflow', async (event, workflowId) => {
            return await this.db.getStepsByWorkflow(workflowId);
        });

        ipcMain.handle('db:updateStep', async (event, id, data) => {
            console.log('🔧 IPC updateStep - ID:', id, 'Data:', data);
            return await this.db.updateStep(id, data);
        });

        ipcMain.handle('db:deleteStep', async (event, id) => {
            return await this.db.deleteStep(id);
        });

        ipcMain.handle('db:deleteStepsByWorkflow', async (event, workflowId) => {
            console.log('🔧 IPC deleteStepsByWorkflow - Workflow ID:', workflowId);
            return await this.db.deleteStepsByWorkflow(workflowId);
        });

        ipcMain.handle('db:reorderSteps', async (event, workflowId, stepIds) => {
            return await this.db.reorderSteps(workflowId, stepIds);
        });

        // ==================== DATA SOURCES ====================
        
        ipcMain.handle('db:createDataSource', async (event, name, type, description, content) => {
            console.log('🔍 IPC createDataSource received:', { name, type, description, content: typeof content });
            return await this.db.createDataSource(name, type, description, content);
        });

        ipcMain.handle('db:getDataSource', async (event, id) => {
            return await this.db.getDataSource(id);
        });

        ipcMain.handle('db:getAllDataSources', async () => {
            return await this.db.getAllDataSources();
        });

        ipcMain.handle('db:updateDataSource', async (event, id, data) => {
            return await this.db.updateDataSource(id, data);
        });

        ipcMain.handle('db:deleteDataSource', async (event, id) => {
            return await this.db.deleteDataSource(id);
        });

        // ✅ Data source records yükleme handler'ı
        ipcMain.handle('db:loadDataSourceRecords', async (event, id) => {
            const dataSource = await this.db.getDataSource(id);
            if (dataSource && dataSource.content) {
                // İçerik zaten parse edilmiş olarak geliyor
                return Array.isArray(dataSource.content) ? dataSource.content : [];
            }
            return [];
        });

        // ==================== LOGS ====================
        
        ipcMain.handle('db:createLog', async (event, workflowId, stepId, recordIndex, status, message, errorDetails, executionTime) => {
            return await this.db.createLog(workflowId, stepId, recordIndex, status, message, errorDetails, executionTime);
        });

        ipcMain.handle('db:getLogs', async (event, workflowId, limit) => {
            return await this.db.getLogs(workflowId, limit);
        });

        ipcMain.handle('db:getAllLogs', async (event, filters, limit) => {
            return await this.db.getAllLogs(filters, limit);
        });

        ipcMain.handle('db:clearOldLogs', async (event, daysToKeep) => {
            return await this.db.clearOldLogs(daysToKeep);
        });

        // ==================== RECORDS QUEUE ====================
        
        ipcMain.handle('db:queueRecords', async (event, workflowId, records) => {
            return await this.db.queueRecords(workflowId, records);
        });

        ipcMain.handle('db:getNextRecord', async (event, workflowId) => {
            return await this.db.getNextRecord(workflowId);
        });

        ipcMain.handle('db:updateRecordStatus', async (event, id, status, errorMessage) => {
            return await this.db.updateRecordStatus(id, status, errorMessage);
        });

        ipcMain.handle('db:getQueueStats', async (event, workflowId) => {
            return await this.db.getQueueStats(workflowId);
        });

        ipcMain.handle('db:clearCompletedRecords', async (event, workflowId) => {
            return await this.db.clearCompletedRecords(workflowId);
        });

        // ==================== UTILITY ====================
        
        ipcMain.handle('db:getStats', async () => {
            return await this.db.getStats();
        });

        // ==================== WORKFLOW EXECUTOR ====================
        
        ipcMain.handle('workflow:continue', async () => {
            console.log('🎯 IPC: workflow:continue çağrıldı!');
            console.log('🎯 IPC: workflowExecutor durumu:', !!this.workflowExecutor);
            if (this.workflowExecutor) {
                console.log('🎯 IPC: Emitting user-continue event');
                this.workflowExecutor.emit('user-continue');
                return { success: true };
            }
            console.log('❌ IPC: Workflow executor not available!');
            return { success: false, error: 'Workflow executor not available' };
        });

        ipcMain.handle('workflow:stop', async () => {
            if (this.workflowExecutor) {
                console.log('🛑 IPC: Stopping workflow execution');
                await this.workflowExecutor.stopExecution();
                return { success: true };
            }
            return { success: false, error: 'Workflow executor not available' };
        });

        ipcMain.handle('workflow:start', async (event, workflowId) => {
            if (this.workflowExecutor) {
                // Placeholder - gerçek implementation yapılacak
                return { success: true };
            }
            return { success: false, error: 'Workflow executor not available' };
        });

        ipcMain.handle('workflow:execute', async (event, workflowId, dataSourceId, options) => {
            if (this.workflowExecutor) {
                try {
                    const result = await this.workflowExecutor.executeWorkflow(workflowId, dataSourceId, options);
                    return { success: true, data: result };
                } catch (error) {
                    console.error('❌ Workflow execution error:', error);
                    return { success: false, message: error.message };
                }
            }
            return { success: false, error: 'Workflow executor not available' };
        });

        ipcMain.handle('workflow:pause', async () => {
            if (this.workflowExecutor) {
                try {
                    await this.workflowExecutor.pauseExecution();
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Workflow executor not available' };
        });

        ipcMain.handle('workflow:resume', async () => {
            if (this.workflowExecutor) {
                try {
                    await this.workflowExecutor.resumeExecution();
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
            return { success: false, error: 'Workflow executor not available' };
        });

        // ==================== DASHBOARD STATS ====================
        
        ipcMain.handle('db:getTodayStats', async () => {
            // Placeholder - gerçek stats implementation yapılacak
            return {
                totalWorkflows: 0,
                runningWorkflows: 0,
                completedToday: 0,
                failedToday: 0
            };
        });

        ipcMain.handle('db:getRecentLogs', async (event, limit = 10) => {
            // Placeholder - gerçek logs implementation yapılacak
            return [];
        });

        // ==================== HYBRID SYSTEM ====================
        
        ipcMain.handle('hybrid:importCSV', async (event, csvData, options) => {
            console.log('🔗 Hybrid Import starting...', csvData.length, 'records');
            return await this.hybridImport(csvData, options);
        });

        ipcMain.handle('hybrid:getStudents', async (event) => {
            return await this.getStudentsFromDatabase();
        });

        ipcMain.handle('hybrid:getCourses', async (event) => {
            return await this.getCoursesFromDatabase();
        });

        ipcMain.handle('hybrid:createWorkflow', async (event, workflowData) => {
            console.log('🎯 Creating hybrid workflow...', workflowData.name);
            return await this.createHybridWorkflow(workflowData);
        });

        console.log('✅ IPC Handlers registered');
    }

    getDatabase() {
        return this.db;
    }

    setWorkflowExecutor(executor) {
        console.log('🔗 IPC: WorkflowExecutor bağlanıyor...', !!executor);
        this.workflowExecutor = executor;
        console.log('✅ IPC: WorkflowExecutor bağlandı!');
    }

    /**
     * Hybrid Import: CSV → Database Integration
     */
    async hybridImport(csvData, options = {}) {
        const stats = {
            totalRecords: csvData.length,
            studentsImported: 0,
            coursesImported: 0,
            enrollmentsCreated: 0,
            duplicatesSkipped: 0
        };

        try {
            console.log('🔗 Hybrid Import processing', csvData.length, 'records');

            // Unique students and courses
            const uniqueStudents = new Map();
            const uniqueCourses = new Map();

            // Extract unique data
            csvData.forEach(record => {
                if (record.student_no && record.course_code) {
                    uniqueStudents.set(record.student_no, {
                        student_no: record.student_no,
                        name: record.student_name || 'Student',
                        surname: record.student_surname || record.student_no
                    });
                    
                    uniqueCourses.set(record.course_code, {
                        course_code: record.course_code,
                        course_name: record.course_name || record.course_code
                    });
                }
            });

            // Import students
            if (options.createStudents) {
                for (const [studentNo, studentData] of uniqueStudents) {
                    try {
                        await new Promise((resolve, reject) => {
                            this.db.db.run(
                                `INSERT OR IGNORE INTO students (student_no, name, surname) VALUES (?, ?, ?)`,
                                [studentData.student_no, studentData.name, studentData.surname],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        if (this.changes > 0) stats.studentsImported++;
                                        resolve();
                                    }
                                }
                            );
                        });
                    } catch (err) {
                        console.error('❌ Student import error:', err);
                    }
                }
            }

            // Import courses
            if (options.createCourses) {
                for (const [courseCode, courseData] of uniqueCourses) {
                    try {
                        await new Promise((resolve, reject) => {
                            this.db.db.run(
                                `INSERT OR IGNORE INTO courses (course_code, course_name, semester) VALUES (?, ?, ?)`,
                                [courseData.course_code, courseData.course_name, '2025-2026-1'],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        if (this.changes > 0) stats.coursesImported++;
                                        resolve();
                                    }
                                }
                            );
                        });
                    } catch (err) {
                        console.error('❌ Course import error:', err);
                    }
                }
            }

            console.log('✅ Hybrid Import completed:', stats);
            return { success: true, stats };

        } catch (error) {
            console.error('❌ Hybrid Import failed:', error);
            return { success: false, error: error.message, stats };
        }
    }

    /**
     * Get students from database
     */
    async getStudentsFromDatabase() {
        return new Promise((resolve, reject) => {
            this.db.db.all(
                'SELECT * FROM students ORDER BY student_no',
                (err, rows) => {
                    if (err) {
                        console.error('❌ Get students failed:', err);
                        reject(err);
                    } else {
                        console.log('📊 Students loaded:', rows?.length || 0);
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Get courses from database
     */
    async getCoursesFromDatabase() {
        return new Promise((resolve, reject) => {
            this.db.db.all(
                'SELECT * FROM courses ORDER BY course_code',
                (err, rows) => {
                    if (err) {
                        console.error('❌ Get courses failed:', err);
                        reject(err);
                    } else {
                        console.log('📚 Courses loaded:', rows?.length || 0);
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    /**
     * Create hybrid workflow with database integration
     */
    async createHybridWorkflow(workflowData) {
        try {
            // 1. Create workflow
            const workflowId = await new Promise((resolve, reject) => {
                this.db.db.run(
                    `INSERT INTO workflows (name, description, target_url, timeout) VALUES (?, ?, ?, ?)`,
                    [workflowData.name, workflowData.description, workflowData.target_url, workflowData.timeout],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });

            // 2. Create workflow steps based on grade action
            const steps = this.generateWorkflowSteps(workflowData.gradeAction);
            let stepsCreated = 0;

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                await new Promise((resolve, reject) => {
                    this.db.db.run(
                        `INSERT INTO steps (workflow_id, step_order, action_type, description, selector, config, wait_after) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [workflowId, i + 1, step.action_type, step.description, step.selector, JSON.stringify({ value: step.value }), step.wait_after],
                        function(err) {
                            if (err) reject(err);
                            else {
                                stepsCreated++;
                                resolve();
                            }
                        }
                    );
                });
            }

            console.log('✅ Hybrid workflow created:', { workflowId, stepsCreated });

            return { 
                success: true, 
                workflowId, 
                stepsCreated,
                studentCount: workflowData.students?.length || 0
            };

        } catch (error) {
            console.error('❌ Hybrid workflow creation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate workflow steps based on action type
     */
    generateWorkflowSteps(gradeAction) {
        const baseSteps = [
            {
                action_type: 'navigate',
                description: 'Hedef URL\'ye git',
                selector: '',
                value: '{{target_url}}',
                wait_after: 2000
            }
        ];

        switch (gradeAction) {
            case 'entry':
            case 'yoksis_entry': // YÖKSİS özel case
                return [
                    ...baseSteps,
                    {
                        action_type: 'wait_for_element',
                        description: 'Tablo yüklenene kadar bekle',
                        selector: 'table.table.table-bordered',
                        value: '',
                        wait_after: 2000
                    },
                    {
                        action_type: 'execute_script',
                        description: 'Ders koduna göre satırı bul ve GUID\'ini al',
                        selector: '',
                        value: JSON.stringify({
                            script: `
                                const dersKodu = record.course_code;
                                if (!dersKodu) {
                                    throw new Error('Ders kodu bulunamadı!');
                                }
                                
                                const rows = Array.from(document.querySelectorAll('tr[data-guid]'));
                                const targetRow = rows.find(row => {
                                    const dersKoduCell = row.querySelector('td:nth-child(3)');
                                    if (dersKoduCell) {
                                        const cellText = dersKoduCell.textContent.trim();
                                        return cellText.includes(dersKodu);
                                    }
                                    return false;
                                });
                                
                                if (!targetRow) {
                                    throw new Error(\`\${dersKodu} dersi tabloda bulunamadı!\`);
                                }
                                
                                const guid = targetRow.getAttribute('data-guid');
                                return guid;
                            `,
                            storeAs: 'rowGuid'
                        }),
                        wait_after: 1000
                    },
                    {
                        action_type: 'type',
                        description: 'Başarı notunu gir',
                        selector: 'tr[data-guid=\'{{rowGuid}}\'] input[ng-model=\'item.gecmeNotu\']',
                        value: '{{numeric_grade}}',
                        wait_after: 500
                    },
                    {
                        action_type: 'select',
                        description: 'Harf notunu seç',
                        selector: 'tr[data-guid=\'{{rowGuid}}\'] select[ng-model=\'item.harfNotID\']',
                        value: '{{letter_grade}}',
                        wait_after: 500
                    },
                    {
                        action_type: 'select',
                        description: 'Ders alış şeklini seç',
                        selector: 'tr[data-guid=\'{{rowGuid}}\'] select[ng-model=\'item.dersAlisSekliID\']',
                        value: '{{ders_alis_sekli}}',
                        wait_after: 500
                    },
                    {
                        action_type: 'click',
                        description: 'Kaydet butonuna tıkla',
                        selector: 'tr[data-guid=\'{{rowGuid}}\'] button[ng-click=\'dersBilgileriGuncelle($index,item,1)\']',
                        value: '',
                        wait_after: 2000
                    }
                ];
            
            case 'update':
                return [
                    ...baseSteps,
                    {
                        action_type: 'type',
                        description: 'Öğrenci ara',
                        selector: '#search-input',
                        value: '{{student_no}}',
                        wait_after: 1000
                    },
                    {
                        action_type: 'click',
                        description: 'Öğrenci seç',
                        selector: '.student-row[data-student="{{student_no}}"]',
                        value: '',
                        wait_after: 1000
                    },
                    {
                        action_type: 'type',
                        description: 'Yeni notu gir',
                        selector: '#new-grade-input',
                        value: '{{numeric_grade}}',
                        wait_after: 500
                    },
                    {
                        action_type: 'click',
                        description: 'Güncelle',
                        selector: '#update-button',
                        value: '',
                        wait_after: 1000
                    }
                ];
                
            default:
                return baseSteps;
        }

        // ==================== DEBUG/MAINTENANCE ====================
        
        ipcMain.handle('debug:resetWorkflow3', async (event) => {
            try {
                console.log('🧹 Starting workflow 3 reset...');
                
                // 1. Delete all steps for workflow 3
                const deleteResult = await new Promise((resolve, reject) => {
                    this.db.db.run('DELETE FROM steps WHERE workflow_id = 3', function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            console.log('✅ Deleted', this.changes, 'steps from workflow 3');
                            resolve(this.changes);
                        }
                    });
                });

                // 2. Create clean steps
                const cleanSteps = [
                    {
                        workflow_id: 3,
                        step_order: 1,
                        action_type: 'navigate',
                        description: 'Not girişi sayfasına git',
                        selector: '',
                        value: 'https://obs.tarsus.edu.tr/OBS_NotDuzenleme',
                        wait_after: 2000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 2,
                        action_type: 'type',
                        description: 'Öğrenci numarasını gir',
                        selector: 'input[placeholder="Öğrenci No"]',
                        value: '{{student_no}}',
                        wait_after: 1000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 3,
                        action_type: 'click',
                        description: 'Ara butonuna tıkla',
                        selector: 'button[type="submit"]',
                        value: '',
                        wait_after: 2000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 4,
                        action_type: 'wait_for_element',
                        description: 'Tablo yüklenene kadar bekle',
                        selector: 'table tbody tr',
                        value: '',
                        wait_after: 3000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 5,
                        action_type: 'execute_script',
                        description: 'Ders satırını bul ve GUID al',
                        selector: '',
                        value: 'script: `const dersKodu = "{{course_code}}"; const rows = Array.from(document.querySelectorAll("tr[data-guid]")); const targetRow = rows.find(row => { const courseCell = row.querySelector("td:nth-child(3)"); return courseCell && courseCell.textContent.trim().includes(dersKodu); }); if (!targetRow) throw new Error(dersKodu + " dersi bulunamadı!"); const guid = targetRow.getAttribute("data-guid"); return guid;`, storeAs: "rowGuid"',
                        wait_after: 1000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 6,
                        action_type: 'wait',
                        description: 'AngularJS render bekle',
                        selector: '',
                        value: '',
                        wait_after: 1000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 7,
                        action_type: 'type',
                        description: 'Başarı notunu gir',
                        selector: 'tr[data-guid="{{rowGuid}}"] input[ng-model="item.gecmeNotu"]',
                        value: '{{numeric_grade}}',
                        wait_after: 500,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 8,
                        action_type: 'select',
                        description: 'Harf notunu seç',
                        selector: 'tr[data-guid="{{rowGuid}}"] select[ng-model="item.harfNotID"]',
                        value: 'value: "{{letter_grade}}", method: "label"',
                        wait_after: 500,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 9,
                        action_type: 'select',
                        description: 'Ders alış şeklini seç',
                        selector: 'tr[data-guid="{{rowGuid}}"] select[ng-model="item.dersAlisSekliID"]',
                        value: 'value: "Normal", method: "label"',
                        wait_after: 500,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 10,
                        action_type: 'wait',
                        description: 'Form sync bekle',
                        selector: '',
                        value: '',
                        wait_after: 500,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 11,
                        action_type: 'click',
                        description: 'Kaydet butonuna tıkla',
                        selector: 'tr[data-guid="{{rowGuid}}"] button[ng-click="dersBilgileriGuncelle($index,item,1)"]',
                        value: '',
                        wait_after: 5000,
                        is_optional: false
                    },
                    {
                        workflow_id: 3,
                        step_order: 12,
                        action_type: 'wait_for_element',
                        description: 'Başarı mesajını bekle',
                        selector: '.alert-success, .success-message, [class*="success"]',
                        value: '',
                        wait_after: 3000,
                        is_optional: true
                    }
                ];

                // Create steps one by one
                const createdSteps = [];
                for (const step of cleanSteps) {
                    try {
                        const stepId = await this.db.createStep(step);
                        createdSteps.push(stepId);
                        console.log(`✅ Created step: ${step.description} (ID: ${stepId})`);
                    } catch (stepErr) {
                        console.error(`❌ Failed to create step: ${step.description}`, stepErr);
                        throw stepErr;
                    }
                }

                console.log(`🎉 Workflow 3 reset completed! Created ${createdSteps.length} clean steps.`);
                return {
                    success: true,
                    deletedSteps: deleteResult,
                    createdSteps: createdSteps.length,
                    stepIds: createdSteps
                };

            } catch (error) {
                console.error('❌ Workflow 3 reset failed:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        });
    }
}

module.exports = IPCHandlers;