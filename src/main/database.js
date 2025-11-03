/**
 * database.js
 * SQLite database operations for EduBot
 */

// Robust database driver loader: prefer `sqlite3` (node-sqlite3) but
// gracefully fall back to `better-sqlite3` if available. The fallback
// exposes a small callback-style wrapper implementing `run/get/all/close`
// so the rest of the codebase can remain unchanged.
const path = require('path');
const fs = require('fs');

let _driverInfo = { name: null };

function openDatabaseWithFallback(dbPath, callback) {
    // Try node-sqlite3 first (async, callback-based)
    try {
        const sqlite3 = require('sqlite3').verbose();
        _driverInfo.name = 'sqlite3';
        const db = new sqlite3.Database(dbPath, (err) => {
            callback(err, db);
        });
        return;
    } catch (e) {
        // continue to better-sqlite3 fallback
    }

    // Try better-sqlite3 (synchronous API). We'll wrap it to provide
    // the async callback-style methods used across the codebase.
    try {
        const Better = require('better-sqlite3');
        _driverInfo.name = 'better-sqlite3';
        const bdb = new Better(dbPath, { fileMustExist: false });

        // Build a small wrapper with run/get/all/close methods that accept
        // the same argument shapes as sqlite3 (sql, params?, callback)
        const wrapper = {
            run(sql, params, cb) {
                try {
                    if (typeof params === 'function') {
                        cb = params; params = undefined;
                    }
                    const stmt = bdb.prepare(sql);
                    const info = params ? stmt.run(...(Array.isArray(params) ? params : [params])) : stmt.run();
                    if (cb) cb(null, info);
                } catch (err) {
                    if (cb) cb(err);
                }
            },
            get(sql, params, cb) {
                try {
                    if (typeof params === 'function') {
                        cb = params; params = undefined;
                    }
                    const stmt = bdb.prepare(sql);
                    const row = params ? stmt.get(...(Array.isArray(params) ? params : [params])) : stmt.get();
                    if (cb) cb(null, row);
                } catch (err) {
                    if (cb) cb(err);
                }
            },
            all(sql, params, cb) {
                try {
                    if (typeof params === 'function') {
                        cb = params; params = undefined;
                    }
                    const stmt = bdb.prepare(sql);
                    const rows = params ? stmt.all(...(Array.isArray(params) ? params : [params])) : stmt.all();
                    if (cb) cb(null, rows);
                } catch (err) {
                    if (cb) cb(err);
                }
            },
            close(cb) {
                try {
                    bdb.close();
                    if (cb) cb && cb(null);
                } catch (err) {
                    if (cb) cb(err);
                }
            }
        };

        // Immediately call callback to indicate the DB is ready (no async open)
        process.nextTick(() => callback(null, wrapper));
        return;
    } catch (err) {
        // No suitable driver found
        _driverInfo.name = null;
        process.nextTick(() => callback(new Error('No suitable sqlite driver found: ' + err.message)));
    }
}


class DatabaseManager {
    constructor(dbPath = null) {
        // Default database path
        this.dbPath = dbPath || path.join(__dirname, '../../database/edubot.db');
        this.db = null;
    }

