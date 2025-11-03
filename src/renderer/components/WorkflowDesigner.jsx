// src/renderer/components/WorkflowDesigner.jsx
import React, { useState, useEffect } from 'react';
import './WorkflowDesigner.css';

const WorkflowDesigner = ({ workflowId, onSave, onCancel, onBack }) => {
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    target_url: '',
    timeout: 60000,
    screen_id: '',
    is_active: true
  });
  const [screens, setScreens] = useState([]);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScreens();
    if (workflowId) {
      loadWorkflow();
      loadSteps();
    }
  }, [workflowId]);

  const loadScreens = async () => {
    try {
      const result = await window.electronAPI.screens.getAll();
      setScreens(result);
    } catch (error) {
      console.error('Ekranlar yüklenemedi:', error);
    }
  };

  const loadWorkflow = async () => {
    try {
      console.log('🔍 Loading workflow with ID:', workflowId);
      const result = await window.electronAPI.workflows.get(workflowId);
      console.log('📋 Loaded workflow:', result);
      if (result) {
        setWorkflow(result);
      }
    } catch (error) {
      console.error('Workflow yüklenemedi:', error);
    }
  };

  const loadSteps = async () => {
    try {
      const result = await window.electronAPI.steps.getAll(workflowId);
      setSteps(result);
    } catch (error) {
      console.error('Adımlar yüklenemedi:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      console.log('💾 Saving workflow - ID:', workflowId, 'Data:', workflow);
      let savedWorkflowId = workflowId;
      
      if (workflowId) {
        await window.electronAPI.workflows.update(workflowId, workflow);
      } else {
        // Yeni workflow oluşturma henüz workflows.create ile uyumlu değil, invoke kullan
        savedWorkflowId = await window.electronAPI.invoke('db:createWorkflow', workflow);
      }

      // 🔄 DELETE-THEN-RECREATE: Duplicate'leri önlemek için tüm step'leri temizle ve yeniden oluştur
      if (savedWorkflowId) {
        console.log('🧹 Delete-then-recreate için workflow ID:', savedWorkflowId);
        
        // 1. Tüm mevcut step'leri tek seferde sil
        const deletedCount = await window.electronAPI.debug.deleteStepsByWorkflow(savedWorkflowId);
        console.log('✅ Silinen step sayısı:', deletedCount);
        
        // 2. Yeni step'leri sırayla oluştur
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          // Build payload: for execute_script use config JSON, otherwise use value
          const newStep = {
            workflow_id: savedWorkflowId,
            step_order: i + 1,
            action_type: step.action_type,
            description: step.description || '',
            selector: step.selector || '',
            wait_after: step.wait_after || 500,
            is_optional: step.is_optional || false
          };

          if (step.action_type === 'execute_script') {
            // Ensure script and storeAs fields exist on the step object (renderer may have set them)
            newStep.config = JSON.stringify({ script: step.script || step.value || '', storeAs: step.storeAs || '' });
          } else {
            newStep.value = step.value || '';
          }

          console.log('➕ Yeni step oluşturuluyor:', { order: i + 1, action: step.action_type, value: newStep.value, hasScript: !!newStep.config });
          const newStepId = await window.electronAPI.invoke('db:createStep', newStep);
          console.log('✅ Step oluşturuldu ID:', newStepId);
        }
        
        console.log('🎉 Workflow kayıt tamamlandı - toplam step:', steps.length);
      }

      onSave && onSave(savedWorkflowId);
    } catch (error) {
      console.error('Kaydetme hatası:', error);
      alert('Workflow kaydedilemedi!');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setSteps([...steps, {
      step_order: steps.length + 1,
      action_type: 'click',
      description: '',
      selector: '',
      value: '',  // Always initialize as empty string
      script: '',
      storeAs: '',
      wait_after: 500,
      is_optional: false
    }]);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const deleteStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index);
    // Sıraları yeniden düzenle
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    setSteps(newSteps);
  };

  const moveStep = (index, direction) => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    
    // Sıraları güncelle
    newSteps.forEach((step, i) => {
      step.step_order = i + 1;
    });
    
    setSteps(newSteps);
  };

  return (
    <div className="workflow-designer">
      <div className="designer-header">
        <h2>{workflowId ? 'Workflow Düzenle' : 'Yeni Workflow'}</h2>
      </div>

      <div className="designer-content">
        <div className="workflow-info">
          <div className="form-group">
            <label>Workflow Adı:</label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              placeholder="Örn: Öğrenci Kayıt İşlemi"
            />
          </div>

          <div className="form-group">
            <label>Açıklama:</label>
            <textarea
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              placeholder="Workflow açıklaması..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Target URL:</label>
            <input
              type="url"
              value={workflow.target_url}
              onChange={(e) => setWorkflow({ ...workflow, target_url: e.target.value })}
              placeholder="https://obs.tarsus.edu.tr/OBS_Ogrenciler/Goruntule"
            />
          </div>

          <div className="form-group">
            <label>Timeout (ms):</label>
            <input
              type="number"
              value={workflow.timeout}
              onChange={(e) => setWorkflow({ ...workflow, timeout: parseInt(e.target.value) })}
              min="5000"
              max="300000"
              step="1000"
            />
          </div>

          <div className="form-group">
            <label>Ekran:</label>
            <select
              value={workflow.screen_id || ""}
              onChange={(e) => setWorkflow({ ...workflow, screen_id: e.target.value })}
            >
              <option value="">Ekran Seçin</option>
              {screens.map(screen => (
                <option key={screen.id} value={screen.id}>
                  {screen.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={workflow.is_active}
                onChange={(e) => setWorkflow({ ...workflow, is_active: e.target.checked })}
              />
              Aktif
            </label>
          </div>
        </div>

        <div className="steps-section">
          <div className="steps-header">
            <h3>Adımlar</h3>
            <button onClick={addStep} className="btn-add">+ Adım Ekle</button>
          </div>

          <div className="steps-list">
            {steps.map((step, index) => (
              <div key={index} className="step-item">
                <div className="step-order">#{step.step_order}</div>
                
                <div className="step-fields">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Açıklama:</label>
                      <input
                        type="text"
                        value={step.description || ''}
                        onChange={(e) => updateStep(index, 'description', e.target.value)}
                        placeholder="Bu adımın açıklaması..."
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Aksiyon:</label>
                      <select
                        value={step.action_type}
                        onChange={(e) => updateStep(index, 'action_type', e.target.value)}
                      >
                        <option value="navigate">Git (Navigate)</option>
                        <option value="click">Tıkla</option>
                        <option value="type">Yaz</option>
                        <option value="select">Seç</option>
                        <option value="wait">Bekle</option>
                        <option value="wait_for_element">Element Bekle</option>
                        <option value="execute_script">Script Çalıştır</option>
                        <option value="screenshot">Ekran Görüntüsü</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Selector:</label>
                      <input
                        type="text"
                        value={step.selector || ''}
                        onChange={(e) => updateStep(index, 'selector', e.target.value)}
                        placeholder="#id, .class, [name='field']"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Değer:</label>
                      <input
                        type="text"
                        value={step.value || ''}
                        onChange={(e) => updateStep(index, 'value', e.target.value)}
                        placeholder="Girilecek değer veya veri kaynağı"
                      />
                    </div>

                    <div className="form-group">
                      <label>Bekleme (ms):</label>
                      <input
                        type="number"
                        value={step.wait_after}
                        onChange={(e) => updateStep(index, 'wait_after', parseInt(e.target.value))}
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={step.is_optional}
                        onChange={(e) => updateStep(index, 'is_optional', e.target.checked)}
                      />
                      Opsiyonel
                    </label>
                  </div>
                </div>

                <div className="step-actions">
                  <button onClick={() => moveStep(index, 'up')} disabled={index === 0}>↑</button>
                  <button onClick={() => moveStep(index, 'down')} disabled={index === steps.length - 1}>↓</button>
                  <button onClick={() => deleteStep(index)} className="btn-delete">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="designer-footer">
        <button onClick={onBack || onCancel} className="btn-cancel">İptal</button>
        <button onClick={handleSave} className="btn-save" disabled={loading}>
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
};

export default WorkflowDesigner;