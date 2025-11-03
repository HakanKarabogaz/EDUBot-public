/**
 * HybridImportManager.jsx
 * CSV Enhancement + Database Integration = Hybrid System
 */

import React, { useState, useEffect } from 'react';
import './HybridImportManager.css';

const HybridImportManager = () => {
    const [csvData, setCsvData] = useState(null);
    const [importStatus, setImportStatus] = useState('idle'); // idle, processing, complete
    const [importStats, setImportStats] = useState({
        totalRecords: 0,
        studentsImported: 0,
        coursesImported: 0,
        enrollmentsCreated: 0,
        duplicatesSkipped: 0
    });
    const [previewData, setPreviewData] = useState([]);
    const [selectedRecords, setSelectedRecords] = useState(new Set());

    const handleCSVUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setImportStatus('processing');
            
            // CSV'yi parse et
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            
            const data = lines.slice(1).map((line, index) => {
                const values = line.split(',').map(v => v.trim());
                const record = {};
                headers.forEach((header, i) => {
                    record[header] = values[i] || '';
                });
                record._index = index;
                return record;
            });

            setCsvData(data);
            setPreviewData(data.slice(0, 10)); // İlk 10 kayıt preview
            setImportStats(prev => ({ ...prev, totalRecords: data.length }));
            setImportStatus('complete');
            
            console.log('📊 CSV loaded:', data.length, 'records');
            
        } catch (error) {
            console.error('❌ CSV upload failed:', error);
            setImportStatus('idle');
        }
    };

    const handleHybridImport = async () => {
        if (!csvData) return;

        try {
            setImportStatus('processing');
            
            console.log('🔄 Starting Hybrid Import...');
            
            // Hybrid Import API çağrısı
            const result = await window.electronAPI.invoke('hybrid:importCSV', csvData, {
                createStudents: true,
                createCourses: true,
                createEnrollments: true,
                skipDuplicates: true
            });

            setImportStats(result.stats);
            console.log('✅ Hybrid Import completed:', result);
            
            setImportStatus('complete');
            
        } catch (error) {
            console.error('❌ Hybrid Import failed:', error);
            setImportStatus('idle');
        }
    };

    const toggleRecordSelection = (index) => {
        const newSelected = new Set(selectedRecords);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedRecords(newSelected);
    };

    const selectAll = () => {
        if (selectedRecords.size === csvData?.length) {
            setSelectedRecords(new Set());
        } else {
            setSelectedRecords(new Set(csvData?.map((_, i) => i) || []));
        }
    };

    return (
        <div className="hybrid-import-manager">
            <div className="header">
                <h2>🔗 Hybrid System - CSV + Database Integration</h2>
                <p>CSV yükleyin, akıllı filtreleme yapın, database'e aktarın!</p>
            </div>

            {/* Step 1: CSV Upload */}
            <div className="step-section">
                <h3>📁 Step 1: CSV Dosyası Yükle</h3>
                <div className="upload-area">
                    <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleCSVUpload}
                        id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="upload-button">
                        📂 CSV Dosyası Seç
                    </label>
                </div>
            </div>

            {/* Step 2: Preview & Select */}
            {csvData && (
                <div className="step-section">
                    <h3>👀 Step 2: Veri Önizleme & Seçim</h3>
                    <div className="stats-bar">
                        <span>📊 Toplam: {importStats.totalRecords}</span>
                        <span>✅ Seçili: {selectedRecords.size}</span>
                        <button onClick={selectAll} className="select-all-btn">
                            {selectedRecords.size === csvData?.length ? '❌ Hiçbirini Seçme' : '✅ Tümünü Seç'}
                        </button>
                    </div>
                    
                    <div className="preview-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Seç</th>
                                    <th>Öğrenci No</th>
                                    <th>Ders Kodu</th>
                                    <th>Not</th>
                                    <th>Harf Notu</th>
                                    <th>Ders Alış Şekli</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.map((record, index) => (
                                    <tr key={index} className={selectedRecords.has(index) ? 'selected' : ''}>
                                        <td>
                                            <input 
                                                type="checkbox"
                                                checked={selectedRecords.has(index)}
                                                onChange={() => toggleRecordSelection(index)}
                                            />
                                        </td>
                                        <td>{record.student_no}</td>
                                        <td>{record.course_code}</td>
                                        <td>{record.numeric_grade}</td>
                                        <td>{record.letter_grade}</td>
                                        <td>{record.ders_alis_sekli}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Step 3: Hybrid Import */}
            {csvData && (
                <div className="step-section">
                    <h3>🔗 Step 3: Hybrid Import (CSV → Database)</h3>
                    <div className="import-controls">
                        <button 
                            onClick={handleHybridImport}
                            disabled={importStatus === 'processing' || selectedRecords.size === 0}
                            className="hybrid-import-btn"
                        >
                            {importStatus === 'processing' ? '⏳ İşleniyor...' : '🚀 Hybrid Import Başlat'}
                        </button>
                    </div>
                    
                    {importStats.studentsImported > 0 && (
                        <div className="import-results">
                            <h4>📊 Import Sonuçları:</h4>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span className="stat-label">👤 Öğrenci:</span>
                                    <span className="stat-value">{importStats.studentsImported}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">📚 Ders:</span>
                                    <span className="stat-value">{importStats.coursesImported}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">📝 Kayıt:</span>
                                    <span className="stat-value">{importStats.enrollmentsCreated}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">⏭️ Atlandı:</span>
                                    <span className="stat-value">{importStats.duplicatesSkipped}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HybridImportManager;