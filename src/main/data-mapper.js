/**
 * data-mapper.js
 * Data Source Management & Mapping
 * 
 * Görevler:
 * - Veri kaynaklarından veri okuma (CSV, JSON, Static)
 * - Veri transformasyonu
 * - Queue yönetimi
 * - Column mapping
 * - Data validation
 */

const fs = require('fs').promises;
const path = require('path');
const Database = require('./database');

class DataMapper {
    constructor(dbPath) {
        this.db = new Database(dbPath);
    }

    /**
     * Initialize
     */
    // ✅ YENİ:
    async initialize() {
        // Ensure database is fully initialized before using
        await this.db.init();
        console.log('✅ DataMapper initialized');
    }

    /**
     * Veri kaynağından kayıtları yükle
     * @param {number} dataSourceId - Data source ID
     * @returns {Array} Kayıt listesi
     */
    async loadDataSource(dataSourceId) {
        try {
            console.log(`📊 Loading data source: ${dataSourceId}`);

            // Data source bilgilerini al
            const dataSource = await this.db.getDataSource(dataSourceId);
            if (!dataSource) {
                throw new Error(`Data source not found: ${dataSourceId}`);
            }

            console.log(`📋 Data source: ${dataSource.name}`);
            console.log(`📝 Type: ${dataSource.type}`);

            let records = [];

            // Tip'e göre veri yükle
            switch (dataSource.type) {
                case 'csv':
                    records = await this.loadCSV(dataSource);
                    break;

                case 'json':
                    records = await this.loadJSON(dataSource);
                    break;

                case 'static':
                    records = await this.loadStatic(dataSource);
                    break;

                case 'excel':
                    records = await this.loadExcel(dataSource);
                    break;

                default:
                    throw new Error(`Unknown data source type: ${dataSource.type}`);
            }

            console.log(`✅ Loaded ${records.length} records`);
            return records;

        } catch (error) {
            console.error('❌ Load data source failed:', error);
            throw error;
        }
    }

