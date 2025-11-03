import React, { useState, useEffect, useRef } from 'react';
import { X, Target, MousePointer, Code, Copy, Check } from 'lucide-react';

function ElementPicker({ isOpen, onClose, onElementSelected, targetUrl }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [generatedSelectors, setGeneratedSelectors] = useState({});
  const [copiedSelector, setCopiedSelector] = useState('');
  const webviewRef = useRef(null);

  useEffect(() => {
    if (isOpen && targetUrl) {
      loadPage();
    }
  }, [isOpen, targetUrl]);

  const loadPage = async () => {
    setIsLoading(true);
    try {
      if (webviewRef.current) {
        webviewRef.current.src = targetUrl;
      }
    } catch (error) {
      console.error('Sayfa yüklenemedi:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebviewReady = () => {
    const webview = webviewRef.current;
    if (!webview) return;

    // Element picker CSS'ini inject et
    webview.insertCSS(`
      .edubot-highlight {
        outline: 3px solid #3b82f6 !important;
        outline-offset: 2px !important;
        background-color: rgba(59, 130, 246, 0.1) !important;
        cursor: crosshair !important;
        position: relative !important;
      }
      
      .edubot-highlight::after {
        content: attr(data-edubot-selector) !important;
        position: absolute !important;
        top: -25px !important;
        left: 0 !important;
        background: #3b82f6 !important;
        color: white !important;
        padding: 2px 6px !important;
        font-size: 11px !important;
        border-radius: 3px !important;
        white-space: nowrap !important;
        z-index: 10000 !important;
        font-family: monospace !important;
      }
      
      .edubot-selected {
        outline: 3px solid #10b981 !important;
        outline-offset: 2px !important;
        background-color: rgba(16, 185, 129, 0.2) !important;
      }
      
      .edubot-selected::after {
        background: #10b981 !important;
      }
    `);

    // Element picker JavaScript'ini inject et
    webview.executeJavaScript(`
      (function() {
        let isPickerActive = false;
        let lastHoveredElement = null;
        
        // Selector generator fonksiyonları
        function generateCSSSelector(element) {
          if (element.id) {
            return '#' + element.id;
          }
          
          let selector = element.tagName.toLowerCase();
          
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
              selector += '.' + classes.join('.');
            }
          }
          
          // Name attribute
          if (element.name) {
            selector += '[name="' + element.name + '"]';
          }
          
          // Type attribute for inputs
          if (element.type) {
            selector += '[type="' + element.type + '"]';
          }
          
          // Placeholder attribute
          if (element.placeholder) {
            selector += '[placeholder="' + element.placeholder + '"]';
          }
          
          return selector;
        }
        
        function generateXPath(element) {
          if (element.id) {
            return '//*[@id="' + element.id + '"]';
          }
          
          let path = '';
          let current = element;
          
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();
            
            if (current.id) {
              selector += '[@id="' + current.id + '"]';
              path = '//' + selector + path;
              break;
            }
            
            if (current.className) {
              const classes = current.className.split(' ').filter(c => c.trim());
              if (classes.length > 0) {
                selector += '[@class="' + classes.join(' ') + '"]';
              }
            }
            
            // Sibling index hesapla
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.nodeName === current.nodeName) {
                index++;
              }
              sibling = sibling.previousElementSibling;
            }
            
            if (index > 1) {
              selector += '[' + index + ']';
            }
            
            path = '/' + selector + path;
            current = current.parentElement;
          }
          
          return path || '//html' + path;
        }
        
        function getElementText(element) {
          return element.textContent?.trim().substring(0, 50) || '';
        }
        
        function getElementInfo(element) {
          return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || '',
            className: element.className || '',
            name: element.name || '',
            type: element.type || '',
            placeholder: element.placeholder || '',
            text: getElementText(element),
            cssSelector: generateCSSSelector(element),
            xpath: generateXPath(element)
          };
        }
        
        function clearHighlights() {
          document.querySelectorAll('.edubot-highlight, .edubot-selected').forEach(el => {
            el.classList.remove('edubot-highlight', 'edubot-selected');
            el.removeAttribute('data-edubot-selector');
          });
        }
        
        function highlightElement(element, isSelected = false) {
          clearHighlights();
          
          const className = isSelected ? 'edubot-selected' : 'edubot-highlight';
          element.classList.add(className);
          
          const selector = generateCSSSelector(element);
          element.setAttribute('data-edubot-selector', selector);
        }
        
        function handleMouseOver(event) {
          if (!isPickerActive) return;
          
          event.preventDefault();
          event.stopPropagation();
          
          const element = event.target;
          if (element === lastHoveredElement) return;
          
          lastHoveredElement = element;
          highlightElement(element);
          
          // Hover bilgisini parent'a gönder
          const elementInfo = getElementInfo(element);
          window.postMessage({
            type: 'ELEMENT_HOVERED',
            data: elementInfo
          }, '*');
        }
        
        function handleClick(event) {
          if (!isPickerActive) return;
          
          event.preventDefault();
          event.stopPropagation();
          
          const element = event.target;
          highlightElement(element, true);
          
          // Seçim bilgisini parent'a gönder
          const elementInfo = getElementInfo(element);
          window.postMessage({
            type: 'ELEMENT_SELECTED',
            data: elementInfo
          }, '*');
          
          isPickerActive = false;
          document.body.style.cursor = 'default';
        }
        
        // Picker'ı başlat/durdur
        window.toggleElementPicker = function(active) {
          isPickerActive = active;
          
          if (active) {
            document.body.style.cursor = 'crosshair';
            document.addEventListener('mouseover', handleMouseOver, true);
            document.addEventListener('click', handleClick, true);
          } else {
            document.body.style.cursor = 'default';
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('click', handleClick, true);
            clearHighlights();
          }
        };
        
        // Sayfa yüklendiğinde hazır ol
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            window.postMessage({ type: 'PAGE_READY' }, '*');
          });
        } else {
          window.postMessage({ type: 'PAGE_READY' }, '*');
        }
      })();
    `);
  };

  const handleWebviewMessage = (event) => {
    const { type, data } = event;
    
    switch (type) {
      case 'PAGE_READY':
        console.log('Sayfa hazır, element picker aktif edilebilir');
        break;
        
      case 'ELEMENT_HOVERED':
        setHoveredElement(data);
        break;
        
      case 'ELEMENT_SELECTED':
        setSelectedElement(data);
        setGeneratedSelectors({
          css: data.cssSelector,
          xpath: data.xpath,
          name: data.name ? `[name="${data.name}"]` : '',
          id: data.id ? `#${data.id}` : '',
          text: data.text ? `text="${data.text}"` : ''
        });
        setIsPickerActive(false);
        break;
    }
  };

  const togglePicker = () => {
    const newState = !isPickerActive;
    setIsPickerActive(newState);
    
    if (webviewRef.current) {
      webviewRef.current.executeJavaScript(`
        window.toggleElementPicker(${newState});
      `);
    }
  };

  const copySelector = (selector) => {
    navigator.clipboard.writeText(selector);
    setCopiedSelector(selector);
    setTimeout(() => setCopiedSelector(''), 2000);
  };

  const handleSelectElement = () => {
    if (selectedElement && onElementSelected) {
      onElementSelected({
        ...selectedElement,
        selectors: generatedSelectors
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="element-picker-overlay">
      <div className="element-picker-container">
        {/* Header */}
        <div className="picker-header">
          <div className="picker-title">
            <Target size={20} />
            <h3>Element Seçici</h3>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="picker-content">
          {/* Controls */}
          <div className="picker-controls">
            <div className="url-display">
              <strong>Sayfa:</strong> {targetUrl}
            </div>
            
            <div className="picker-actions">
              <button 
                className={`btn-picker ${isPickerActive ? 'active' : ''}`}
                onClick={togglePicker}
                disabled={isLoading}
              >
                <MousePointer size={18} />
                {isPickerActive ? 'Seçimi Durdur' : 'Element Seç'}
              </button>
              
              {selectedElement && (
                <button 
                  className="btn-primary"
                  onClick={handleSelectElement}
                >
                  <Check size={18} />
                  Seçimi Onayla
                </button>
              )}
            </div>
          </div>

          {/* Browser */}
          <div className="browser-container">
            {isLoading && (
              <div className="browser-loading">
                <div className="spinner"></div>
                <p>Sayfa yükleniyor...</p>
              </div>
            )}
            
            <webview
              ref={webviewRef}
              className="picker-webview"
              onDomReady={handleWebviewReady}
              onIpcMessage={handleWebviewMessage}
              allowpopups="false"
              disablewebsecurity="true"
            />
          </div>

          {/* Element Info */}
          {(hoveredElement || selectedElement) && (
            <div className="element-info">
              <h4>
                <Code size={16} />
                {selectedElement ? 'Seçilen Element' : 'Üzerine Gelinen Element'}
              </h4>
              
              <div className="element-details">
                <div className="element-basic">
                  <span className="tag">{(selectedElement || hoveredElement).tagName}</span>
                  {(selectedElement || hoveredElement).id && (
                    <span className="id">#{(selectedElement || hoveredElement).id}</span>
                  )}
                  {(selectedElement || hoveredElement).className && (
                    <span className="class">.{(selectedElement || hoveredElement).className.split(' ').join('.')}</span>
                  )}
                </div>
                
                {(selectedElement || hoveredElement).text && (
                  <div className="element-text">
                    <strong>Metin:</strong> {(selectedElement || hoveredElement).text}
                  </div>
                )}
                
                {selectedElement && (
                  <div className="selectors-list">
                    <h5>Oluşturulan Selector'lar:</h5>
                    
                    {Object.entries(generatedSelectors).map(([type, selector]) => {
                      if (!selector) return null;
                      
                      return (
                        <div key={type} className="selector-item">
                          <label>{type.toUpperCase()}:</label>
                          <div className="selector-value">
                            <code>{selector}</code>
                            <button 
                              className="btn-copy"
                              onClick={() => copySelector(selector)}
                              title="Kopyala"
                            >
                              {copiedSelector === selector ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ElementPicker;