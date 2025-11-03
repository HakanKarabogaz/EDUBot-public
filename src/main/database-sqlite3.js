/**
 * database.js
 * SQLite database operations for EduBot
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

                // Open database connection with sqlite3
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('❌ Database connection failed:', err);
                        reject(err);
                        return;
                    }

                    console.log('✅ SQLite3 database connected at:', this.dbPath);
                    
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON', (err) => {
                        if (err) {
                            console.error('❌ Foreign keys enable failed:', err);
                            reject(err);
                            return;
                        }

                        // Create tables
                        this.createTables()
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
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (screen_id) REFERENCES screens(id)
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
                    
                    this.db.run(sql, [testData.name, testData.type, testData.description, testData.data_type, testData.content], function(err) {
                        if (err) {
                            console.error('❌ Test data insertion failed:', err);
                            reject(err);
                        } else {
                            console.log('✅ Test data inserted successfully with ID:', this.lastID);
                            resolve();
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
}

module.exports = DatabaseManager;