    /**
     * CSV dosyasından veri yükle
     * @param {Object} dataSource - Data source objesi
     */
    async loadCSV(dataSource) {
        try {
            // Accept config as object or JSON string. Fall back to content for backwards compatibility.
            const rawConfig = dataSource.config ?? dataSource.content;
            const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig || {});
            const filePath = config.filePath;

            console.log(`📄 Reading CSV file: ${filePath}`);

            // Dosya var mı kontrol et
            const fileExists = await this.fileExists(filePath);
            if (!fileExists) {
                throw new Error(`CSV file not found: ${filePath}`);
            }

            // Dosyayı oku
            const content = await fs.readFile(filePath, 'utf-8');
            
            // CSV parse et
            const records = this.parseCSV(content, config);

            console.log(`✅ CSV parsed: ${records.length} records`);
            return records;

        } catch (error) {
            console.error('❌ Load CSV failed:', error);
            throw error;
        }
    }

    /**
     * CSV parse et
     * @param {string} content - CSV içeriği
     * @param {Object} config - Config objesi
     */
    parseCSV(content, config = {}) {
        const delimiter = config.delimiter || ',';
        const hasHeader = config.hasHeader !== false; // Default true
        const encoding = config.encoding || 'utf-8';

        // Satırlara böl
        const lines = content.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            return [];
        }

        // Header'ı al
        let headers = [];
        let dataStartIndex = 0;

        if (hasHeader) {
            headers = this.parseCSVLine(lines[0], delimiter);
            dataStartIndex = 1;
        } else {
            // Header yoksa otomatik oluştur (col1, col2, ...)
            const firstLine = this.parseCSVLine(lines[0], delimiter);
            headers = firstLine.map((_, index) => `col${index + 1}`);
            dataStartIndex = 0;
        }

        // Data satırlarını parse et
        const records = [];
        for (let i = dataStartIndex; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
            
            // Boş satırları atla
            if (values.every(v => !v || v.trim() === '')) {
                continue;
            }

            // Object oluştur
            const record = {};
            headers.forEach((header, index) => {
                record[header.trim()] = values[index] ? values[index].trim() : '';
            });

            records.push(record);
        }

        return records;
    }

    /**
     * CSV satırını parse et (quoted values desteği)
     * @param {string} line - CSV satırı
     * @param {string} delimiter - Ayırıcı
     */
    parseCSVLine(line, delimiter = ',') {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quotes
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                // End of value
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Son değeri ekle
        values.push(current);

        return values;
    }

    /**
     * JSON dosyasından veri yükle
     * @param {Object} dataSource - Data source objesi
     */
    async loadJSON(dataSource) {
        try {
            const rawConfig = dataSource.config ?? dataSource.content;
            const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig || {});
            const filePath = config.filePath;

            console.log(`📄 Reading JSON file: ${filePath}`);

            // Dosya var mı kontrol et
            const fileExists = await this.fileExists(filePath);
            if (!fileExists) {
                throw new Error(`JSON file not found: ${filePath}`);
            }

            // Dosyayı oku
            const content = await fs.readFile(filePath, 'utf-8');
            
            // JSON parse et
            const data = JSON.parse(content);

            // Array değilse array'e çevir
            const records = Array.isArray(data) ? data : [data];

            console.log(`✅ JSON parsed: ${records.length} records`);
            return records;

        } catch (error) {
            console.error('❌ Load JSON failed:', error);
            throw error;
        }
    }

    /**
     * Static data yükle
     * @param {Object} dataSource - Data source objesi
     */
    async loadStatic(dataSource) {
        try {
            const rawConfig = dataSource.config ?? dataSource.content;
            const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig || {});
            const data = config.data;

            console.log(`📝 Loading static data...`);

            // Array değilse array'e çevir
            const records = Array.isArray(data) ? data : [data];

            console.log(`✅ Static data loaded: ${records.length} records`);
            return records;

        } catch (error) {
            console.error('❌ Load static data failed:', error);
            throw error;
        }
    }

    /**
     * Excel dosyasından veri yükle (gelecekte - xlsx library gerekir)
     * @param {Object} dataSource - Data source objesi
     */
    async loadExcel(dataSource) {
        // TODO: xlsx library eklenecek
        throw new Error('Excel support not implemented yet. Use CSV instead.');
    }

    /**
     * Kayıtları queue'ya ekle
     * @param {number} workflowId - Workflow ID
     * @param {number} dataSourceId - Data source ID
     * @param {Array} records - Kayıt listesi
     */
    async queueRecords(workflowId, dataSourceId, records) {
        try {
            console.log(`📥 Queueing ${records.length} records...`);

            let queuedCount = 0;

            for (const record of records) {
                await this.db.addToQueue({
                    workflow_id: workflowId,
                    data_source_id: dataSourceId,
                    record_data: JSON.stringify(record),
                    status: 'pending'
                });
                queuedCount++;
            }

            console.log(`✅ Queued ${queuedCount} records`);
            return queuedCount;

        } catch (error) {
            console.error('❌ Queue records failed:', error);
            throw error;
        }
    }

    /**
     * Veri transformasyonu uygula
     * @param {any} value - Değer
     * @param {string} transform - Transform tipi
     */
    transformValue(value, transform) {
        if (!transform || !value) {
            return value;
        }

        switch (transform.toLowerCase()) {
            case 'uppercase':
                return String(value).toUpperCase();

            case 'lowercase':
                return String(value).toLowerCase();

            case 'trim':
                return String(value).trim();

            case 'number':
                return Number(value);

            case 'string':
                return String(value);

            case 'date':
                return new Date(value).toISOString();

            case 'date_tr':
                // DD.MM.YYYY formatına çevir
                const date = new Date(value);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}.${month}.${year}`;

            case 'phone':
                // Telefon numarasını temizle (sadece rakamlar)
                return String(value).replace(/\D/g, '');

            case 'tc':
                // TC kimlik no temizle (11 haneli)
                const tc = String(value).replace(/\D/g, '');
                return tc.substring(0, 11);

            default:
                console.warn(`⚠️ Unknown transform: ${transform}`);
                return value;
        }
    }

    /**
     * Column mapping uygula
     * @param {Object} record - Kayıt
     * @param {Object} mapping - Column mapping
     */
    applyMapping(record, mapping) {
        if (!mapping) {
            return record;
        }

        const mapped = {};

        Object.keys(mapping).forEach(targetField => {
            const sourceField = mapping[targetField];
            
            if (typeof sourceField === 'string') {
                // Basit mapping
                mapped[targetField] = record[sourceField];
            } else if (typeof sourceField === 'object') {
                // Complex mapping (transform ile)
                const { field, transform } = sourceField;
                const value = record[field];
                mapped[targetField] = this.transformValue(value, transform);
            }
        });

        return mapped;
    }

    /**
     * Veri validasyonu
     * @param {Object} record - Kayıt
     * @param {Object} rules - Validation rules
     */
    validateRecord(record, rules) {
        if (!rules) {
            return { valid: true, errors: [] };
        }

        const errors = [];

        Object.keys(rules).forEach(field => {
            const rule = rules[field];
            const value = record[field];

            // Required check
            if (rule.required && (!value || value === '')) {
                errors.push(`${field} is required`);
            }

            // Type check
            if (rule.type && value) {
                switch (rule.type) {
                    case 'number':
                        if (isNaN(value)) {
                            errors.push(`${field} must be a number`);
                        }
                        break;

                    case 'email':
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(value)) {
                            errors.push(`${field} must be a valid email`);
                        }
                        break;

                    case 'phone':
                        const phoneRegex = /^[0-9]{10,11}$/;
                        if (!phoneRegex.test(String(value).replace(/\D/g, ''))) {
                            errors.push(`${field} must be a valid phone number`);
                        }
                        break;

                    case 'tc':
                        const tcRegex = /^[0-9]{11}$/;
                        if (!tcRegex.test(String(value))) {
                            errors.push(`${field} must be a valid TC number (11 digits)`);
                        }
                        break;
                }
            }

            // Min/Max length
            if (rule.minLength && String(value).length < rule.minLength) {
                errors.push(`${field} must be at least ${rule.minLength} characters`);
            }

            if (rule.maxLength && String(value).length > rule.maxLength) {
                errors.push(`${field} must be at most ${rule.maxLength} characters`);
            }

            // Pattern
            if (rule.pattern && value) {
                const regex = new RegExp(rule.pattern);
                if (!regex.test(value)) {
                    errors.push(`${field} does not match pattern: ${rule.pattern}`);
                }
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Dosya var mı kontrol et
     * @param {string} filePath - Dosya yolu
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * CSV dosyası oluştur (export için)
     * @param {Array} records - Kayıt listesi
     * @param {string} filePath - Dosya yolu
     * @param {Object} options - Options
     */
    async exportToCSV(records, filePath, options = {}) {
        try {
            if (records.length === 0) {
                throw new Error('No records to export');
            }

            const delimiter = options.delimiter || ',';
            const includeHeader = options.includeHeader !== false;

            // Header oluştur
            const headers = Object.keys(records[0]);
            let csv = '';

            if (includeHeader) {
                csv += headers.join(delimiter) + '\n';
            }

            // Data satırları
            records.forEach(record => {
                const values = headers.map(header => {
                    let value = record[header] || '';
                    
                    // Quote if contains delimiter or newline
                    if (String(value).includes(delimiter) || String(value).includes('\n')) {
                        value = `"${String(value).replace(/"/g, '""')}"`;
                    }
                    
                    return value;
                });

                csv += values.join(delimiter) + '\n';
            });

            // Dosyaya yaz
            await fs.writeFile(filePath, csv, 'utf-8');

            console.log(`✅ CSV exported: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('❌ Export CSV failed:', error);
            throw error;
        }
    }

    /**
     * JSON dosyası oluştur (export için)
     * @param {Array} records - Kayıt listesi
     * @param {string} filePath - Dosya yolu
     * @param {Object} options - Options
     */
    async exportToJSON(records, filePath, options = {}) {
        try {
            const pretty = options.pretty !== false;
            const indent = pretty ? 2 : 0;

            const json = JSON.stringify(records, null, indent);

            // Dosyaya yaz
            await fs.writeFile(filePath, json, 'utf-8');

            console.log(`✅ JSON exported: ${filePath}`);
            return filePath;

        } catch (error) {
            console.error('❌ Export JSON failed:', error);
            throw error;
        }
    }

    /**
     * Data source istatistikleri
     * @param {number} dataSourceId - Data source ID
     */
    async getDataSourceStats(dataSourceId) {
        try {
            const dataSource = await this.db.getDataSource(dataSourceId);
            if (!dataSource) {
                throw new Error(`Data source not found: ${dataSourceId}`);
            }

            const records = await this.loadDataSource(dataSourceId);

            // Queue istatistikleri
            const queueStats = await this.db.getQueueStats(dataSourceId);

            return {
                name: dataSource.name,
                type: dataSource.type,
                totalRecords: records.length,
                queueStats: queueStats || {
                    pending: 0,
                    processing: 0,
                    completed: 0,
                    failed: 0
                },
                createdAt: dataSource.created_at
            };

        } catch (error) {
            console.error('❌ Get stats failed:', error);
            throw error;
        }
    }
}

module.exports = DataMapper;