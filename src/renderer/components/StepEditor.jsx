import React, { useState, useEffect } from 'react';
import {
X,
  Save, 
  MousePointer, 
  Type, 
  Clock, 
  Navigation, 
  Eye, 
  Download,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  Settings
}  from 'lucide-react';

const STEP_TYPES = {
  click: {
    icon: MousePointer,
    label: 'Tıkla',
    description: 'Bir elemente tıkla',
    needsSelector: true,
    needsInput: false,
    needsWait: true
  },
  type: {
    icon: Type,
    label: 'Yazı Yaz',
    description: 'Input alanına yazı yaz',
    needsSelector: true,
    needsInput: true,
    needsWait: true
  },
  wait: {
    icon: Clock,
    label: 'Bekle',
    description: 'Belirli süre bekle',
    needsSelector: false,
    needsInput: true,
    needsWait: false
  },
  navigate: {
    icon: Navigation,
    label: 'Sayfaya Git',
    description: 'Yeni URL\'ye git',
    needsSelector: false,
    needsInput: true,
    needsWait: true
  },
  waitForElement: {
    icon: Eye,
    label: 'Element Bekle',
    description: 'Element görünene kadar bekle',
    needsSelector: true,
    needsInput: false,
    needsWait: false
  },
  download: {
    icon: Download,
    label: 'İndir',
    description: 'Dosya indir',
    needsSelector: true,
    needsInput: false,
    needsWait: true
  },
  upload: {
    icon: Upload,
    label: 'Dosya Yükle',
    description: 'Dosya yükle',
    needsSelector: true,
    needsInput: true,
    needsWait: true
  },
  clear: {
    icon: Trash2,
    label: 'Temizle',
    description: 'Input alanını temizle',
    needsSelector: true,
    needsInput: false,
    needsWait: true
  },
  execute_script: {
    icon: Settings,
    label: 'Script Çalıştır',
    description: 'JavaScript kodu çalıştır',
    needsSelector: false,
    needsInput: true,
    needsWait: true
  }
};

const WAIT_CONDITIONS = {
  none: 'Bekleme Yok',
  time: 'Süre Bekle',
  element: 'Element Bekle',
  elementGone: 'Element Kaybolsun',
  pageLoad: 'Sayfa Yüklensin'
};

