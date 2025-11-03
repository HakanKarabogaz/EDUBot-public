import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Workflow, 
  Database, 
  FileText, 
  Settings, 
  HelpCircle 
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import WorkflowDesigner from './components/WorkflowDesigner';
import DataSourceManager from './components/DataSourceManager';
import LogViewer from './components/LogViewer';
import HybridImportManager from './components/HybridImportManager';
import HybridWorkflowCreator from './components/HybridWorkflowCreator';
import DatabaseDebugger from './components/DatabaseDebugger';

function App() {
  console.log('🚀 App component rendering...');
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);

  // ✅ Electron API bağlantısını kontrol et
  useEffect(() => {
    const checkAPI = async () => {
      console.log('🔧 Checking Electron API...');
      console.log('🔧 Window type:', typeof window);
      console.log('🔧 Window keys:', window ? Object.keys(window).filter(k => k.includes('electron') || k.includes('api')) : 'N/A');
      console.log('🔧 Window.electronAPI:', window ? window.electronAPI : 'N/A');
      
      // Temel kontrolü yap
      if (typeof window === 'undefined' || !window.electronAPI) {
        console.error('❌ Electron API not found on window object');
        console.error('🔧 Available window properties:', window ? Object.getOwnPropertyNames(window).slice(0, 10) : 'N/A');
        setApiConnected(false);
        return;
      }

      // API fonksiyonlarının varlığını kontrol et
      if (!window.electronAPI.dataSources || !window.electronAPI.dataSources.getAll) {
        console.error('❌ Electron API methods not found');
        setApiConnected(false);
        return;
      }

      try {
        // API'nin çalışıp çalışmadığını test et
        console.log('🧪 Testing API call...');
        const result = await window.electronAPI.dataSources.getAll();
        console.log('✅ API test successful:', result);
        setApiConnected(true);
      } catch (error) {
        console.error('❌ API test failed:', error);
        setApiConnected(false);
      }
    };

    // Biraz gecikme ile kontrol et - preload'ın yüklenmesi için
    setTimeout(checkAPI, 100);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentView} onSelectWorkflow={setSelectedWorkflow} />;
      case 'workflow-designer':
        return <WorkflowDesigner workflowId={selectedWorkflow?.id} onBack={() => setCurrentView('dashboard')} />;
      case 'data-sources':
        return <DataSourceManager onBack={() => setCurrentView('dashboard')} />;
      case 'hybrid-system':
        return <HybridImportManager onBack={() => setCurrentView('dashboard')} />;
      case 'hybrid-workflow':
        return <HybridWorkflowCreator onBack={() => setCurrentView('dashboard')} />;
      case 'logs':
        return <LogViewer onBack={() => setCurrentView('dashboard')} />;
      case 'database-debug':
        return <DatabaseDebugger />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  console.log('🎨 App rendering with currentView:', currentView);
  
  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🤖 EduBot</h1>
          <p className="version">v0.1.0</p>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <Home size={20} />
            <span>Ana Sayfa</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'workflow-designer' ? 'active' : ''}`}
            onClick={() => {
              setSelectedWorkflow(null);
              setCurrentView('workflow-designer');
            }}
          >
            <Workflow size={20} />
            <span>Workflow Tasarımcı</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'data-sources' ? 'active' : ''}`}
            onClick={() => setCurrentView('data-sources')}
          >
            <Database size={20} />
            <span>Veri Kaynakları</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'hybrid-system' ? 'active' : ''}`}
            onClick={() => setCurrentView('hybrid-system')}
          >
            <Settings size={20} />
            <span>🔗 Hybrid Import</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'hybrid-workflow' ? 'active' : ''}`}
            onClick={() => setCurrentView('hybrid-workflow')}
          >
            <Workflow size={20} />
            <span>🎯 Hybrid Workflow</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'logs' ? 'active' : ''}`}
            onClick={() => setCurrentView('logs')}
          >
            <FileText size={20} />
            <span>Loglar</span>
          </button>

          <button 
            className={`nav-item ${currentView === 'database-debug' ? 'active' : ''}`}
            onClick={() => setCurrentView('database-debug')}
          >
            <Database size={20} />
            <span>🔍 DB Debug</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item">
            <Settings size={20} />
            <span>Ayarlar</span>
          </button>
          <button className="nav-item">
            <HelpCircle size={20} />
            <span>Yardım</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {!apiConnected ? (
          <div className="error-message">
            <h2>⚠️ Hata</h2>
            <p>Electron API bağlantısı kurulamadı.</p>
            <p>Lütfen uygulamayı yeniden başlatın.</p>
            <button onClick={() => window.location.reload()}>
              🔄 Yenile
            </button>
          </div>
        ) : (
          renderView()
        )}
      </main>
    </div>
  );
}

export default App;