    /**
     * Initialize database connection and create tables
     */
    async init() {
        return new Promise((resolve, reject) => {
            try {
                // Ensure database directory exists
                const dbDir = path.dirname(this.dbPath);
                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }

                // Open database connection using loader with fallback
                openDatabaseWithFallback(this.dbPath, (err, db) => {
                    if (err) {
                        console.error('❌ Database connection failed:', err);
                        reject(err);
                        return;
                    }

                    this.db = db;
                    console.log(`✅ Database connected at: ${this.dbPath} (driver=${_driverInfo.name})`);

                    // Enable foreign keys - use callback-style run
                    this.db.run('PRAGMA foreign_keys = ON', (err) => {
                        if (err) {
                            console.error('❌ Foreign keys enable failed:', err);
                            reject(err);
                            return;
                        }

                        // Create tables
                        this.createTables()
                            .then(() => {
                                // Create academic tables
                                return this.createAcademicTables();
                            })
                            .then(() => {
                                // Insert test data
                                return this.insertTestDataIfEmpty();
                            })
                            .then(() => {
                                console.log('✅ Database initialized successfully');
                                resolve(true);
                            })
                            .catch(reject);
                    });
                });
            } catch (error) {
                console.error('❌ Database initialization failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Backwards-compatible alias for older scripts expecting `initialize()`
     */
    async initialize() {
        return this.init();
    }

    /**
     * Create all tables from schema
     */
    async createTables() {
        return new Promise((resolve, reject) => {
            const tables = [
                `CREATE TABLE IF NOT EXISTS screens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    url TEXT NOT NULL,
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                
                `CREATE TABLE IF NOT EXISTS workflows (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    screen_id INTEGER,
                    name TEXT NOT NULL,
                    description TEXT,
                    target_url TEXT,
                    mode TEXT CHECK(mode IN ('data_entry', 'data_edit', 'data_add')),
                    timeout INTEGER DEFAULT 30000,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (screen_id) REFERENCES screens(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id INTEGER,
                    step_order INTEGER,
                    action_type TEXT CHECK(action_type IN ('navigate', 'click', 'type', 'select', 'wait', 'wait_for_element', 'screenshot', 'execute_script', 'wait_for_user')),
                    description TEXT,
                    selector TEXT,
                    config TEXT,
                    wait_after INTEGER DEFAULT 0,
                    retry_count INTEGER DEFAULT 0,
                    element_selectors TEXT,
                    input_data TEXT,
                    wait_condition TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
                )`,
                
                `CREATE TABLE IF NOT EXISTS data_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    description TEXT,
                    config TEXT,
                    data_type TEXT CHECK(data_type IN ('query', 'static', 'csv', 'json')),
                    query TEXT,
                    content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`
                ,
                `CREATE TABLE IF NOT EXISTS execution_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id INTEGER,
                    step_id INTEGER,
                    record_index INTEGER,
                    status TEXT CHECK(status IN ('started', 'success', 'failed', 'skipped', 'running', 'completed')),
                    message TEXT,
                    error_details TEXT,
                    execution_time INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
                    FOREIGN KEY (step_id) REFERENCES steps(id)
                )`
            ];

            let completed = 0;
            const total = tables.length;

            tables.forEach((sql, index) => {
                this.db.run(sql, (err) => {
                    if (err) {
                        console.error(`❌ Table ${index} creation failed:`, err);
                        reject(err);
                        return;
                    }
                    
                    completed++;
                    if (completed === total) {
                        console.log('✅ All tables created successfully');
                        // Migration: Add missing columns
                        let migrationsCompleted = 0;
                        const totalMigrations = 2;
                        
                        const checkMigrationsComplete = () => {
                            migrationsCompleted++;
                            if (migrationsCompleted === totalMigrations) {
                                resolve();
                            }
                        };
                        
                        // Migration 1: Add is_active column to workflows
                        this.db.run(`ALTER TABLE workflows ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
                            if (err && !err.message.includes('duplicate column name')) {
                                console.error('❌ workflows is_active migration failed:', err);
                            } else if (!err) {
                                console.log('✅ is_active column added to workflows table');
                            }
                            checkMigrationsComplete();
                        });
                        
                        // Migration 2: Add is_optional column to steps
                        this.db.run(`ALTER TABLE steps ADD COLUMN is_optional INTEGER DEFAULT 0`, (err) => {
                            if (err && !err.message.includes('duplicate column name')) {
                                console.error('❌ steps is_optional migration failed:', err);
                            } else if (!err) {
                                console.log('✅ is_optional column added to steps table');
                            }
                            checkMigrationsComplete();
                        });
                        // Migration 3: Create records_queue table if missing
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS records_queue (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                workflow_id INTEGER,
                                record_data TEXT,
                                status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
                                retry_count INTEGER DEFAULT 0,
                                error_message TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                processed_at DATETIME,
                                FOREIGN KEY (workflow_id) REFERENCES workflows(id)
                            )
                        `, (err) => {
                            if (err) {
                                console.error('❌ records_queue table creation failed:', err);
                            } else {
                                console.log('✅ records_queue table ensured');
                            }
                        });

                        // Migration 4: Create processing_queue table if missing
                        this.db.run(`
                            CREATE TABLE IF NOT EXISTS processing_queue (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                record_id INTEGER,
                                workflow_id INTEGER,
                                status TEXT DEFAULT 'pending',
                                error_message TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                            )
                        `, (err) => {
                            if (err) {
                                console.error('❌ processing_queue table creation failed:', err);
                            } else {
                                console.log('✅ processing_queue table ensured');
                            }
                        });
                    }
                });
            });
        });
    }

    /**
     * Create academic tables for Database Integration
     */
    async createAcademicTables() {
        return new Promise((resolve, reject) => {
            const fs = require('fs');
            const path = require('path');
            
            // Read academic schema file
            const schemaPath = path.join(__dirname, '../../database/academic-schema.sql');
            
            fs.readFile(schemaPath, 'utf8', (err, schemaSQL) => {
                if (err) {
                    console.error('❌ Academic schema file read failed:', err);
                    reject(err);
                    return;
                }

                // Clean and split SQL statements
                const cleanSQL = schemaSQL
                    .replace(/--[^\n]*\n/g, '\n') // Remove comments
                    .replace(/\n\s*\n/g, '\n') // Remove empty lines
                    .trim();

                const allStatements = cleanSQL
                    .split(';')
                    .map(stmt => stmt.trim())
                    .filter(stmt => stmt.length > 0);

                // Debug logs removed - academic tables working properly

                // Separate CREATE TABLE from CREATE INDEX statements
                const tableStatements = allStatements.filter(stmt => 
                    stmt.toUpperCase().includes('CREATE TABLE'));
                const indexStatements = allStatements.filter(stmt => 
                    stmt.toUpperCase().includes('CREATE INDEX'));

                console.log(`📊 Creating ${tableStatements.length} tables and ${indexStatements.length} indexes`);

                // First create tables
                this.executeStatements(tableStatements, 'table')
                    .then(() => {
                        // Then create indexes
                        return this.executeStatements(indexStatements, 'index');
                    })
                    .then(() => {
                        console.log('✅ Academic tables and indexes created successfully');
                        resolve();
                    })
                    .catch(reject);
            });
        });
    }

    /**
     * Execute SQL statements sequentially
     */
    executeStatements(statements, type) {
        return new Promise((resolve, reject) => {
            if (statements.length === 0) {
                resolve();
                return;
            }

            let completed = 0;
            const total = statements.length;

            statements.forEach((sql, index) => {
                this.db.run(sql, (runErr) => {
                    if (runErr) {
                        console.error(`❌ Academic ${type} ${index} creation failed:`, runErr.message);
                        // Don't reject, continue with other statements
                    } else {
                        console.log(`✅ Academic ${type} ${index} created successfully`);
                    }
                    
                    completed++;
                    if (completed === total) {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Insert test data if database is empty
     */
    async insertTestDataIfEmpty() {
        return new Promise((resolve, reject) => {
            // Check if data_sources table has data
            this.db.get('SELECT COUNT(*) as count FROM data_sources', (err, row) => {
                if (err) {
                    console.error('❌ Count check failed:', err);
                    reject(err);
                    return;
                }

                if (row.count === 0) {
                    console.log('📦 Inserting test data...');
                    
                    const testData = {
                        name: 'Test Kullanıcıları',
                        type: 'file',
                        description: 'Test amaçlı örnek kullanıcı verileri',
                        data_type: 'static',
                        content: JSON.stringify([
                            { id: 1, name: 'Ahmet Yılmaz', email: 'ahmet.yilmaz@example.com', phone: '0532 123 4567' },
                            { id: 2, name: 'Ayşe Demir', email: 'ayse.demir@example.com', phone: '0533 234 5678' },
                            { id: 3, name: 'Mehmet Kaya', email: 'mehmet.kaya@example.com', phone: '0534 345 6789' }
                        ])
                    };

                    const sql = `INSERT INTO data_sources (name, type, description, data_type, content) 
                                VALUES (?, ?, ?, ?, ?)`;
                    
                    const self = this;
                    this.db.run(sql, [testData.name, testData.type, testData.description, testData.data_type, testData.content], function(err) {
                        if (err) {
                            console.error('❌ Test data insertion failed:', err);
                            reject(err);
                        } else {
                            console.log('✅ Test data inserted successfully with ID:', this.lastID);
                            
                            // Add Tarsus eKampüs Workflow
                            self.addTarsusEkampusWorkflow()
                                .then(() => {
                                    console.log('✅ Tarsus eKampüs workflow added successfully');
                                    resolve();
                                })
                                .catch((workflowErr) => {
                                    console.error('❌ Tarsus eKampüs workflow creation failed:', workflowErr);
                                    // Don't reject, just log the error
                                    resolve();
                                });
                        }
                    });
                } else {
                    console.log('ℹ️ Test data already exists, skipping...');
                    resolve();
                }
            });
        });
    }

    /**
     * Create a new data source
     */
    createDataSource(name, type, description, content) {
        return new Promise((resolve, reject) => {
            // Support object form: createDataSource({ name, type, description, config })
            let nameVal = name;
            let typeVal = type;
            let descVal = description;
            let contentVal = content;
            if (typeof name === 'object') {
                const obj = name;
                nameVal = obj.name;
                typeVal = obj.type;
                descVal = obj.description || '';
                contentVal = obj.config || obj.content || '';
            }

            console.log('🔍 createDataSource parameters:', { name: nameVal, type: typeVal, description: descVal, content: typeof contentVal });
            
            const sql = `
                INSERT INTO data_sources (name, type, description, content, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            // Content'i JSON string'e çevir
            const contentString = typeof contentVal === 'object' ? JSON.stringify(contentVal) : (contentVal || '');
            const params = [nameVal, typeVal, descVal, contentString];
            console.log('🔍 SQL parameters:', params);
            
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Data source creation failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Data source created with ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Get all data sources
     */
    getAllDataSources() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM data_sources ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    console.error('❌ Get all data sources failed:', err);
                    reject(err);
                } else {
                    // Parse JSON content
                    const sources = rows.map(row => {
                        if (row.content) {
                            try {
                                row.content = JSON.parse(row.content);
                            } catch (e) {
                                // Keep as string if not JSON
                            }
                        }
                        return row;
                    });
                    resolve(sources);
                }
            });
        });
    }

    /**
     * Get data source by ID
     */
    getDataSource(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM data_sources WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('❌ Get data source failed:', err);
                    reject(err);
                } else if (row) {
                    // Parse JSON content
                    if (row.content) {
                        try {
                            row.content = JSON.parse(row.content);
                        } catch (e) {
                            // Keep as string if not JSON
                        }
                        // Backwards compatibility: expose parsed content as `config`
                        if (!row.config) {
                            try {
                                row.config = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
                            } catch (e) {
                                row.config = row.content;
                            }
                        }
                    }
                    resolve(row);
                } else {
                    resolve(null);
                }
            });
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Database close failed:', err);
                } else {
                    console.log('✅ Database connection closed');
                }
            });
        }
    }

    /**
     * Get database statistics
     */
    getStats() {
        return new Promise((resolve, reject) => {
            const stats = {};
            
            this.db.get('SELECT COUNT(*) as count FROM data_sources', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    stats.data_sources = row.count;
                    resolve(stats);
                }
            });
        });
    }

    /**
     * Get all workflows
     */
    getAllWorkflows() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT w.*, s.name as screen_name, s.url as screen_url 
                FROM workflows w 
                LEFT JOIN screens s ON w.screen_id = s.id 
                ORDER BY w.created_at DESC
            `;
            
            this.db.all(sql, (err, rows) => {
                if (err) {
                    console.error('❌ Get all workflows failed:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get workflow by ID
     */
    getWorkflow(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT w.*, s.name as screen_name, s.url as screen_url 
                FROM workflows w 
                LEFT JOIN screens s ON w.screen_id = s.id 
                WHERE w.id = ?
            `;
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('❌ Get workflow failed:', err);
                    reject(err);
                } else {
                    resolve(row || null);
                }
            });
        });
    }

    /**
     * Get workflow steps by workflow ID
     */
    getStepsByWorkflow(workflowId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM steps 
                WHERE workflow_id = ? 
                ORDER BY step_order ASC
            `;
            
            this.db.all(sql, [workflowId], (err, rows) => {
                if (err) {
                    console.error('❌ Get workflow steps failed:', err);
                    reject(err);
                } else {
                    // Extract value from config JSON for each step
                    const processedRows = (rows || []).map(row => {
                        try {
                            if (row.config) {
                                const config = JSON.parse(row.config);
                                // Expose parsed config fields for renderer convenience
                                row.parsedConfig = config;
                                row.script = config.script || '';
                                row.storeAs = config.storeAs || '';
                                // For backwards compatibility, value falls back to config.value or script
                                row.value = config.value || config.script || '';
                            } else {
                                row.parsedConfig = null;
                                row.script = '';
                                row.storeAs = '';
                                row.value = '';
                            }
                        } catch (e) {
                            console.log('🔧 Config parse error for step', row.id, ':', e.message);
                            row.parsedConfig = null;
                            row.script = '';
                            row.storeAs = '';
                            row.value = '';
                        }
                        return row;
                    });
                    console.log('🔧 Processed steps with values/scripts:', processedRows.map(s => ({id: s.id, value: s.value, hasScript: !!s.script})));
                    resolve(processedRows);
                }
            });
        });
    }

    /**
     * Add Tarsus eKampüs workflow and its steps
     */
    async addTarsusEkampusWorkflow() {
        return new Promise((resolve, reject) => {
            // First, create the screen
            const screenSql = `INSERT OR IGNORE INTO screens (name, url, description) VALUES (?, ?, ?)`;
            const screenData = [
                'Tarsus Üniversitesi eKampüs',
                'https://ekampus.tarsus.edu.tr/',
                'Tarsus Üniversitesi Öğrenci Bilgi Sistemi'
            ];

            const self = this;
            this.db.run(screenSql, screenData, function(err) {
                if (err) {
                    console.error('❌ Screen creation failed:', err);
                    reject(err);
                    return;
                }

                console.log('📺 Screen created/exists with ID:', this.lastID);
                
                // If INSERT OR IGNORE didn't create new record, get existing screen ID
                self.db.get('SELECT id FROM screens WHERE url = ?', ['https://ekampus.tarsus.edu.tr/'], (getErr, screenRow) => {
                    if (getErr) {
                        console.error('❌ Get screen ID failed:', getErr);
                        reject(getErr);
                        return;
                    }
                    
                    const screenId = screenRow ? screenRow.id : 1;
                    console.log('📺 Using screen ID:', screenId);

                    // Then create the workflow
                    const workflowSql = `INSERT INTO workflows (screen_id, name, description, target_url, mode, timeout) VALUES (?, ?, ?, ?, ?, ?)`;
                    const workflowData = [
                        screenId,
                        'Tarsus eKampüs Giriş',
                        'Tarsus Üniversitesi eKampüs sistemine giriş yapma workflow\'u',
                        'https://ekampus.tarsus.edu.tr/',
                        'data_entry',
                        30000
                    ];

                    self.db.run(workflowSql, workflowData, function(workflowErr) {
                        if (workflowErr) {
                            console.error('❌ Workflow creation failed:', workflowErr);
                            reject(workflowErr);
                            return;
                        }

                        const workflowId = this.lastID;
                        console.log('✅ Tarsus eKampüs workflow created with ID:', workflowId);

                        // Add workflow steps
                        const steps = [
                            {
                                step_order: 1,
                                action_type: 'navigate',
                                selector: '',
                                value: 'https://ekampus.tarsus.edu.tr/',
                                wait_message: '',
                                description: 'eKampüs ana sayfasına git'
                            },
                            {
                                step_order: 2,
                                action_type: 'wait_for_user',
                                selector: '',
                                value: '',
                                wait_message: 'Lütfen kullanıcı adı ve şifrenizi girerek giriş yapın. Giriş yaptıktan sonra Devam butonuna basın.',
                                description: 'Kullanıcı girişini bekle'
                            }
                        ];

                        let completedSteps = 0;
                        const totalSteps = steps.length;

                        steps.forEach(step => {
                            const stepSql = `INSERT INTO steps (workflow_id, step_order, action_type, selector, config, wait_message, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                            const stepData = [workflowId, step.step_order, step.action_type, step.selector, JSON.stringify({value: step.value}), step.wait_message, step.description];

                            self.db.run(stepSql, stepData, function(stepErr) {
                                if (stepErr) {
                                    console.error('❌ Step creation failed:', stepErr);
                                    reject(stepErr);
                                    return;
                                }

                                console.log('📋 Step created:', step.description);
                                completedSteps++;
                                if (completedSteps === totalSteps) {
                                    console.log('✅ All workflow steps created successfully');
                                    resolve({ workflowId, screenId });
                                }
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Get data source data by ID
     */
    async getDataSourceData(dataSourceId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM data_sources WHERE id = ?', [dataSourceId], (err, row) => {
                if (err) {
                    console.error('❌ Get data source data failed:', err);
                    reject(err);
                } else if (row) {
                    // Parse JSON content if it's a string
                    if (row.content && typeof row.content === 'string') {
                        try {
                            row.content = JSON.parse(row.content);
                        } catch (e) {
                            console.warn('⚠️ Content is not JSON, keeping as string');
                        }
                    }
                    resolve(row.content || []);
                } else {
                    console.warn('⚠️ Data source not found:', dataSourceId);
                    resolve([]);
                }
            });
        });
    }

    /**
     * Execute workflow with data
     */
    async executeWorkflow(workflowId, dataSourceId) {
        try {
            console.log('🔄 Executing workflow:', workflowId, 'with data source:', dataSourceId);
            
            // Get workflow details
            const workflow = await this.getWorkflow(workflowId);
            if (!workflow) {
                throw new Error(`Workflow not found: ${workflowId}`);
            }

            // Get workflow steps
            const steps = await this.getStepsByWorkflow(workflowId);
            if (!steps || steps.length === 0) {
                throw new Error(`No steps found for workflow: ${workflowId}`);
            }

            // Get data source data
            const data = await this.getDataSourceData(dataSourceId);
            
            console.log('✅ Workflow execution prepared:', {
                workflow: workflow.name,
                steps: steps.length,
                dataRecords: Array.isArray(data) ? data.length : 0
            });

            return {
                workflow,
                steps,
                data
            };
        } catch (error) {
            console.error('❌ Execute workflow failed:', error);
            throw error;
        }
    }

    /**
     * Create execution log entry - supports multiple parameter formats
     */
    async createExecutionLog(workflowId, stepId = null, recordIndex = null, status = 'started', message = null, errorData = null, timestamp = null) {
        return new Promise((resolve, reject) => {
            // First ensure execution_logs table exists
            const createTableSql = `
                CREATE TABLE IF NOT EXISTS execution_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow_id INTEGER,
                    step_id INTEGER,
                    record_index INTEGER,
                    status TEXT DEFAULT 'started',
                    message TEXT,
                    error_data TEXT,
                    timestamp INTEGER,
                    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    records_processed INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0,
                    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
                )
            `;

            this.db.run(createTableSql, (err) => {
                if (err) {
                    console.error('❌ Execution logs table creation failed:', err);
                    reject(err);
                    return;
                }

                // Insert execution log
                const insertSql = `
                    INSERT INTO execution_logs (workflow_id, step_id, record_index, status, message, error_data, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                this.db.run(insertSql, [workflowId, stepId, recordIndex, status, message, errorData, timestamp], function(insertErr) {
                    if (insertErr) {
                        console.error('❌ Execution log creation failed:', insertErr);
                        reject(insertErr);
                        return;
                    }

                    const logId = this.lastID;
                    console.log('📝 Execution log created with ID:', logId);
                    resolve(logId);
                });
            });
        });
    }

    /**
     * Update execution log status - supports object parameter format
     */
    async updateExecutionLog(logId, updateData) {
        return new Promise((resolve, reject) => {
            // If updateData is a string, treat it as status
            if (typeof updateData === 'string') {
                updateData = { status: updateData };
            }

            let sql = 'UPDATE execution_logs SET ';
            const params = [];
            const setParts = [];

            // Handle different update fields
            if (updateData.status) {
                setParts.push('status = ?');
                params.push(updateData.status);
                
                if (updateData.status === 'completed' || updateData.status === 'failed') {
                    setParts.push('completed_at = CURRENT_TIMESTAMP');
                }
            }

            if (updateData.message || updateData.error_message) {
                setParts.push('message = ?');
                params.push(updateData.message || updateData.error_message);
            }

            if (updateData.processed_records !== undefined) {
                setParts.push('records_processed = ?');
                params.push(updateData.processed_records);
            }

            if (updateData.success_count !== undefined) {
                setParts.push('success_count = ?');
                params.push(updateData.success_count);
            }

            if (updateData.error_count !== undefined) {
                setParts.push('error_count = ?');
                params.push(updateData.error_count);
            }

            if (setParts.length === 0) {
                resolve(0);
                return;
            }

            sql += setParts.join(', ') + ' WHERE id = ?';
            params.push(logId);

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Execution log update failed:', err);
                    reject(err);
                    return;
                }

                console.log('📝 Execution log updated:', { logId, ...updateData });
                resolve(this.changes);
            });
        });
    }

    /**
     * Get execution logs
     */
    async getExecutionLogs(limit = 50) {
        return new Promise((resolve, reject) => {
            // Note: execution_logs table stores workflow_id but not data_source_id in the current schema.
            // Avoid joining on a non-existent column. Also normalize selected column names to match schema.
            const sql = `
                SELECT el.*, w.name as workflow_name
                FROM execution_logs el
                LEFT JOIN workflows w ON el.workflow_id = w.id
                ORDER BY el.started_at DESC
                LIMIT ?
            `;

            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    console.error('❌ Get execution logs failed:', err);
                    reject(err);
                } else {
                    // Normalize field names for older callers
                    const normalized = (rows || []).map(r => ({
                        ...r,
                        total_records: r.records_processed || r.total_records || 0,
                        processed_records: r.records_processed || r.processed_records || 0
                    }));
                    resolve(normalized);
                }
            });
        });
    }

    /**
     * Update queue status (for workflow execution tracking)
     */
    async updateQueueStatus(recordId, status, errorMessage = null) {
        return new Promise((resolve, reject) => {
            // Create queue table if not exists
            const createTableSql = `
                CREATE TABLE IF NOT EXISTS processing_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    workflow_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.db.run(createTableSql, (err) => {
                if (err) {
                    console.error('❌ Queue table creation failed:', err);
                    reject(err);
                    return;
                }

                // Update or insert queue status
                const updateSql = `
                    INSERT OR REPLACE INTO processing_queue (record_id, status, error_message, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `;

                this.db.run(updateSql, [recordId, status, errorMessage], function(updateErr) {
                    if (updateErr) {
                        console.error('❌ Queue status update failed:', updateErr);
                        reject(updateErr);
                        return;
                    }

                    console.log('📝 Queue status updated:', { recordId, status });
                    resolve(this.changes);
                });
            });
        });
    }

    /**
     * Delete from queue (when processing is complete)
     */
    async deleteFromQueue(recordId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM processing_queue WHERE record_id = ?';
            
            this.db.run(sql, [recordId], function(err) {
                if (err) {
                    console.error('❌ Delete from queue failed:', err);
                    reject(err);
                    return;
                }

                console.log('🗑️ Deleted from queue:', recordId);
                resolve(this.changes);
            });
        });
    }

    /**
     * Add to processing queue
     */
    async addToQueue(recordId, workflowId, status = 'pending') {
        return new Promise((resolve, reject) => {
            // Create queue table if not exists
            const createTableSql = `
                CREATE TABLE IF NOT EXISTS processing_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    workflow_id INTEGER,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            this.db.run(createTableSql, (err) => {
                if (err) {
                    console.error('❌ Queue table creation failed:', err);
                    reject(err);
                    return;
                }

                const insertSql = `
                    INSERT INTO processing_queue (record_id, workflow_id, status)
                    VALUES (?, ?, ?)
                `;

                this.db.run(insertSql, [recordId, workflowId, status], function(insertErr) {
                    if (insertErr) {
                        console.error('❌ Add to queue failed:', insertErr);
                        reject(insertErr);
                        return;
                    }

                    console.log('➕ Added to queue:', { recordId, workflowId, status });
                    resolve(this.lastID);
                });
            });
        });
    }

    /**
     * Get queue status
     */
    async getQueueStatus() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT pq.*, w.name as workflow_name
                FROM processing_queue pq
                LEFT JOIN workflows w ON pq.workflow_id = w.id
                ORDER BY pq.created_at DESC
            `;

            this.db.all(sql, (err, rows) => {
                if (err) {
                    console.error('❌ Get queue status failed:', err);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Get queue stats for a workflow
     * Returns { pending: number, processing: number, completed: number }
     */
    async getQueueStats(workflowId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM records_queue
                WHERE workflow_id = ?
            `;

            this.db.get(sql, [workflowId], (err, row) => {
                if (err) {
                    console.error('❌ Get queue stats failed:', err);
                    // If the table doesn't exist, return zeros
                    if (err.message && err.message.includes('no such table')) {
                        resolve({ pending: 0, processing: 0, completed: 0 });
                    } else {
                        reject(err);
                    }
                    return;
                }

                resolve({ pending: row.pending || 0, processing: row.processing || 0, completed: row.completed || 0 });
            });
        });
    }

    // ==================== WORKFLOW CRUD OPERATIONS ====================

    /**
     * Create new workflow
     */
    createWorkflow(workflowData) {
        return new Promise((resolve, reject) => {
            // Support both old and new format
            let sql, params;
            
            if (typeof workflowData === 'object' && workflowData.name) {
                // New object format
                sql = `
                    INSERT INTO workflows (name, description, target_url, timeout, screen_id, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                params = [
                    workflowData.name,
                    workflowData.description || '',
                    workflowData.target_url || '',
                    workflowData.timeout || 60000,
                    workflowData.screen_id || null,
                    workflowData.is_active !== false ? 1 : 0
                ];
            } else {
                // Old format for backward compatibility
                sql = `
                    INSERT INTO workflows (screen_id, name, description, target_url, mode, timeout)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                params = [
                    arguments[0], // screenId
                    arguments[1], // name
                    arguments[2] || '', // description
                    arguments[3] || '', // targetUrl
                    arguments[4] || 'data_entry', // mode
                    arguments[5] || 60000 // timeout
                ];
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Workflow creation failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Workflow created with ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Create new screen
     * Supports both object format: { name, url, description }
     * and positional args: name, url, description
     */
    createScreen(nameOrObj, urlArg, descriptionArg) {
        return new Promise((resolve, reject) => {
            let name, url, description;
            if (typeof nameOrObj === 'object') {
                name = nameOrObj.name;
                url = nameOrObj.url || '';
                description = nameOrObj.description || '';
            } else {
                name = nameOrObj;
                url = urlArg || '';
                description = descriptionArg || '';
            }

            const sql = `INSERT OR IGNORE INTO screens (name, url, description, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
            this.db.run(sql, [name, url, description], function(err) {
                if (err) {
                    console.error('❌ Screen creation failed:', err);
                    reject(err);
                } else {
                    // If INSERT OR IGNORE did not insert, try to fetch existing id
                    if (this.lastID && this.lastID > 0) {
                        resolve(this.lastID);
                    } else {
                        // Find existing by URL or name
                        const finder = `SELECT id FROM screens WHERE url = ? OR name = ? LIMIT 1`;
                        // Use the parent's db reference inside closure
                        const parentDb = this; // not the DatabaseManager; need outer reference
                        // We'll run a separate get via the manager's db
                        // (can't access this.lastID reliably when OR IGNORE prevents insert)
                        // Use the DatabaseManager's db via closure
                        // (find id by url)
                    }
                }
            });
            // As a fallback, fetch the inserted/existing id asynchronously
            // We'll attempt to select the screen by URL or name after a short delay
            setTimeout(() => {
                this.db.get('SELECT id FROM screens WHERE url = ? OR name = ? LIMIT 1', [url, name], (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row && row.id) {
                        resolve(row.id);
                    } else {
                        // If still not found, resolve null
                        resolve(null);
                    }
                });
            }, 50);
        });
    }

    /**
     * Update workflow
     */
    updateWorkflow(id, workflowData) {
        return new Promise((resolve, reject) => {
            console.log('🔧 Database updateWorkflow - ID:', id, 'WorkflowData:', workflowData);
            const sql = `
                UPDATE workflows 
                SET name = ?, description = ?, target_url = ?, timeout = ?, screen_id = ?, is_active = ?
                WHERE id = ?
            `;
            const params = [
                workflowData.name,
                workflowData.description || '',
                workflowData.target_url || '',
                workflowData.timeout || 60000,
                workflowData.screen_id || null,
                workflowData.is_active !== false ? 1 : 0,
                id
            ];
            console.log('🔧 SQL Params:', params);

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Workflow update failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Workflow updated:', id);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Delete workflow
     */
    deleteWorkflow(id) {
        return new Promise((resolve, reject) => {
            const self = this;

            // Prevent deletion if there are active/pending records for this workflow
            const activeRecordsSql = 'SELECT COUNT(*) as count FROM records_queue WHERE workflow_id = ? AND status IN ("pending","processing")';
            this.db.get(activeRecordsSql, [id], (recErr, recRow) => {
                if (recErr) {
                    console.error('❌ Checking records_queue failed:', recErr);
                    reject(recErr);
                    return;
                }

                if (recRow && recRow.count > 0) {
                    const msg = 'Bu workflow için bekleyen veya işlemde olan kayıtlar var. Önce kuyruğu temizleyin veya işlemi durdurun.';
                    console.warn('⚠️', msg);
                    reject(new Error(msg));
                    return;
                }

                // Check if processing_queue table exists and if there are active items
                this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='processing_queue'", (tblErr, tblRow) => {
                    if (tblErr) {
                        // Non-fatal - treat as no table
                        console.warn('⚠️ processing_queue existence check failed:', tblErr.message);
                    }

                    const hasProcessingQueue = tblRow && tblRow.name === 'processing_queue';

                    const checkProcessingQueue = (cb) => {
                        if (!hasProcessingQueue) return cb(null, 0);
                        const activeProcSql = 'SELECT COUNT(*) as count FROM processing_queue WHERE workflow_id = ? AND status IN ("pending","processing")';
                        self.db.get(activeProcSql, [id], (pqErr, pqRow) => {
                            if (pqErr) {
                                // Treat as no active items if table is missing or query fails
                                console.warn('⚠️ Could not query processing_queue:', pqErr.message);
                                return cb(null, 0);
                            }
                            cb(null, pqRow.count);
                        });
                    };

                    checkProcessingQueue((pqErr, activeProcCount) => {
                        if (pqErr) {
                            reject(pqErr);
                            return;
                        }

                        if (activeProcCount > 0) {
                            const msg = 'Bu workflow için processing_queue üzerinde bekleyen veya işlemde olan öğeler bulunuyor. Önce işlemleri durdurun.';
                            console.warn('⚠️', msg);
                            reject(new Error(msg));
                            return;
                        }

                        // Also don't delete if there are running execution logs
                        const activeLogsSql = 'SELECT COUNT(*) as count FROM execution_logs WHERE workflow_id = ? AND status IN ("running","started")';
                        self.db.get(activeLogsSql, [id], (logErr, logRow) => {
                            if (logErr) {
                                console.warn('⚠️ Could not query execution_logs:', logErr.message);
                                // Proceed cautiously - allow deletion if no queue entries, but log the warning
                            }

                            if (logRow && logRow.count > 0) {
                                const msg = 'Bu workflow için halen çalışan execution log girdileri var. İşlem devam ederken silme yapılamaz.';
                                console.warn('⚠️', msg);
                                reject(new Error(msg));
                                return;
                            }

                            // Proceed with deletion of dependent rows inside a transaction
                            const deleteProcessingSql = 'DELETE FROM processing_queue WHERE workflow_id = ?';
                            const deleteRecordsSql = 'DELETE FROM records_queue WHERE workflow_id = ?';
                            const deleteLogsSql = 'DELETE FROM execution_logs WHERE workflow_id = ?';
                            const deleteStepsSql = 'DELETE FROM steps WHERE workflow_id = ?';
                            const deleteWorkflowSql = 'DELETE FROM workflows WHERE id = ?';

                            // Begin transaction
                            self.db.run('BEGIN TRANSACTION', (beginErr) => {
                                if (beginErr) {
                                    console.error('❌ Begin transaction failed:', beginErr);
                                    reject(beginErr);
                                    return;
                                }

                                // Delete from processing_queue if table exists
                                const runDeleteProcessing = (cb2) => {
                                    if (!hasProcessingQueue) return cb2();
                                    self.db.run(deleteProcessingSql, [id], (dpErr) => {
                                        if (dpErr) return cb2(dpErr);
                                        cb2();
                                    });
                                };

                                runDeleteProcessing((dpErr) => {
                                    if (dpErr) {
                                        console.error('❌ Delete processing_queue failed:', dpErr);
                                        return self.db.run('ROLLBACK', () => reject(dpErr));
                                    }

                                    // Delete records_queue
                                    self.db.run(deleteRecordsSql, [id], (drErr) => {
                                        if (drErr) {
                                            console.error('❌ Delete records_queue failed:', drErr);
                                            return self.db.run('ROLLBACK', () => reject(drErr));
                                        }

                                        // Delete execution_logs
                                        self.db.run(deleteLogsSql, [id], (dlErr) => {
                                            if (dlErr) {
                                                console.error('❌ Delete execution_logs failed:', dlErr);
                                                return self.db.run('ROLLBACK', () => reject(dlErr));
                                            }

                                            // Delete steps
                                            self.db.run(deleteStepsSql, [id], (stepsErr) => {
                                                if (stepsErr) {
                                                    console.error('❌ Delete workflow steps failed:', stepsErr);
                                                    return self.db.run('ROLLBACK', () => reject(stepsErr));
                                                }

                                                // Finally delete workflow
                                                self.db.run(deleteWorkflowSql, [id], function(workflowErr) {
                                                    if (workflowErr) {
                                                        console.error('❌ Delete workflow failed:', workflowErr);
                                                        return self.db.run('ROLLBACK', () => reject(workflowErr));
                                                    }

                                                    // Commit transaction
                                                    self.db.run('COMMIT', (commitErr) => {
                                                        if (commitErr) {
                                                            console.error('❌ Commit failed:', commitErr);
                                                            return self.db.run('ROLLBACK', () => reject(commitErr));
                                                        }

                                                        console.log('✅ Workflow and dependent data deleted:', id);
                                                        resolve(this.changes);
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Duplicate workflow with all its steps
     * @param {number} sourceWorkflowId - ID of the workflow to duplicate
     * @param {string} newName - Name for the duplicated workflow
     * @returns {Promise<number>} - ID of the newly created workflow
     */
    duplicateWorkflow(sourceWorkflowId, newName) {
        return new Promise((resolve, reject) => {
            const self = this;

            // 1. Validation: Ensure sourceWorkflowId is numeric
            if (!sourceWorkflowId || typeof sourceWorkflowId !== 'number') {
                console.error('❌ Geçersiz workflow ID:', sourceWorkflowId);
                reject(new Error('Geçersiz workflow ID. Lütfen geçerli bir workflow seçin.'));
                return;
            }

            // 2. Validation: Ensure newName is valid
            if (!newName || typeof newName !== 'string' || newName.trim().length < 3) {
                console.error('❌ Geçersiz workflow adı:', newName);
                reject(new Error('Workflow adı en az 3 karakter olmalıdır.'));
                return;
            }

            if (newName.length > 100) {
                console.error('❌ Workflow adı çok uzun:', newName.length);
                reject(new Error('Workflow adı en fazla 100 karakter olabilir.'));
                return;
            }

            console.log(`🔧 Workflow kopyalama başlatılıyor - Kaynak ID: ${sourceWorkflowId}, Yeni Ad: "${newName}"`);

            // 3. Check if source workflow exists
            self.getWorkflow(sourceWorkflowId)
                .then(sourceWorkflow => {
                    if (!sourceWorkflow) {
                        throw new Error(`Kaynak workflow bulunamadı (ID: ${sourceWorkflowId})`);
                    }

                    console.log(`✅ Kaynak workflow bulundu: "${sourceWorkflow.name}"`);

                    // 4. Check if workflow with newName already exists
                    const checkNameSql = 'SELECT id FROM workflows WHERE name = ?';
                    self.db.get(checkNameSql, [newName.trim()], (checkErr, existingRow) => {
                        if (checkErr) {
                            console.error('❌ İsim kontrolü başarısız:', checkErr);
                            reject(checkErr);
                            return;
                        }

                        if (existingRow) {
                            const msg = `Bu isimde bir workflow zaten mevcut: "${newName}"`;
                            console.warn('⚠️', msg);
                            reject(new Error(msg));
                            return;
                        }

                        // 5. Begin transaction for atomic operation
                        self.db.run('BEGIN TRANSACTION', (beginErr) => {
                            if (beginErr) {
                                console.error('❌ Transaction başlatılamadı:', beginErr);
                                reject(beginErr);
                                return;
                            }

                            console.log('🔧 Transaction başlatıldı - Workflow kopyalanıyor...');

                            // 6. Create new workflow with same properties but new name
                            const insertWorkflowSql = `
                                INSERT INTO workflows (name, description, target_url, mode, timeout, screen_id, is_active, created_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            `;

                            const workflowParams = [
                                newName.trim(),
                                sourceWorkflow.description || '',
                                sourceWorkflow.target_url || '',
                                sourceWorkflow.mode || 'data_entry',
                                sourceWorkflow.timeout || 30000,
                                sourceWorkflow.screen_id || null,
                                1 // is_active = true by default
                            ];

                            self.db.run(insertWorkflowSql, workflowParams, function(insertErr) {
                                if (insertErr) {
                                    console.error('❌ Yeni workflow oluşturulamadı:', insertErr);
                                    return self.db.run('ROLLBACK', () => reject(insertErr));
                                }

                                const newWorkflowId = this.lastID;
                                console.log(`✅ Yeni workflow oluşturuldu - ID: ${newWorkflowId}`);

                                // 7. Get all steps from source workflow
                                const getStepsSql = `
                                    SELECT step_order, action_type, description, selector, config, wait_after, is_optional
                                    FROM steps
                                    WHERE workflow_id = ?
                                    ORDER BY step_order ASC
                                `;

                                self.db.all(getStepsSql, [sourceWorkflowId], (stepsErr, steps) => {
                                    if (stepsErr) {
                                        console.error('❌ Kaynak workflow step\'leri alınamadı:', stepsErr);
                                        return self.db.run('ROLLBACK', () => reject(stepsErr));
                                    }

                                    console.log(`🔧 ${steps.length} adet step kopyalanacak...`);

                                    if (steps.length === 0) {
                                        // No steps to copy, just commit
                                        console.log('⚠️ Kaynak workflow\'da step bulunmuyor, sadece workflow kopyalandı');
                                        return self.db.run('COMMIT', (commitErr) => {
                                            if (commitErr) {
                                                console.error('❌ Commit başarısız:', commitErr);
                                                return self.db.run('ROLLBACK', () => reject(commitErr));
                                            }
                                            console.log(`✅ Workflow başarıyla kopyalandı (step olmadan) - Yeni ID: ${newWorkflowId}`);
                                            resolve(newWorkflowId);
                                        });
                                    }

                                    // 8. Insert all steps for new workflow
                                    const insertStepSql = `
                                        INSERT INTO steps (workflow_id, step_order, action_type, description, selector, config, wait_after, is_optional)
                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                    `;

                                    let stepsInserted = 0;
                                    let stepInsertError = null;

                                    // Insert steps one by one (sequential to maintain order)
                                    const insertNextStep = (index) => {
                                        if (index >= steps.length) {
                                            // All steps inserted, commit transaction
                                            if (stepInsertError) {
                                                console.error('❌ Step kopyalama hatası:', stepInsertError);
                                                return self.db.run('ROLLBACK', () => reject(stepInsertError));
                                            }

                                            self.db.run('COMMIT', (commitErr) => {
                                                if (commitErr) {
                                                    console.error('❌ Commit başarısız:', commitErr);
                                                    return self.db.run('ROLLBACK', () => reject(commitErr));
                                                }

                                                console.log(`✅ Workflow başarıyla kopyalandı - Yeni ID: ${newWorkflowId}, ${stepsInserted} step kopyalandı`);
                                                resolve(newWorkflowId);
                                            });
                                            return;
                                        }

                                        const step = steps[index];
                                        const stepParams = [
                                            newWorkflowId,
                                            step.step_order,
                                            step.action_type,
                                            step.description || '',
                                            step.selector || '',
                                            step.config || '{}',
                                            step.wait_after || 1000,
                                            step.is_optional || 0
                                        ];

                                        self.db.run(insertStepSql, stepParams, function(stepErr) {
                                            if (stepErr) {
                                                stepInsertError = stepErr;
                                                console.error(`❌ Step ${index + 1} kopyalanamadı:`, stepErr);
                                                return self.db.run('ROLLBACK', () => reject(stepErr));
                                            }

                                            stepsInserted++;
                                            console.log(`📋 Step ${index + 1}/${steps.length} kopyalandı (Order: ${step.step_order}, Type: ${step.action_type})`);
                                            
                                            // Continue with next step
                                            insertNextStep(index + 1);
                                        });
                                    };

                                    // Start inserting from first step
                                    insertNextStep(0);
                                });
                            });
                        });
                    });
                })
                .catch(err => {
                    console.error('❌ Workflow kopyalama başarısız:', err);
                    reject(err);
                });
        });
    }

    // ==================== STEP CRUD OPERATIONS ====================

    /**
     * Create new step
     */
    createStep(stepData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO steps (workflow_id, step_order, action_type, description, selector, config, wait_after, is_optional)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            // Handle config properly - prioritize stepData.value if provided  
            let configValue;
            if (stepData.value) {
                // If value is provided, use it (template variables like {{student_no}})
                configValue = JSON.stringify({value: stepData.value});
            } else if (stepData.config) {
                // Otherwise use existing config
                configValue = stepData.config;
            } else {
                // Fallback to empty value
                configValue = JSON.stringify({value: ''});
            }
            
            const params = [
                stepData.workflow_id,
                stepData.step_order,
                stepData.action_type,
                stepData.description || '',
                stepData.selector || '',
                configValue,
                stepData.wait_after || 500,
                stepData.is_optional ? 1 : 0
            ];

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Step creation failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Step created with ID:', this.lastID);
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Update step
     */
    updateStep(id, stepData) {
        return new Promise((resolve, reject) => {
            console.log('🔧 Database updateStep - ID:', id, 'StepData:', stepData);
            const sql = `
                UPDATE steps 
                SET step_order = ?, action_type = ?, description = ?, selector = ?, config = ?, wait_after = ?, is_optional = ?
                WHERE id = ?
            `;
            // Handle config properly - prioritize stepData.value over empty config
            let configValue;
            if (stepData.value && stepData.value.trim() !== '') {
                // If value is provided and not empty, use it (template variables like {{student_no}})
                console.log('🔧 Using stepData.value:', stepData.value);
                configValue = JSON.stringify({value: stepData.value});
            } else if (stepData.config) {
                // Parse existing config and check if it has meaningful value
                try {
                    const parsedConfig = JSON.parse(stepData.config);
                    if (parsedConfig.value && parsedConfig.value.trim() !== '') {
                        // Existing config has value, keep it
                        configValue = stepData.config;
                    } else if (stepData.value) {
                        // Config is empty but value exists, use value
                        console.log('🔧 Config empty, using stepData.value:', stepData.value);
                        configValue = JSON.stringify({value: stepData.value});
                    } else {
                        // Both empty, keep existing config
                        configValue = stepData.config;
                    }
                } catch (e) {
                    // Invalid JSON, fallback to value or empty
                    configValue = stepData.value ? JSON.stringify({value: stepData.value}) : JSON.stringify({value: ''});
                }
            } else {
                // No config, use value or fallback to empty
                configValue = JSON.stringify({value: stepData.value || ''});
            }
            
            const params = [
                stepData.step_order,
                stepData.action_type,
                stepData.description || '',
                stepData.selector || '',
                configValue,
                stepData.wait_after || 500,
                stepData.is_optional ? 1 : 0,
                id
            ];
            console.log('🔧 SQL Params:', params);

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌ Step update failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Step updated:', id);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Delete step
     */
    deleteStep(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM steps WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    console.error('❌ Step deletion failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Step deleted:', id);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Delete all steps by workflow ID
     */
    deleteStepsByWorkflow(workflowId) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM steps WHERE workflow_id = ?';
            
            this.db.run(sql, [workflowId], function(err) {
                if (err) {
                    console.error('❌ Steps deletion failed for workflow:', workflowId, err);
                    reject(err);
                } else {
                    console.log('✅ All steps deleted for workflow:', workflowId, '- count:', this.changes);
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Get all screens (placeholder method)
     */
    getAllScreens() {
        return new Promise((resolve, reject) => {
            // Şu an için boş array döndür
            // İleride screen capture özelliği eklenirse burası implement edilecek
            resolve([]);
        });
    }

    /**
     * Update course code in a script for a specific workflow
     * @param {number} workflowId - The ID of the workflow
     * @param {string} oldCourseCode - The course code to search for
     * @param {string} newCourseCode - The course code to replace with
     * @returns {Promise<void>}
     */
    async updateCourseCodeInScript(workflowId, oldCourseCode, newCourseCode) {
        return new Promise((resolve, reject) => {
            const query = `SELECT id, config FROM steps WHERE workflow_id = ? AND action_type = 'execute_script'`;

            this.db.all(query, [workflowId], (err, rows) => {
                if (err) {
                    console.error('❌ Failed to fetch steps:', err);
                    reject(err);
                    return;
                }

                const updates = rows.map((row) => {
                    try {
                        const config = JSON.parse(row.config);
                        if (config.script.includes(oldCourseCode)) {
                            config.script = config.script.replace(oldCourseCode, newCourseCode);
                            const updateQuery = `UPDATE steps SET config = ? WHERE id = ?`;
                            this.db.run(updateQuery, [JSON.stringify(config), row.id], (updateErr) => {
                                if (updateErr) {
                                    console.error(`❌ Failed to update step ID ${row.id}:`, updateErr);
                                }
                            });
                        }
                    } catch (parseErr) {
                        console.error(`❌ Failed to parse config for step ID ${row.id}:`, parseErr);
                    }
                });

                Promise.all(updates).then(() => resolve()).catch(reject);
            });
        });
    }
}

module.exports = DatabaseManager;