function StepEditor({ 
  isOpen, 
  onClose, 
  step = null, 
  workflowId, 
  stepOrder, 
  onSave 
}) {
  const [formData, setFormData] = useState({
    actionType: 'click',
    elementSelectors: {
      css: '',
      xpath: '',
      text: '',
      id: '',
      className: ''
    },
    inputData: {
      value: '',
      filePath: '',
      waitTime: 1000
    },
    waitCondition: {
      type: 'time',
      timeout: 5000,
      selector: ''
    },
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (step) {
      // Mevcut step'i düzenliyoruz
      setFormData({
        actionType: step.action_type || 'click',
        elementSelectors: step.element_selectors ? 
          JSON.parse(step.element_selectors) : 
          { css: '', xpath: '', text: '', id: '', className: '' },
        inputData: (() => {
          if (step.config) {
            const config = JSON.parse(step.config);
            if (step.action_type === 'execute_script') {
              return { 
                value: config.script || '', 
                storeAs: config.storeAs || '',
                waitTime: 1000 
              };
            } else {
              return { 
                value: config.value || '', 
                filePath: '', 
                waitTime: config.value || 1000 
              };
            }
          } else if (step.input_data) {
            return JSON.parse(step.input_data);
          } else {
            return { value: '', filePath: '', waitTime: 1000 };
          }
        })(),
        waitCondition: step.wait_condition ? 
          JSON.parse(step.wait_condition) : 
          { type: 'time', timeout: 5000, selector: '' },
        description: step.description || ''
      });
    } else {
      // Yeni step oluşturuyoruz
      setFormData({
        actionType: 'click',
        elementSelectors: { css: '', xpath: '', text: '', id: '', className: '' },
        inputData: { value: '', filePath: '', waitTime: 1000 },
        waitCondition: { type: 'time', timeout: 5000, selector: '' },
        description: ''
      });
    }
    setErrors({});
  }, [step, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    const stepType = STEP_TYPES[formData.actionType];

    // Element selector kontrolü
    if (stepType.needsSelector) {
      const hasSelector = Object.values(formData.elementSelectors)
        .some(value => value && value.trim());
      
      if (!hasSelector) {
        newErrors.selector = 'En az bir element seçici gerekli';
      }
    }

    // Input data kontrolü
    if (stepType.needsInput) {
      if (formData.actionType === 'type' && !formData.inputData.value.trim()) {
        newErrors.inputValue = 'Yazılacak metin gerekli';
      }
      if (formData.actionType === 'navigate' && !formData.inputData.value.trim()) {
        newErrors.inputValue = 'URL gerekli';
      }
      if (formData.actionType === 'wait' && !formData.inputData.waitTime) {
        newErrors.inputValue = 'Bekleme süresi gerekli';
      }
      if (formData.actionType === 'upload' && !formData.inputData.filePath.trim()) {
        newErrors.inputValue = 'Dosya yolu gerekli';
      }
    }

    // Wait condition kontrolü
    if (formData.waitCondition.type === 'element' || formData.waitCondition.type === 'elementGone') {
      if (!formData.waitCondition.selector.trim()) {
        newErrors.waitSelector = 'Bekleme için element seçici gerekli';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Create config based on action type
      let config;
      if (formData.actionType === 'execute_script') {
        config = JSON.stringify({
          script: formData.inputData.value,
          storeAs: formData.inputData.storeAs || ''
        });
      } else {
        config = JSON.stringify({
          value: formData.inputData.value || formData.inputData.waitTime || ''
        });
      }

      const stepData = {
        workflow_id: workflowId,
        step_order: stepOrder,
        action_type: formData.actionType,
        selector: formData.elementSelectors.primarySelector || '',
        config: config,
        description: formData.description
      };

      await onSave(stepData);
      onClose();
    } catch (error) {
      console.error('Step kaydedilemedi:', error);
      setErrors({ general: 'Step kaydedilemedi: ' + error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleActionTypeChange = (actionType) => {
    setFormData(prev => ({
      ...prev,
      actionType,
      // Reset relevant fields when action type changes
      inputData: actionType === 'wait' 
        ? { ...prev.inputData, waitTime: 1000 }
        : { ...prev.inputData, value: '' }
    }));
  };

  const renderBasicTab = () => {
    const stepType = STEP_TYPES[formData.actionType];
    const StepIcon = stepType.icon;

    return (
      <div className="step-editor-tab">
        {/* Action Type Selection */}
        <div className="form-group">
          <label className="form-label">
            <Settings size={16} />
            Adım Türü
          </label>
          <div className="action-types-grid">
            {Object.entries(STEP_TYPES).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <button
                  key={key}
                  type="button"
                  className={`action-type-card ${formData.actionType === key ? 'active' : ''}`}
                  onClick={() => handleActionTypeChange(key)}
                >
                  <Icon size={20} />
                  <span className="action-label">{type.label}</span>
                  <span className="action-desc">{type.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label className="form-label">Açıklama (Opsiyonel)</label>
          <input
            type="text"
            className="form-input"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Bu adımın ne yaptığını açıklayın..."
          />
        </div>

        {/* Input Data */}
        {stepType.needsInput && (
          <div className="form-group">
            <label className="form-label">
              {formData.actionType === 'type' && 'Yazılacak Metin'}
              {formData.actionType === 'navigate' && 'Hedef URL'}
              {formData.actionType === 'wait' && 'Bekleme Süresi (ms)'}
              {formData.actionType === 'upload' && 'Dosya Yolu'}
              {formData.actionType === 'execute_script' && 'JavaScript Kodu'}
            </label>
            
            {formData.actionType === 'wait' ? (
              <input
                type="number"
                className={`form-input ${errors.inputValue ? 'error' : ''}`}
                value={formData.inputData.waitTime}
                onChange={(e) => handleInputChange('inputData', 'waitTime', parseInt(e.target.value) || 0)}
                placeholder="1000"
                min="100"
                step="100"
              />
            ) : formData.actionType === 'execute_script' ? (
              <div>
                <textarea
                  className={`form-input ${errors.inputValue ? 'error' : ''}`}
                  value={formData.inputData.value}
                  onChange={(e) => handleInputChange('inputData', 'value', e.target.value)}
                  placeholder="JavaScript kodu yazın..."
                  rows={6}
                  style={{ resize: 'vertical', fontFamily: 'monospace' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={formData.inputData.storeAs || ''}
                  onChange={(e) => handleInputChange('inputData', 'storeAs', e.target.value)}
                  placeholder="Sonucu sakla (ör: rowGuid)"
                  style={{ marginTop: '8px' }}
                />
              </div>
            ) : (
              <input
                type="text"
                className={`form-input ${errors.inputValue ? 'error' : ''}`}
                value={formData.inputData.value}
                onChange={(e) => handleInputChange('inputData', 'value', e.target.value)}
                placeholder={
                  formData.actionType === 'type' ? 'Yazılacak metin...' :
                  formData.actionType === 'navigate' ? 'https://example.com' :
                  formData.actionType === 'upload' ? 'C:\\path\\to\\file.pdf' :
                  'Değer...'
                }
              />
            )}
            
            {errors.inputValue && (
              <span className="error-message">
                <AlertCircle size={14} />
                {errors.inputValue}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSelectorsTab = () => {
    const stepType = STEP_TYPES[formData.actionType];
    
    if (!stepType.needsSelector) {
      return (
        <div className="step-editor-tab">
          <div className="info-message">
            <AlertCircle size={20} />
            <p>Bu adım türü için element seçici gerekli değil.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="step-editor-tab">
        <div className="selectors-info">
          <p>Element seçmek için en az bir yöntem kullanın. CSS Selector en yaygın kullanılan yöntemdir.</p>
        </div>

        {/* CSS Selector */}
        <div className="form-group">
          <label className="form-label">CSS Selector (Önerilen)</label>
          <input
            type="text"
            className="form-input"
            value={formData.elementSelectors.css}
            onChange={(e) => handleInputChange('elementSelectors', 'css', e.target.value)}
            placeholder="#submit-button, .login-form input[type='email']"
          />
          <span className="form-hint">Örnek: #id, .class, input[name='username']</span>
        </div>

        {/* ID */}
        <div className="form-group">
          <label className="form-label">Element ID</label>
          <input
            type="text"
            className="form-input"
            value={formData.elementSelectors.id}
            onChange={(e) => handleInputChange('elementSelectors', 'id', e.target.value)}
            placeholder="submit-button"
          />
          <span className="form-hint"># işareti olmadan sadece ID değeri</span>
        </div>

        {/* Class Name */}
        <div className="form-group">
          <label className="form-label">CSS Class</label>
          <input
            type="text"
            className="form-input"
            value={formData.elementSelectors.className}
            onChange={(e) => handleInputChange('elementSelectors', 'className', e.target.value)}
            placeholder="btn btn-primary"
          />
          <span className="form-hint">. işareti olmadan class isimleri</span>
        </div>

        {/* Text Content */}
        <div className="form-group">
          <label className="form-label">Metin İçeriği</label>
          <input
            type="text"
            className="form-input"
            value={formData.elementSelectors.text}
            onChange={(e) => handleInputChange('elementSelectors', 'text', e.target.value)}
            placeholder="Giriş Yap"
          />
          <span className="form-hint">Elementin içindeki metin</span>
        </div>

        {/* XPath */}
        <div className="form-group">
          <label className="form-label">XPath (Gelişmiş)</label>
          <input
            type="text"
            className="form-input"
            value={formData.elementSelectors.xpath}
            onChange={(e) => handleInputChange('elementSelectors', 'xpath', e.target.value)}
            placeholder="//button[@class='submit-btn']"
          />
          <span className="form-hint">XPath expression</span>
        </div>

        {errors.selector && (
          <div className="error-message">
            <AlertCircle size={14} />
            {errors.selector}
          </div>
        )}
      </div>
    );
  };

  const renderWaitTab = () => {
    const stepType = STEP_TYPES[formData.actionType];
    
    if (!stepType.needsWait) {
      return (
        <div className="step-editor-tab">
          <div className="info-message">
            <AlertCircle size={20} />
            <p>Bu adım türü için bekleme koşulu ayarlanamaz.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="step-editor-tab">
        <div className="form-group">
          <label className="form-label">Bekleme Türü</label>
          <select
            className="form-select"
            value={formData.waitCondition.type}
            onChange={(e) => handleInputChange('waitCondition', 'type', e.target.value)}
          >
            {Object.entries(WAIT_CONDITIONS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Timeout */}
        <div className="form-group">
          <label className="form-label">Maksimum Bekleme Süresi (ms)</label>
          <input
            type="number"
            className="form-input"
            value={formData.waitCondition.timeout}
            onChange={(e) => handleInputChange('waitCondition', 'timeout', parseInt(e.target.value) || 5000)}
            min="1000"
            step="1000"
          />
          <span className="form-hint">Bekleme işlemi bu süreden sonra timeout olur</span>
        </div>

        {/* Element Selector for Wait */}
        {(formData.waitCondition.type === 'element' || formData.waitCondition.type === 'elementGone') && (
          <div className="form-group">
            <label className="form-label">
              {formData.waitCondition.type === 'element' ? 'Beklenecek Element' : 'Kaybolması Beklenecek Element'}
            </label>
            <input
              type="text"
              className={`form-input ${errors.waitSelector ? 'error' : ''}`}
              value={formData.waitCondition.selector}
              onChange={(e) => handleInputChange('waitCondition', 'selector', e.target.value)}
              placeholder="#loading-spinner, .success-message"
            />
            {errors.waitSelector && (
              <span className="error-message">
                <AlertCircle size={14} />
                {errors.waitSelector}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="step-editor-overlay">
      <div className="step-editor-modal">
        {/* Header */}
        <div className="step-editor-header">
          <h3>
            {step ? 'Adımı Düzenle' : 'Yeni Adım Ekle'}
            <span className="step-order">#{stepOrder}</span>
          </h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="step-editor-tabs">
          <button
            className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
            onClick={() => setActiveTab('basic')}
          >
            <Settings size={16} />
            Temel Ayarlar
          </button>
          <button
            className={`tab-button ${activeTab === 'selectors' ? 'active' : ''}`}
            onClick={() => setActiveTab('selectors')}
          >
            <MousePointer size={16} />
            Element Seçici
          </button>
          <button
            className={`tab-button ${activeTab === 'wait' ? 'active' : ''}`}
            onClick={() => setActiveTab('wait')}
          >
            <Clock size={16} />
            Bekleme
          </button>
        </div>

        {/* Content */}
        <div className="step-editor-content">
          {activeTab === 'basic' && renderBasicTab()}
          {activeTab === 'selectors' && renderSelectorsTab()}
          {activeTab === 'wait' && renderWaitTab()}
        </div>

        {/* Footer */}
        <div className="step-editor-footer">
          {errors.general && (
            <div className="error-message">
              <AlertCircle size={16} />
              {errors.general}
            </div>
          )}
          
          <div className="footer-actions">
            <button className="btn-secondary" onClick={onClose}>
              İptal
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner-sm" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {step ? 'Güncelle' : 'Kaydet'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepEditor;