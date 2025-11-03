import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Edit, Trash2, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';

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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // IPC üzerinden veri çek
      const workflowsData = await window.electronAPI.getWorkflows();
      const statsData = await window.electronAPI.getTodayStats();
      const logsData = await window.electronAPI.getRecentLogs(5);

      setWorkflows(workflowsData);
      setStats(statsData);
      setRecentLogs(logsData);
    } catch (error) {
      console.error('Dashboard verisi yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async (workflowId) => {
    try {
      await window.electronAPI.startWorkflow(workflowId);
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
    if (!confirm('Bu workflow\'u silmek istediğinize emin misiniz?')) return;

    try {
      await window.electronAPI.deleteWorkflow(workflowId);
      loadDashboardData();
    } catch (error) {
      console.error('Workflow silinemedi:', error);
      alert('Workflow silinemedi: ' + error.message);
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

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h2>📊 Dashboard</h2>
        <button className="btn-primary" onClick={handleCreateNew}>
          <Plus size={20} />
          Yeni Workflow
        </button>
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
    </div>
  );
}

export default Dashboard;