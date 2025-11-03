import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Edit, Trash2, TrendingUp, CheckCircle, XCircle, Clock, Copy } from 'lucide-react';
import WorkflowRunner from './WorkflowRunner'; // ✅ Import eklendi

function Dashboard({ onNavigate, onSelectWorkflow }) {
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState({
    todayTotal: 0,
    todaySuccess: 0,
    todayFailed: 0,
    avgTime: 0
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); // ✅ Eksik olan state
  const [selectedWorkflow, setSelectedWorkflow] = useState(null); //05102025 1830 da eklendi
  
  // 🆕 Workflow kopyalama için modal state'leri
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [workflowToDuplicate, setWorkflowToDuplicate] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // electronAPI kontrolü
      if (!window.electronAPI) {
        console.error('electronAPI tanımlı değil. Preload script yüklenmemiş olabilir.');
        setError('Electron API bağlantısı kurulamadı.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      // IPC üzerinden veri çek
      const workflowsData = await window.electronAPI.invoke('db:getWorkflows');
      const statsData = await window.electronAPI.invoke('db:getTodayStats');
      const logsData = await window.electronAPI.invoke('db:getRecentLogs', 5);

      setWorkflows(workflowsData || []);
      setStats(statsData || {
        todayTotal: 0,
        todaySuccess: 0,
        todayFailed: 0,
        avgTime: 0
      });
      setRecentLogs(logsData || []);
    } catch (error) {
      console.error('Dashboard verisi yüklenemedi:', error);
      setError('Veriler yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async (workflowId) => {
    try {
      await window.electronAPI.invoke('workflow:start', workflowId);
      loadDashboardData(); // Refresh
    } catch (error) {
      console.error('Workflow başlatılamadı:', error);
      alert('Workflow başlatılamadı: ' + error.message);
    }
  };

  const handleEditWorkflow = (workflow) => {
    onSelectWorkflow(workflow);
    onNavigate('workflow-designer');
  };

  const handleDeleteWorkflow = async (workflowId) => {
    try {
      const stats = await window.electronAPI.invoke('db:getQueueStats', workflowId);
      if (stats && (stats.pending > 0 || stats.processing > 0)) {
        if (!confirm(`Bu workflow için ${stats.pending} bekleyen ve ${stats.processing} işlemde kayıt var. Silmek istiyor musunuz?`)) return;
      } else {
        if (!confirm('Bu workflow\'u silmek istediğinize emin misiniz?')) return;
      }
    } catch (e) {
      console.warn('Kuyruk istatistikleri alınamadı, silme işlemi devam edecek');
      if (!confirm('Bu workflow\'u silmek istediğinize emin misiniz?')) return;
    }

    try {
      await window.electronAPI.invoke('db:deleteWorkflow', workflowId);
      loadDashboardData();
    } catch (error) {
      console.error('Workflow silinemedi:', error);
      // Show more descriptive message when FK constraints or active queues prevent deletion
      const friendly = error && error.message ? error.message : 'Bilinmeyen bir hata oluştu.';
      alert('Workflow silinemedi: ' + friendly);
    }
  };

  // 🆕 Workflow kopyalama - modal'ı aç
  const openDuplicateModal = (workflow) => {
    setWorkflowToDuplicate(workflow);
    const currentDate = new Date().toLocaleDateString('tr-TR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    setNewWorkflowName(`${workflow.name} (Kopya - ${currentDate})`);
    setShowDuplicateModal(true);
  };

  // 🆕 Workflow kopyalama handler'ı (modal'dan çağrılır)
  const handleDuplicateWorkflow = async () => {
    try {
      // Boş isim kontrolü
      if (!newWorkflowName || newWorkflowName.trim().length === 0) {
        alert('❌ Workflow adı boş olamaz!');
        return;
      }

      if (newWorkflowName.trim().length < 3) {
        alert('❌ Workflow adı en az 3 karakter olmalıdır!');
        return;
      }

      console.log(`🔧 Workflow kopyalanıyor: "${workflowToDuplicate.name}" -> "${newWorkflowName}"`);
      setLoading(true);

      // IPC üzerinden kopyalama isteği gönder
      const result = await window.electronAPI.workflows.duplicate(workflowToDuplicate.id, newWorkflowName.trim());

      if (result.success) {
        console.log(`✅ Workflow başarıyla kopyalandı - Yeni ID: ${result.workflowId}`);
        
        // Modal'ı kapat ve state'i temizle
        setShowDuplicateModal(false);
        setWorkflowToDuplicate(null);
        setNewWorkflowName('');
        
        // Dashboard verilerini yenile
        await loadDashboardData();
        
        alert(`✅ ${result.message}`);
      } else {
        console.error('❌ Workflow kopyalama başarısız:', result.error);
        alert(`❌ Kopyalama başarısız: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ Workflow kopyalama hatası:', error);
      alert(`❌ Workflow kopyalanamadı: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    onSelectWorkflow(null);
    onNavigate('workflow-designer');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  // Hata mesajı göster
  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h3>⚠️ Hata</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadDashboardData}>
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }
  // Dashboard'ın sonunda: 05102025 1831 de eklendi ✅ WorkflowRunner modal
  if (selectedWorkflow){
    return(
      <WorkflowRunner 
          workflow={selectedWorkflow} 
          onClose={() => setSelectedWorkflow(null)} 
      />
    );
  }

  const handleResetWorkflow3 = async () => {
    if (!confirm('Workflow 3\'ün tüm step\'leri silinip temiz hali oluşturulacak. Devam etmek istiyor musunuz?')) {
      return;
    }
    
    try {
      setLoading(true);
      const result = await window.electronAPI.debug.resetWorkflow3();
      
      if (result.success) {
        alert(`✅ Başarılı! ${result.deletedSteps} step silindi, ${result.createdSteps} yeni step oluşturuldu.`);
        await loadDashboardData(); // Refresh data
      } else {
        alert(`❌ Hata: ${result.error}`);
      }
    } catch (error) {
      console.error('Reset workflow 3 failed:', error);
      alert(`❌ Reset başarısız: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h2>📊 Dashboard</h2>
        <div>
          <button className="btn-primary" onClick={handleCreateNew}>
            <Plus size={20} />
            Yeni Workflow
          </button>
          <button className="btn-danger" onClick={handleResetWorkflow3} style={{marginLeft: '10px', backgroundColor: '#dc3545'}}>
            🧹 Reset Workflow 3
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Workflows Section */}
        <section className="workflows-section">
          <div className="section-header">
            <h3>📋 Workflows</h3>
          </div>

          <div className="workflows-list">
            {workflows.length === 0 ? (
              <div className="empty-state">
                <p>Henüz workflow oluşturulmamış</p>
                <button className="btn-secondary" onClick={handleCreateNew}>
                  <Plus size={18} />
                  İlk Workflow'u Oluştur
                </button>
              </div>
            ) : (
              workflows.map(workflow => (
                <div key={workflow.id} className="workflow-card">
                  <div className="workflow-info">
                    <h4>{workflow.name}</h4>
                    <p className="workflow-meta">
                      <span className="badge">{workflow.mode}</span>
                      <span className="timeout">⏱️ {workflow.timeout / 1000}s</span>
                    </p>
                  </div>

                  <div className="workflow-actions">
                    {/*Workflow kartında: 05102025 1825 te eklendi*/}
                    <button 
                      className="btn-icon btn-primary"
                      onClick={() => setSelectedWorkflow(workflow)}
                      title="Çalıştır"
                    >
                      <Play size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-success" 
                      onClick={() => handleStartWorkflow(workflow.id)}
                      title="Başlat"
                    >
                      <Play size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-secondary" 
                      onClick={() => handleEditWorkflow(workflow)}
                      title="Düzenle"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-info" 
                      onClick={() => openDuplicateModal(workflow)}
                      title="Kopyala"
                      style={{ backgroundColor: '#17a2b8', color: 'white' }}
                    >
                      <Copy size={18} />
                    </button>
                    <button 
                      className="btn-icon btn-danger" 
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      title="Sil"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Stats Section */}
        <section className="stats-section">
          <div className="section-header">
            <h3>📈 Bugünün İstatistikleri</h3>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon total">
                <TrendingUp size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Toplam İşlem</p>
                <p className="stat-value">{stats.todayTotal}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon success">
                <CheckCircle size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Başarılı</p>
                <p className="stat-value">{stats.todaySuccess}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon failed">
                <XCircle size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Başarısız</p>
                <p className="stat-value">{stats.todayFailed}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon time">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Ort. Süre</p>
                <p className="stat-value">{stats.avgTime}s</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Logs Section */}
        <section className="logs-section">
          <div className="section-header">
            <h3>📝 Son Loglar</h3>
            <button className="btn-link" onClick={() => onNavigate('logs')}>
              Tümünü Gör →
            </button>
          </div>

          <div className="logs-list">
            {recentLogs.length === 0 ? (
              <p className="empty-message">Henüz log kaydı yok</p>
            ) : (
              recentLogs.map(log => (
                <div key={log.id} className={`log-item ${log.status}`}>
                  <span className="log-time">{new Date(log.created_at).toLocaleTimeString('tr-TR')}</span>
                  <span className="log-message">{log.message}</span>
                  <span className={`log-status ${log.status}`}>
                    {log.status === 'success' ? '✅' : '❌'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* 🆕 Workflow Kopyalama Modal Dialog */}
      {showDuplicateModal && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Workflow Kopyala</h3>
              <button 
                className="modal-close"
                onClick={() => setShowDuplicateModal(false)}
                title="Kapat"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <p className="modal-info">
                <strong>Kaynak:</strong> {workflowToDuplicate?.name}
              </p>
              
              <label className="modal-label">
                Yeni Workflow Adı:
                <input
                  type="text"
                  className="modal-input"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="Workflow adı girin..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleDuplicateWorkflow();
                    }
                  }}
                />
              </label>
              
              <p className="modal-hint">
                💡 Tüm workflow adımları kopyalanacaktır.
              </p>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowDuplicateModal(false)}
              >
                İptal
              </button>
              <button 
                className="btn-primary"
                onClick={handleDuplicateWorkflow}
                disabled={!newWorkflowName.trim() || newWorkflowName.trim().length < 3}
              >
                Kopyala
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;