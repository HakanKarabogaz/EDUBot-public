import React, { useState, useEffect } from 'react';
import './WorkflowRunner.css';

function WorkflowRunner({ workflow, onClose }) {
    const [dataSources, setDataSources] = useState([]);
    const [selectedDataSource, setSelectedDataSource] = useState(null);
    const [records, setRecords] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isWaitingForUser, setIsWaitingForUser] = useState(false);
    const [waitMessage, setWaitMessage] = useState('');
    const [showBrowserSelection, setShowBrowserSelection] = useState(false);
    const [browserChoices, setBrowserChoices] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        success: 0,
        failed: 0,
        skipped: 0
    });
    const [logs, setLogs] = useState([]);
    const [startTime, setStartTime] = useState(null);

    // Veri kaynaklarını yükle
    useEffect(() => {
        loadDataSources();
    }, []);

    // IPC Event Listeners - Component Mount'ta Kurulum
    useEffect(() => {
        console.log('🔧 Frontend: WorkflowRunner component mount oldu!');
        console.log('🔧 Frontend: electronAPI kontrol:', !!window.electronAPI);
        console.log('🔧 Frontend: electronAPI.on kontrol:', !!window.electronAPI?.on);
        
        if (!window.electronAPI || !window.electronAPI.on) {
            console.error('❌ Frontend: electronAPI mevcut değil!');
            return;
        }
        
        const handleWaitingForUser = (...args) => {
            console.log('🔔 Frontend: workflow-waiting-for-user event yakalandı!');
            console.log('🔔 Frontend: Event args:', args);
            const data = args[0] || {};
            setIsWaitingForUser(true);
            setWaitMessage(data.message || 'Lütfen gerekli işlemi yapın ve devam etmek için tıklayın.');
            addLog('info', `⏸️ Kullanıcı müdahalesi bekleniyor: ${data.stepName || 'N/A'}`);
        };

        const handleWorkflowComplete = (event, data) => {
            console.log('🎉 Workflow tamamlandı:', data);
            setIsRunning(false);
            setIsWaitingForUser(false);
            addLog('success', 'Workflow tamamlandı');
        };

        const handleWorkflowError = (event, data) => {
            console.log('❌ Workflow hatası:', data);
            setIsRunning(false);
            setIsWaitingForUser(false);
            addLog('error', `Hata: ${data.error}`);
        };

        const handleBrowserSelectionRequired = (data) => {
            console.log('🌐 Frontend: Tarayıcı seçimi gerekli event alındı!');
            console.log('🌐 Frontend: data:', data);
            console.log('🌐 Frontend: choices:', data.choices);
            setBrowserChoices(data.choices || []);
            setShowBrowserSelection(true);
            addLog('info', `🌐 Tarayıcı seçimi bekleniyor (${data.choices?.length || 0} seçenek)...`);
        };

        const handleLoginRequired = (data) => {
            console.log('🔐 Frontend: Login gerekli:', data);
            setIsWaitingForUser(true);
            setWaitMessage(data.message || 'Lütfen tarayıcıda login yapın ve devam edin.');
            addLog('warning', '🔐 Login gerekli - manuel işlem bekleniyor');
        };

        // Event listener'ları ekle
        console.log('🔧 Frontend: Event listener eklemeye başlıyor...');
        
        try {
            window.electronAPI.on('workflow-waiting-for-user', handleWaitingForUser);
            console.log('✅ Frontend: workflow-waiting-for-user listener eklendi');
            
            window.electronAPI.on('workflow-complete', handleWorkflowComplete);
            console.log('✅ Frontend: workflow-complete listener eklendi');
            
            window.electronAPI.on('workflow-error', handleWorkflowError);
            console.log('✅ Frontend: workflow-error listener eklendi');
            
            window.electronAPI.on('browser-selection-required', handleBrowserSelectionRequired);
            console.log('✅ Frontend: browser-selection-required listener eklendi');
            
            window.electronAPI.on('login-required', handleLoginRequired);
            console.log('✅ Frontend: login-required listener eklendi');
            
            console.log('✅ Frontend: Tüm event listener\'lar başarıyla eklendi!');
            
            // Test event gönder
            setTimeout(() => {
                console.log('🧪 Frontend: Test event gönderiliyor...');
                handleWaitingForUser({
                    message: 'Test mesajı',
                    stepName: 'Test Step'
                });
            }, 2000);
            
        } catch (error) {
            console.error('❌ Frontend: Event listener ekleme hatası:', error);
        }

        // Cleanup
        return () => {
            window.electronAPI.removeListener('workflow-waiting-for-user', handleWaitingForUser);
            window.electronAPI.removeListener('workflow-complete', handleWorkflowComplete);
            window.electronAPI.removeListener('workflow-error', handleWorkflowError);
        };
    }, []);

    const loadDataSources = async () => {
        try {
            const sources = await window.electronAPI.dataSources.getAll();
            console.log('✅ Data sources loaded:', sources);
            setDataSources(sources || []);
        } catch (error) {
            console.error('Veri kaynakları yüklenemedi:', error);
            setDataSources([]);
        }
    };

    // Veri kaynağı seçildiğinde kayıtları yükle
    const handleDataSourceSelect = async (sourceId) => {
        try {
            const source = dataSources.find(ds => ds.id === parseInt(sourceId));
            setSelectedDataSource(source);
            
            console.log('🔍 Veri kaynağı seçildi:', source);

            const result = await window.electronAPI.dataSources.loadRecords(sourceId);
            console.log('📊 API Response:', result);
            
            // API response formatını kontrol et
            let data = [];
            if (result && typeof result === 'object') {
                if (result.success && result.data) {
                    data = result.data;
                } else if (Array.isArray(result)) {
                    data = result;
                } else if (result.content) {
                    // Content field'ından veriyi al
                    try {
                        data = typeof result.content === 'string' 
                            ? JSON.parse(result.content) 
                            : result.content;
                    } catch (e) {
                        console.warn('Content parse hatası:', e);
                        data = [];
                    }
                }
            }
            
            console.log('✅ İşlenmiş veri:', data);
            setRecords(data);
            setStats(prev => ({ ...prev, total: data.length }));
            addLog('info', `${data.length} kayıt yüklendi`);
        } catch (error) {
            console.error('❌ Veri yükleme hatası:', error);
            addLog('error', 'Kayıtlar yüklenemedi: ' + error.message);
            setRecords([]);
        }
    };

    // Workflow'u başlat
    const handleStart = async () => {
        // Veri kaynağı opsiyonel - yoksa tek sefer çalışır (navigation/click only)
        if (!selectedDataSource && records.length === 0) {
            const confirmNoData = window.confirm(
                'Veri kaynağı seçilmedi. Workflow sadece bir kez çalışacak (tıklama/navigasyon işlemleri için).\n\nDevam etmek istiyor musunuz?'
            );
            if (!confirmNoData) return;
        }

        setIsRunning(true);
        setStartTime(Date.now());
        addLog('info', `Workflow başlatıldı: ${workflow.name}`);
        if (!selectedDataSource) {
            addLog('info', '📦 Veri kaynağı yok - tek sefer çalışma modu');
        }

        try {
            // ✅ YENİ: WorkflowExecutor kullanarak çalıştır
            const result = await window.electronAPI.execution.execute(
                workflow.id, 
                selectedDataSource ? selectedDataSource.id : null, // null gönderilebilir
                {
                    delayBetweenRecords: 1000, // Kayıtlar arası 1 saniye bekle
                    browserOptions: {
                        headless: false, // Browser görünür olsun
                        slowMo: 100      // İşlemleri yavaşlat
                    }
                }
            );

            if (result.success) {
                setStats(prev => ({
                    ...prev,
                    total: result.data.totalRecords,
                    completed: result.data.totalRecords,
                    success: result.data.successCount,
                    failed: result.data.errorCount
                }));
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                addLog('success', `🎉 Workflow tamamlandı! Süre: ${duration} saniye`);
                addLog('info', `📊 Başarılı: ${result.data.successCount} | Başarısız: ${result.data.errorCount}`);
            } else {
                addLog('error', `❌ Workflow başarısız: ${result.message}`);
            }
        } catch (error) {
            addLog('error', `❌ Workflow hatası: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    // Tarayıcıyı debug mode'da başlat
    const handleLaunchBrowser = async (browserType) => {
        try {
            addLog('info', `🚀 ${browserType === 'chrome' ? 'Chrome' : 'Edge'} debug mode'da başlatılıyor...`);
            const result = await window.electronAPI.invoke('browser:launch-debug', browserType);
            
            if (result.success) {
                addLog('success', `✅ Tarayıcı başlatıldı! Şimdi login olun ve workflow'u başlatın.`);
            } else {
                addLog('error', `❌ Tarayıcı başlatma hatası: ${result.message}`);
            }
        } catch (error) {
            console.error('Tarayıcı başlatma hatası:', error);
            addLog('error', `❌ Tarayıcı başlatma hatası: ${error.message}`);
        }
    };

    // Tarayıcı seçimi
    const handleBrowserSelect = async (choice) => {
        console.log('🌐 Frontend: Tarayıcı seçildi:', choice);
        try {
            const result = await window.electronAPI.execution.selectBrowser(choice);
            if (result.success) {
                setShowBrowserSelection(false);
                addLog('success', `✅ ${choice.label} seçildi`);
            } else {
                addLog('error', 'Tarayıcı seçimi hatası: ' + result.message);
            }
        } catch (error) {
            console.error('🚨 Frontend: Tarayıcı seçimi hatası:', error);
            addLog('error', 'Tarayıcı seçimi hatası: ' + error.message);
        }
    };

    // Kullanıcı devam etsin
    const handleContinue = async () => {
        console.log('🎯 FRONTEND: handleContinue çağrıldı!');
        console.log('🎯 FRONTEND: electronAPI check:', !!window.electronAPI);
        console.log('🎯 FRONTEND: workflow API check:', !!window.electronAPI?.workflow);
        console.log('🎯 FRONTEND: continue API check:', !!window.electronAPI?.workflow?.continue);
        
        try {
            addLog('info', '🎯 Continue butonu tıklandı, IPC gönderiliyor...');
            const result = await window.electronAPI.workflow.continue();
            console.log('🎯 FRONTEND: IPC sonucu:', result);
            
            if (result.success) {
                setIsWaitingForUser(false);
                setWaitMessage('');
                addLog('info', '✅ Devam ediliyor...');
            } else {
                addLog('error', 'Devam etme hatası: ' + result.error);
            }
        } catch (error) {
            console.error('🚨 FRONTEND: Continue hatası:', error);
            addLog('error', 'Devam etme hatası: ' + error.message);
        }
    };

    // Kuyruğu işle
    const processQueue = async () => {
        for (let i = currentIndex; i < records.length; i++) {
            if (!isRunning || isPaused) break;

            setCurrentIndex(i);
            const record = records[i];

            addLog('info', `İşleniyor: Kayıt ${i + 1}/${records.length}`);

            try {
                const result = await window.api.executeWorkflow(workflow.id, record);

                if (result.success) {
                    setStats(prev => ({
                        ...prev,
                        completed: prev.completed + 1,
                        success: prev.success + 1
                    }));
                    addLog('success', `✅ Başarılı: ${JSON.stringify(record).substring(0, 50)}...`);
                } else {
                    setStats(prev => ({
                        ...prev,
                        completed: prev.completed + 1,
                        failed: prev.failed + 1
                    }));
                    addLog('error', `❌ Hata: ${result.error}`);
                }
            } catch (error) {
                setStats(prev => ({
                    ...prev,
                    completed: prev.completed + 1,
                    failed: prev.failed + 1
                }));
                addLog('error', `❌ İşlem hatası: ${error.message}`);
            }

            // Kısa bekleme (UI güncellemesi için)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (currentIndex >= records.length - 1) {
            handleComplete();
        }
    };

    // Tamamlandı
    const handleComplete = () => {
        setIsRunning(false);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        addLog('info', `🎉 Workflow tamamlandı! Süre: ${duration} saniye`);
        addLog('info', `📊 Başarılı: ${stats.success} | Başarısız: ${stats.failed}`);
    };

    // Duraklat
    const handlePause = async () => {
        try {
            const result = await window.electronAPI.execution.pause();
            if (result.success) {
                setIsPaused(true);
                addLog('warning', '⏸️ Workflow duraklatıldı');
            }
        } catch (error) {
            addLog('error', `❌ Duraklat hatası: ${error.message}`);
        }
    };

    // Devam et
    const handleResume = async () => {
        try {
            const result = await window.electronAPI.execution.resume();
            if (result.success) {
                setIsPaused(false);
                addLog('info', '▶️ Workflow devam ediyor');
            }
        } catch (error) {
            addLog('error', `❌ Devam ettirme hatası: ${error.message}`);
        }
    };

    // Durdur
    const handleStop = async () => {
        try {
            const result = await window.electronAPI.workflow.stop();
            if (result.success) {
                setIsRunning(false);
                setIsPaused(false);
                setIsWaitingForUser(false);
                setWaitMessage('');
                addLog('warning', '🛑 Workflow durduruldu');
            }
        } catch (error) {
            addLog('error', `❌ Durdurma hatası: ${error.message}`);
        }
    };

    // Log ekle
    const addLog = (type, message) => {
        const timestamp = new Date().toLocaleTimeString('tr-TR');
        setLogs(prev => [...prev, { type, message, timestamp }]);
    };

    // Progress yüzdesi
    const progressPercent = stats.total > 0
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;

    return (
        <div className="workflow-runner">
            <div className="runner-header">
                <h2>🏃 {workflow.name}</h2>
                <button onClick={onClose} className="close-btn">✖️</button>
            </div>

            {/* Tarayıcı Seçim Modalı */}
            {showBrowserSelection && (
                <div className="browser-selection-modal">
                    <div className="modal-content">
                        <h3>🌐 Tarayıcı Seçin</h3>
                        <p className="help-text">
                            Açık olan ve login olduğunuz tarayıcıyı seçerseniz, yeniden login yapmanıza gerek kalmaz.
                        </p>
                        <div className="browser-choices">
                            {browserChoices.map((choice) => (
                                <button
                                    key={choice.id}
                                    onClick={() => handleBrowserSelect(choice)}
                                    className="browser-choice-btn"
                                >
                                    <span className="browser-icon">{choice.label.split(' ')[0]}</span>
                                    <span className="browser-name">{choice.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Veri Kaynağı Seçimi */}
            {!isRunning && (
                <div className="data-source-section">
                    <div className="browser-launch-section">
                        <h3>🌐 Tarayıcı Hazırlığı</h3>
                        <p className="help-text">
                            💡 Önce tarayıcınızı debug mode'da başlatın ve login olun. 
                            Böylece her workflow'da yeniden login yapmanıza gerek kalmaz.
                        </p>
                        <div className="browser-launch-buttons">
                            <button 
                                onClick={() => handleLaunchBrowser('chrome')} 
                                className="launch-browser-btn chrome-btn"
                            >
                                🌐 Chrome ile Başlat
                            </button>
                            <button 
                                onClick={() => handleLaunchBrowser('edge')} 
                                className="launch-browser-btn edge-btn"
                            >
                                🔷 Edge ile Başlat
                            </button>
                        </div>
                    </div>

                    <h3>📊 Veri Kaynağı Seçin (Opsiyonel)</h3>
                    <p className="help-text">
                        💡 Veri girişi yapacaksanız veri kaynağı seçin. 
                        Sadece tıklama/navigasyon için seçmeden başlatabilirsiniz.
                    </p>
                    <select
                        onChange={(e) => handleDataSourceSelect(e.target.value)}
                        className="data-source-select"
                    >
                        <option value="">-- Veri kaynağı yok (tek sefer çalışma) --</option>
                        {dataSources.map(ds => (
                            <option key={ds.id} value={ds.id}>
                                {ds.name} ({ds.data_type})
                            </option>
                        ))}
                    </select>

                    {records.length > 0 && (
                        <div className="records-preview">
                            <p>✅ {records.length} kayıt yüklendi</p>
                        </div>
                    )}
                    
                    <div className="records-preview">
                        <button onClick={handleStart} className="start-btn">
                            ▶️ Başlat
                        </button>
                    </div>
                </div>
            )}

            {/* Waiting for User Section */}
            {isWaitingForUser && (
                <div className="waiting-for-user-section">
                    <div className="waiting-message">
                        <h3>⏸️ Kullanıcı Müdahalesi Gerekiyor</h3>
                        <p>{waitMessage}</p>
                        <button onClick={handleContinue} className="continue-btn">
                            ✅ Devam Et
                        </button>
                    </div>
                </div>
            )}

            {/* Progress Section */}
            {isRunning && (
                <div className="progress-section">
                    <div className="progress-bar-container">
                        <div
                            className="progress-bar"
                            style={{ width: `${progressPercent}%` }}
                        >
                            {progressPercent}%
                        </div>
                    </div>

                    <div className="progress-stats">
                        <div className="stat">
                            <span className="stat-label">Toplam:</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">İşlenen:</span>
                            <span className="stat-value">{stats.completed}</span>
                        </div>
                        <div className="stat success">
                            <span className="stat-label">✅ Başarılı:</span>
                            <span className="stat-value">{stats.success}</span>
                        </div>
                        <div className="stat failed">
                            <span className="stat-label">❌ Başarısız:</span>
                            <span className="stat-value">{stats.failed}</span>
                        </div>
                    </div>

                    {/* Kontrol Butonları */}
                    <div className="control-buttons">
                        {!isPaused ? (
                            <button onClick={handlePause} className="pause-btn">
                                ⏸️ Duraklat
                            </button>
                        ) : (
                            <button onClick={handleResume} className="resume-btn">
                                ▶️ Devam Et
                            </button>
                        )}
                        <button onClick={handleStop} className="stop-btn">
                            ⏹️ Durdur
                        </button>
                    </div>
                </div>
            )}

            {/* Real-time Logs */}
            <div className="logs-section">
                <h3>📝 Loglar</h3>
                <div className="logs-container">
                    {logs.map((log, index) => (
                        <div key={index} className={`log-entry log-${log.type}`}>
                            <span className="log-time">{log.timestamp}</span>
                            <span className="log-message">{log.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default WorkflowRunner;

