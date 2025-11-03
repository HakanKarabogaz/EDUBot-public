const LogViewer = ({ isVisible, onClose, workflowId }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isRealTime, setIsRealTime] = useState(false);
  const logContainerRef = useRef(null);

  // Log seviyeleri ve renkleri
  const logLevels = {
    info: { label: 'Bilgi', color: '#17a2b8', icon: 'ℹ️' },
    success: { label: 'Başarılı', color: '#28a745', icon: '✅' },
    warning: { label: 'Uyarı', color: '#ffc107', icon: '⚠️' },
    error: { label: 'Hata', color: '#dc3545', icon: '❌' },
    debug: { label: 'Debug', color: '#6c757d', icon: '🔧' }
  };

  // Örnek log verileri
  useEffect(() => {
    if (isVisible) {
      const sampleLogs = [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Workflow başlatıldı',
          details: 'Workflow ID: ' + workflowId,
          stepId: null
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 1000).toISOString(),
          level: 'info',
          message: 'Element aranıyor: #username',
          details: 'CSS Selector kullanılıyor',
          stepId: 1
        },
        {
          id: 3,
          timestamp: new Date(Date.now() - 2000).toISOString(),
          level: 'success',
          message: 'Element bulundu ve tıklandı',
          details: 'Element: input[name="username"]',
          stepId: 1
        },
        {
          id: 4,
          timestamp: new Date(Date.now() - 3000).toISOString(),
          level: 'info',
          message: 'Veri girişi yapılıyor',
          details: 'Değer: "test_user"',
          stepId: 2
        },
        {
          id: 5,
          timestamp: new Date(Date.now() - 4000).toISOString(),
          level: 'warning',
          message: 'Element yavaş yükleniyor',
          details: 'Bekleme süresi: 3 saniye',
          stepId: 3
        },
        {
          id: 6,
          timestamp: new Date(Date.now() - 5000).toISOString(),
          level: 'error',
          message: 'Element bulunamadı',
          details: 'Selector: #submit-button, Timeout: 10s',
          stepId: 4
        }
      ];
      setLogs(sampleLogs);
    }
  }, [isVisible, workflowId]);

  // Otomatik kaydırma
  useEffect(() => {
    if (isAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isAutoScroll]);

  // Real-time log simülasyonu
  useEffect(() => {
    let interval;
    if (isRealTime && isVisible) {
      interval = setInterval(() => {
        const newLog = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          level: ['info', 'success', 'warning'][Math.floor(Math.random() * 3)],
          message: 'Yeni log mesajı',
          details: 'Real-time log güncellemesi',
          stepId: Math.floor(Math.random() * 5) + 1
        };
        setLogs(prev => [...prev, newLog]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isRealTime, isVisible]);

  // Log filtreleme
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = searchTerm === '' || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Zaman formatı
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  // Log temizleme
  const clearLogs = () => {
    setLogs([]);
  };

  // Log export
  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${formatTime(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message} - ${log.details}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-logs-${workflowId}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isVisible) return null;

  return (
    <div className="log-viewer-overlay">
      <div className="log-viewer-modal">
        <div className="log-viewer-header">
          <h2 className="log-viewer-title">
            📊 Workflow Logları
            {workflowId && <span className="workflow-id">#{workflowId}</span>}
          </h2>
          <button className="log-viewer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="log-viewer-controls">
          <div className="log-controls-left">
            <div className="filter-group">
              <label className="control-label">Filtre:</label>
              <select 
                className="log-filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Tümü</option>
                {Object.entries(logLevels).map(([key, level]) => (
                  <option key={key} value={key}>{level.label}</option>
                ))}
              </select>
            </div>

            <div className="search-group">
              <label className="control-label">Ara:</label>
              <input
                type="text"
                className="log-search-input"
                placeholder="Log içeriğinde ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="log-controls-right">
            <div className="toggle-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={isAutoScroll}
                  onChange={(e) => setIsAutoScroll(e.target.checked)}
                />
                Otomatik Kaydır
              </label>
            </div>

            <div className="toggle-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={isRealTime}
                  onChange={(e) => setIsRealTime(e.target.checked)}
                />
                Canlı Güncelleme
              </label>
            </div>

            <button className="log-action-btn clear-btn" onClick={clearLogs}>
              🗑️ Temizle
            </button>

            <button className="log-action-btn export-btn" onClick={exportLogs}>
              📥 Export
            </button>
          </div>
        </div>

        <div className="log-stats">
          <div className="stat-item">
            <span className="stat-label">Toplam:</span>
            <span className="stat-value">{logs.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Filtrelenmiş:</span>
            <span className="stat-value">{filteredLogs.length}</span>
          </div>
          {Object.entries(logLevels).map(([key, level]) => {
            const count = logs.filter(log => log.level === key).length;
            return count > 0 ? (
              <div key={key} className="stat-item">
                <span className="stat-label" style={{ color: level.color }}>
                  {level.icon} {level.label}:
                </span>
                <span className="stat-value">{count}</span>
              </div>
            ) : null;
          })}
        </div>

        <div className="log-container" ref={logContainerRef}>
          {filteredLogs.length === 0 ? (
            <div className="no-logs">
              {logs.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <h3>Henüz log bulunmuyor</h3>
                  <p>Workflow çalıştırıldığında loglar burada görünecek</p>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <h3>Filtre kriterlerine uygun log bulunamadı</h3>
                  <p>Farklı filtre seçeneklerini deneyin</p>
                </div>
              )}
            </div>
          ) : (
            <div className="log-list">
              {filteredLogs.map((log) => (
                <div key={log.id} className={`log-entry log-${log.level}`}>
                  <div className="log-header">
                    <div className="log-level">
                      <span className="log-icon">{logLevels[log.level].icon}</span>
                      <span className="log-level-text">{logLevels[log.level].label}</span>
                    </div>
                    <div className="log-timestamp">{formatTime(log.timestamp)}</div>
                    {log.stepId && (
                      <div className="log-step">Adım #{log.stepId}</div>
                    )}
                  </div>
                  <div className="log-message">{log.message}</div>
                  {log.details && (
                    <div className="log-details">{log.details}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="log-viewer-footer">
          <div className="footer-info">
            Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}
          </div>
          <div className="footer-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogViewer;