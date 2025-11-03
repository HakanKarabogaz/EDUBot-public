// DataSourceManager.jsx

import React, { useState, useCallback, useRef } from 'react';
const DataSourceManager = ({ onDataSourceChange, initialDataSources = [] }) => {
  const [dataSources, setDataSources] = useState(initialDataSources);
  const [activeTab, setActiveTab] = useState('upload');
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [staticData, setStaticData] = useState([]);
  const [newStaticEntry, setNewStaticEntry] = useState({ key: '', value: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // CSV dosyası yükleme
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Lütfen sadece CSV dosyası yükleyin.');
      return;
    }

    setIsLoading(true);
    setError('');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          setError('CSV dosyası boş görünüyor.');
          setIsLoading(false);
          return;
        }

        // Header'ları parse et
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
        setCsvHeaders(headers);

        // Veriyi parse et ve validate et
        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          row._id = index;
          
          // Grade validation
          if (row.numeric_grade && !isNaN(row.numeric_grade)) {
            row.numeric_grade = parseFloat(row.numeric_grade);
          }
          
          return row;
        });

        // Validate required columns for grade entry
        const requiredColumns = ['student_no', 'course_code'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
          setError(`CSV eksik kolonlar: ${missingColumns.join(', ')}`);
          setIsLoading(false);
          return;
        }

        setCsvData(data);
        setPreviewData(data.slice(0, 10)); // İlk 10 satırı önizleme için

        // Veri kaynağını güncelle
        const newDataSource = {
          id: `csv_${Date.now()}`,
          name: file.name,
          type: 'csv',
          headers: headers,
          data: data,
          rowCount: data.length,
          uploadDate: new Date().toISOString()
        };

        // Database'e kaydet
        try {
          const savedDataSource = await window.electronAPI.invoke('db:createDataSource', 
            file.name, 
            'csv', 
            `CSV dosyası - ${data.length} satır veri`, // description
            JSON.stringify(data) // CSV data'sını JSON string olarak kaydet
          );
          
          console.log('✅ CSV database\'e kaydedildi:', savedDataSource);
          
          // Saved data source'u kullan (database'den gelen ID ile)
          newDataSource.id = savedDataSource.id;
          
        } catch (dbError) {
          console.error('❌ CSV database\'e kaydedilemedi:', dbError);
          setError('CSV dosyası yüklendi ama database\'e kaydedilemedi: ' + dbError.message);
        }

        const updatedDataSources = [...dataSources, newDataSource];
        setDataSources(updatedDataSources);
        onDataSourceChange && onDataSourceChange(updatedDataSources);

        setSuccess(`CSV dosyası başarıyla yüklendi! ${data.length} satır veri bulundu.`);
        setIsLoading(false);
      } catch (err) {
        setError('CSV dosyası işlenirken hata oluştu: ' + err.message);
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Dosya okuma hatası oluştu.');
      setIsLoading(false);
    };

    reader.readAsText(file);
  }, [dataSources, onDataSourceChange]);

  // Statik veri ekleme
  const handleAddStaticData = useCallback(() => {
    if (!newStaticEntry.key.trim() || !newStaticEntry.value.trim()) {
      setError('Anahtar ve değer alanları boş olamaz.');
      return;
    }

    const newEntry = {
      id: `static_${Date.now()}`,
      key: newStaticEntry.key.trim(),
      value: newStaticEntry.value.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedStaticData = [...staticData, newEntry];
    setStaticData(updatedStaticData);

    // Statik veri kaynağını güncelle
    const staticDataSource = {
      id: 'static_data',
      name: 'Statik Veriler',
      type: 'static',
      data: updatedStaticData,
      rowCount: updatedStaticData.length
    };

    const updatedDataSources = dataSources.filter(ds => ds.id !== 'static_data');
    updatedDataSources.push(staticDataSource);
    setDataSources(updatedDataSources);
    onDataSourceChange && onDataSourceChange(updatedDataSources);

    setNewStaticEntry({ key: '', value: '' });
    setSuccess('Statik veri başarıyla eklendi.');
    setError('');
  }, [newStaticEntry, staticData, dataSources, onDataSourceChange]);

  // Statik veri silme
  const handleRemoveStaticData = useCallback((id) => {
    const updatedStaticData = staticData.filter(item => item.id !== id);
    setStaticData(updatedStaticData);

    // Veri kaynağını güncelle
    if (updatedStaticData.length > 0) {
      const staticDataSource = {
        id: 'static_data',
        name: 'Statik Veriler',
        type: 'static',
        data: updatedStaticData,
        rowCount: updatedStaticData.length
      };

      const updatedDataSources = dataSources.filter(ds => ds.id !== 'static_data');
      updatedDataSources.push(staticDataSource);
      setDataSources(updatedDataSources);
      onDataSourceChange && onDataSourceChange(updatedDataSources);
    } else {
      const updatedDataSources = dataSources.filter(ds => ds.id !== 'static_data');
      setDataSources(updatedDataSources);
      onDataSourceChange && onDataSourceChange(updatedDataSources);
    }

    setSuccess('Statik veri silindi.');
  }, [staticData, dataSources, onDataSourceChange]);

  // Veri kaynağını silme
  const handleRemoveDataSource = useCallback((id) => {
    const updatedDataSources = dataSources.filter(ds => ds.id !== id);
    setDataSources(updatedDataSources);
    onDataSourceChange && onDataSourceChange(updatedDataSources);

    // Eğer silinen CSV ise, ilgili state'leri temizle
    const removedSource = dataSources.find(ds => ds.id === id);
    if (removedSource && removedSource.type === 'csv') {
      setCsvData(null);
      setCsvHeaders([]);
      setPreviewData([]);
    }

    setSuccess('Veri kaynağı silindi.');
  }, [dataSources, onDataSourceChange]);

  // Dosya seçme butonuna tıklama
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Mesajları temizleme
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="data-source-manager">
      <div className="data-source-header">
        <h2 className="data-source-title">Veri Kaynağı Yöneticisi</h2>
        <p className="data-source-subtitle">
          CSV dosyalarını yükleyin ve statik verilerinizi yönetin
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 CSV Yükleme
        </button>
        <button
          className={`tab-button ${activeTab === 'static' ? 'active' : ''}`}
          onClick={() => setActiveTab('static')}
        >
          📝 Statik Veri
        </button>
        <button
          className={`tab-button ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          📊 Veri Kaynakları
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="status-message status-error">
          ❌ {error}
          <button className="close-message" onClick={clearMessages}>×</button>
        </div>
      )}
      {success && (
        <div className="status-message status-success">
          ✅ {success}
          <button className="close-message" onClick={clearMessages}>×</button>
        </div>
      )}

      <div className="tab-content">
        {/* CSV Upload Tab */}
        {activeTab === 'upload' && (
          <div className="upload-section">
            <div className="upload-area">
              <div className="upload-icon">📄</div>
              <h3>CSV Dosyası Yükle</h3>
              <p>Öğrenci bilgileri, notlar veya diğer verilerinizi içeren CSV dosyasını seçin</p>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              
              <button
                className="upload-button"
                onClick={handleFileButtonClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    📁 Dosya Seç
                  </>
                )}
              </button>
            </div>

            {/* CSV Preview */}
            {previewData.length > 0 && (
              <div className="csv-preview">
                <h4>Veri Önizlemesi ({csvData?.length} satır)</h4>
                <div className="table-container">
                  <table className="preview-table">
                    <thead>
                      <tr>
                        {csvHeaders.map((header, index) => (
                          <th key={index}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index}>
                          {csvHeaders.map((header, colIndex) => (
                            <td key={colIndex}>{row[header]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvData && csvData.length > 10 && (
                  <p className="preview-note">
                    * İlk 10 satır gösteriliyor. Toplam {csvData.length} satır veri var.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Static Data Tab */}
        {activeTab === 'static' && (
          <div className="static-section">
            <div className="static-form">
              <h3>Yeni Statik Veri Ekle</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Anahtar</label>
                  <input
                    type="text"
                    value={newStaticEntry.key}
                    onChange={(e) => setNewStaticEntry({
                      ...newStaticEntry,
                      key: e.target.value
                    })}
                    placeholder="örn: okulAdi, donemBilgisi"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Değer</label>
                  <input
                    type="text"
                    value={newStaticEntry.value}
                    onChange={(e) => setNewStaticEntry({
                      ...newStaticEntry,
                      value: e.target.value
                    })}
                    placeholder="örn: Atatürk Üniversitesi, 2024-Güz"
                    className="form-input"
                  />
                </div>
                <button
                  className="add-button"
                  onClick={handleAddStaticData}
                >
                  ➕ Ekle
                </button>
              </div>
            </div>

            {/* Static Data List */}
            {staticData.length > 0 && (
              <div className="static-list">
                <h4>Mevcut Statik Veriler</h4>
                <div className="static-items">
                  {staticData.map((item) => (
                    <div key={item.id} className="static-item">
                      <div className="static-content">
                        <div className="static-key">{item.key}</div>
                        <div className="static-value">{item.value}</div>
                        <div className="static-date">
                          {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                        </div>
                      </div>
                      <button
                        className="remove-button"
                        onClick={() => handleRemoveStaticData(item.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Sources Tab */}
        {activeTab === 'sources' && (
          <div className="sources-section">
            <h3>Aktif Veri Kaynakları</h3>
            {dataSources.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>Henüz veri kaynağı eklenmemiş</p>
                <p>CSV dosyası yükleyin veya statik veri ekleyin</p>
              </div>
            ) : (
              <div className="sources-list">
                {dataSources.map((source) => (
                  <div key={source.id} className="source-item">
                    <div className="source-header">
                      <div className="source-info">
                        <div className="source-name">
                          {source.type === 'csv' ? '📄' : '📝'} {source.name}
                        </div>
                        <div className="source-meta">
                          <span className="source-type">{source.type.toUpperCase()}</span>
                          <span className="source-count">{source.rowCount} kayıt</span>
                          {source.uploadDate && (
                            <span className="source-date">
                              {new Date(source.uploadDate).toLocaleDateString('tr-TR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="remove-source-button"
                        onClick={() => handleRemoveDataSource(source.id)}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    {source.type === 'csv' && source.headers && (
                      <div className="source-details">
                        <div className="source-headers">
                          <strong>Sütunlar:</strong>
                          <div className="headers-list">
                            {source.headers.map((header, index) => (
                              <span key={index} className="header-tag">
                                {header}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSourceManager;