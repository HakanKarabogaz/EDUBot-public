# 🎯 EDUBot Feature Documentation

> **Last Updated:** January 2026
> **Version:** Demo/Public (UI Showcase)

---

## 🆕 Recent Updates

### 🤖 AI Decision Engine — Akıllı Belge Kontrolü (Jan 2026)

**Status:** ✅ Implemented & Production-Tested
**Type:** Full-Stack AI Feature
**Complexity:** Very High

#### 📋 Overview

EDUBot'a yerel LLM entegrasyonu ile otomatik karar verme sistemi eklendi. Öğrenci başvurularında transkript, öğrenci belgesi ve disiplin belgelerini otomatik analiz ederek ONAY/RED kararı verebiliyor. Karar sistemi LM Studio üzerinden yerel AI modelleri kullanıyor — hiçbir veri dışarı çıkmıyor.

#### 🎨 User Experience

1. **Workflow Design:** AI Karar step'ini workflow'a ekle, kuralları görsel builder ile tanımla
2. **Rule Builder UI:** Karşılaştırma, benzerlik, regex, liste, AI analiz kuralları drag & drop
3. **Connection Test:** Tek tuşla LM Studio bağlantısını test et
4. **Auto Execution:** Her CSV kaydı için belgeleri otomatik indir, parse et, kuralları uygula
5. **Smart Decision:** ONAY/RED kararını %100 güven ile ver, onay/red butonuna otomatik tıkla

#### 💻 Technical Implementation (UI Layer)

**New Action Type:** `ai_decision` in `src/renderer/components/StepEditor.jsx`

```jsx
// AI Decision Step type with visual rule builder
{
    id: 'ai_decision',
    icon: <Brain size={20} />,
    label: 'AI Karar',
    description: 'Yerel AI modeli ile otomatik karar verme'
}

// Rule builder UI - dynamic add/remove
const RuleBuilder = ({ rules, onChange }) => {
    const ruleTypes = [
        { value: 'comparison', label: 'Karşılaştırma (≥, ≤, ==)' },
        { value: 'similarity', label: 'String Benzerliği' },
        { value: 'regex', label: 'Pattern Eşleştirme' },
        { value: 'list_check', label: 'Liste Kontrolü' },
        { value: 'ai_analysis', label: 'AI Semantik Analiz' }
    ];
    // Dynamic rule card with add/delete buttons
};

// Connection test button
<button onClick={testLMStudioConnection}>
    🔌 Bağlantıyı Test Et
</button>
// → Returns: "✅ Connected | Model: qwen2.5-14b-instruct"
```

**Config Format:**
```json
{
  "action_type": "ai_decision",
  "config": {
    "endpoint": "http://localhost:1234/v1",
    "model": "qwen2.5-14b-instruct",
    "visionModel": "qwen2-vl-7b-instruct",
    "with_documents": true,
    "documentsTableSelector": "table.table-bordered",
    "rules": [
      {"name": "gano_minimum", "type": "comparison", "operator": ">=", "threshold": 2.29, "field": "pdfData.gno"},
      {"name": "tc_eslesmesi", "type": "exact_match", "csv_field": "TC Kimlik No", "pdf_field": "tc_kimlik"},
      {"name": "disiplin_cezasi_kontrolu", "type": "text_search", "critical": true}
    ],
    "result_variable": "aiDecision",
    "onPass": "click_approve",
    "onFail": "click_reject",
    "approveButtonSelector": "button.btn-green",
    "rejectButtonSelector": "button.btn-red",
    "timeout": 60000
  }
}
```

**Preload API:** `src/preload.js`

```javascript
window.electronAPI.ai = {
    testConnection: (endpoint) => ipcRenderer.invoke('ai:testConnection', endpoint),
    query: (prompt, options) => ipcRenderer.invoke('ai:query', prompt, options),
    evaluateRules: (rules, context, options) => ipcRenderer.invoke('ai:evaluateRules', rules, context, options),
    getModels: (endpoint) => ipcRenderer.invoke('ai:getModels', endpoint),
    onDecision: (callback) => ipcRenderer.on('ai-decision', callback),
    onDecisionPause: (callback) => ipcRenderer.on('ai-decision-pause', callback)
}
```

#### 🔒 Backend Logic (Private — Not Shown)

**Module:** `src/main/ai-decision-engine.js`

**Architecture:**
```
CSV Record
    │
    ▼
Navigate → URL ({{İşlem_href}})
    │
    ▼
Scrape Document Links (HTML table → PDF URLs)
    │
    ├── Transcript PDF ──► Text Extraction (pdfjs)
    │                           │
    │                     < 50 chars? → Vision AI (qwen2-vl-7b)
    │
    ├── Discipline PDF ──► Text Extraction
    │                           │
    │                     < 50 chars? → Vision AI (OCR)
    │
    └── Student Certificate ──► Text Extraction
                                    │
                              < 50 chars? → Vision AI
    │
    ▼
Rule Engine (7 rule types)
    │
    ▼
Decision: ONAY / RED (confidence %)
    │
    ▼
Auto-click Approve / Reject button
```

**Rule Types Implemented:**
| Type | Description | Example |
|------|-------------|---------|
| `comparison` | Numeric comparison | `{{gano}} >= 2.29` |
| `similarity` | String similarity (Levenshtein/Jaccard) | Program name match ≥ 90% |
| `regex` | Pattern matching | TC No format |
| `list_check` | Membership check | Required documents present |
| `date_range` | Date freshness check | Certificate ≤ 30 days old |
| `javascript` | Custom JS expression | Complex business logic |
| `ai_analysis` | Semantic LLM analysis | "Is there disciplinary action?" |
| `string_match` | Fuzzy string match | Name fields |
| `exact_match` | Exact string equality | TC Kimlik matching |
| `text_search` | Substring/phrase search | "disiplin cezası yoktur" |
| `value_check` | Exact value equality | Failed course count == 0 |

**PDF Parsing (In-Memory — No Disk I/O):**
```javascript
// Download PDF from URL → Buffer → Parse → Extract fields
async downloadAndParseTranskriptFromUrl(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);  // In memory only!
    return await this.parseTranskriptPdf(buffer);
}
// Extracted: name, surname, TC, GNO, failed_courses, program, university, date
```

**Vision AI Fallback (Image-based PDFs):**
```javascript
// When text extraction returns < 50 chars → use Vision model
if (extraction.text.length < 50) {
    const visionResult = await this.analyzeDocument(pdfBuffer, prompt);
    // qwen2-vl-7b-instruct reads the document visually
    // Returns: "CEZA YOK" → normalized to "disiplin cezası yoktur"
}
```

**GNO Scale Detection:**
```javascript
// Auto-detect 4-point vs 100-point GPA systems
const is100Scale = /100\s*l[uü]k/i.test(text) || /100\s*[Pp]uan/i.test(text);
data.gno_scale = is100Scale ? 100 : 4;
// Threshold adapts: 100-scale → 60, 4-scale → 2.29
```

#### 🏆 WF-111 Production Test Results (Yatay Geçiş Başvuru Kontrolü)

**Workflow:** Lateral transfer application review
**Test Date:** January 27, 2026
**Student:** ELİF EYLÜL GÖDELEK

| # | Rule | Type | Result |
|---|------|------|--------|
| 1 | TC Identity Match | exact_match | ✅ PASS |
| 2 | GPA Minimum (≥2.29) | comparison | ✅ PASS (2.95) |
| 3 | Disciplinary Check | text_search + Vision AI | ✅ PASS |
| 4 | Failed Courses (==0) | value_check | ✅ PASS |
| 5 | Student Cert TC Match | exact_match | ✅ PASS |
| 6 | Certificate Freshness | date_range | ✅ PASS (2 days) |
| 7 | Student Status Active | text_search | ✅ PASS |

**Final Decision: ✅ ONAY (100% confidence)**
**Auto-clicked:** Approve button
**Execution time:** ~8ms (rule evaluation only, excl. PDF download)

#### 🐛 Bugs Fixed During Implementation

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| AI Decision config not loading on edit | No `ai_decision` case in StepEditor useEffect | Added dedicated case |
| Step IDs changing on every save | DELETE-THEN-RECREATE pattern | Changed to UPSERT logic |
| `decision.details.filter` not a function | Array converted to Object | Kept as Array, added `.detailsByName` |
| `actionNavigate` ignoring template vars | Missing `replaceTemplateVariables` call | Added template replacement |
| `workflowId` vs `workflow_id` mismatch | camelCase vs snake_case parameter | Unified to snake_case |
| `resolveValue` returning literal paths | Only handled `{{var}}` format | Added dot-notation path resolution |
| `tcFound is not defined` | JS scope error in TC parsing | Added `let tcFound = null` |
| Vision model result not applied | Reading `.text` instead of `.answer` | Added fallback: `answer \|\| text \|\| content` |
| FF notes counted as failed courses | "FF" appears in grade scale definition | Changed to count only `K` (Kaldı) status |

#### 📊 Model Configuration

**Hardware:** RTX 5060 Ti 16GB VRAM + i9-14900K + 32GB RAM

| Model | Purpose | VRAM | Speed |
|-------|---------|------|-------|
| `qwen2.5-14b-instruct` | Text analysis, rule evaluation | ~9GB | Fast |
| `qwen2-vl-7b-instruct` | Vision/OCR for image PDFs | ~5GB | Fast |
| **Total** | Hybrid pipeline | **~14GB** | **Fits in 16GB** |

#### 🔄 Complete Execution Flow

```
1. Load CSV (student applications)
   ↓
2. For each record:
   ├─ Navigate → Application URL ({{İşlem_href}})
   ├─ Scrape → Document table (3 PDFs: transcript, discipline, student cert)
   ├─ Download → PDFs to memory buffer (no disk writes)
   ├─ Parse → Extract: TC, Name, GNO, courses, status, program
   │   └─ Fallback → Vision AI if PDF is scanned/image-based
   ├─ Evaluate → 7+ rules against CSV + PDF data
   └─ Act → Click ONAY or RED button automatically
   ↓
3. Results: Success/Error counts, execution log
```

#### 🎯 Benefits

- ✅ **Privacy:** All AI runs locally via LM Studio — no data sent externally
- ✅ **Speed:** ~8ms rule evaluation per record (excl. PDF download)
- ✅ **Accuracy:** 100% on tested records
- ✅ **Flexibility:** 11 rule types, unlimited rules per workflow step
- ✅ **Resilience:** Vision AI fallback for scanned/image PDFs
- ✅ **Multi-format:** Handles 4-point and 100-point GPA scales
- ✅ **No re-login:** Uses existing browser session

#### 📊 Metrics

- **New Files:** `src/main/ai-decision-engine.js` (~2000+ lines, private)
- **Modified Files:** `workflow-executor.js`, `index.js`, `preload.js`, `StepEditor.jsx`, `WorkflowDesigner.jsx`, `LogViewer.jsx`, `WorkflowRunner.jsx`
- **Rule Types:** 11 distinct types
- **AI Models Used:** 2 (text + vision)
- **PDF Sources:** 3 document types parsed
- **Production Tests:** 15+ workflow executions with real data
- **Development Duration:** Jan 24–28, 2026 (5 days)

---


### 🐛 Bug Fixes (Jan 2026 — AI Integration)

Multiple bugs discovered and fixed during the AI Decision Engine implementation sprint. See the AI Decision Engine section above for the full bug fix table.

**Key Fixes:**
- `WorkflowDesigner.jsx` — Step save changed from DELETE-THEN-RECREATE to UPSERT (step IDs now stable)
- `LogViewer.jsx` / `WorkflowRunner.jsx` — `workflowId` → `workflow_id` parameter casing fix
- `workflow-executor.js` — `actionNavigate` now replaces `{{template}}` variables in URLs
- `ai-decision-engine.js` — Vision model result field (`answer` vs `text`) normalization

---

### 🐛 Bug Fixes (Dec 2025)

#### Workflow Edit Screen Data Loading Issue - FIXED ✅

**Status:** ✅ Fixed  
**Date:** December 23, 2025  
**Severity:** High (Workflow editing was broken)

**Problem:**
When clicking the "Düzenle" (Edit) button on a workflow card, the workflow designer screen would open but form fields remained empty. Steps were visible but workflow metadata (name, description, timeout) was not loading.

**Root Cause:**
1. **Dashboard.jsx** - `handleEditWorkflow()` was calling deprecated `onSelectWorkflow()` method
2. **WorkflowDesigner.jsx** (Private) - API response format inconsistency (`{success, data}` vs direct object)
3. **State race condition** between navigation and data loading

**Fix Implementation:**

**File:** `src/renderer/components/Dashboard.jsx`

```javascript
// ❌ OLD - Broken approach
const handleEditWorkflow = (workflow) => {
    onSelectWorkflow(workflow);  // Deprecated method
    onNavigate('workflow-designer');  // No workflow ID passed
};

// ✅ NEW - Fixed approach
const handleEditWorkflow = (workflow) => {
    // Pass workflowId directly to designer via navigation params
    onNavigate('workflow-designer', { workflowId: workflow.id });
};
```

**File:** `WorkflowDesigner.jsx` (Private Implementation)

```javascript
// ❌ OLD - Assumed single response format
const loadWorkflow = async () => {
    const result = await window.electronAPI.workflows.get(workflowId);
    setWorkflow(result);  // Breaks when result = {success: true, data: {...}}
};

// ✅ NEW - Handle multiple response formats
const loadWorkflow = async () => {
    const result = await window.electronAPI.workflows.get(workflowId);
    
    // API response format check (some handlers return {success, data})
    const workflowData = result?.success ? result.data : result;
    
    if (workflowData) {
        console.log('✅ Setting workflow data:', workflowData);
        setWorkflow(workflowData);
    }
};
```

**Testing:**
- ✅ Workflow edit button now loads all form fields correctly
- ✅ Step list renders properly
- ✅ No console errors related to undefined properties
- ✅ Verified with Workflow ID 23 (multi-step workflow)

**Impact:**
- **User Experience:** Critical workflow editing functionality restored
- **Data Safety:** Prevents accidental workflow overwrites with empty data
- **Developer Experience:** Clearer API response format handling

**Logs:** 
- UI Console: `test\UI Console LOG\localhost_5174_2.png`
- Screenshot: `test\UI Console LOG\localhost_5174_SCREENSHOT.png`
- Terminal: `test\UI Console LOG\23122025_1007.log`

---

## 🆕 Recent Features

### 📁 Hierarchical Navigation & Category Management (Nov 2025)

**Status:** ✅ Implemented  
**Type:** Full-Stack Feature (UI Showcase)  
**Complexity:** High

#### 📋 Overview

Modern sidebar navigation system with hierarchical category management, allowing administrators to organize workflows into nested categories and users to filter workflows by category for better organization and discoverability.

#### 🎨 User Experience

1. **Navigation:** Collapsible sidebar with nested category tree
2. **Category Management:** Visual category editor with drag indicators
3. **Workflow Organization:** Assign workflows to categories via dropdown
4. **Smart Filtering:** Click category to filter workflows instantly
5. **Settings Submenu:** Expandable settings with multiple options

#### 💻 Technical Implementation (UI Layer)

**Component:** `src/renderer/components/Sidebar.jsx`

```jsx
// Hierarchical Sidebar with Nested Categories
const Sidebar = ({ currentView, onViewChange }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [categories, setCategories] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState(new Set());

    // Recursive category rendering
    const renderCategory = (category, level = 0) => {
        const hasChildren = category.children && category.children.length > 0;
        const isExpanded = expandedCategories.has(category.id);

        return (
            <div key={category.id} style={{ paddingLeft: `${level * 16}px` }}>
                <div onClick={() => hasChildren ? toggleCategory(category.id) : handleCategoryClick(category)}>
                    {hasChildren && (
                        <span className="category-toggle">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                    )}
                    <span className="category-icon">{category.icon}</span>
                    <span className="category-name">{category.name}</span>
                    {category.workflow_count > 0 && (
                        <span className="category-count">{category.workflow_count}</span>
                    )}
                </div>
                
                {hasChildren && isExpanded && (
                    <div className="sidebar-category-children">
                        {category.children.map(child => renderCategory(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Menu items with submenu support
    const menuItems = [
        { id: 'dashboard', icon: <Home size={20} />, label: 'Ana Sayfa', view: 'dashboard' },
        { 
            id: 'workflows', 
            icon: <Workflow size={20} />, 
            label: 'Workflows',
            hasCategories: true  // Shows category tree
        },
        { 
            id: 'settings', 
            icon: <Settings size={20} />, 
            label: 'Ayarlar',
            hasSubmenu: true,
            submenu: [
                { id: 'category-manager', label: 'Kategori Yönetimi' },
                { id: 'system-settings', label: 'Sistem Ayarları' }
            ]
        }
    ];

    return (
        <div className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
            {/* Collapsible toggle button */}
            <button onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
            
            {/* Render menu items with categories */}
            {menuItems.map(item => (
                <div key={item.id}>
                    <div className="sidebar-menu-item" onClick={() => onViewChange(item.view)}>
                        {item.icon}
                        {!isCollapsed && <span>{item.label}</span>}
                    </div>
                    
                    {/* Show categories under Workflows */}
                    {item.hasCategories && !isCollapsed && (
                        <div className="sidebar-categories">
                            {categories.map(cat => renderCategory(cat, 0))}
                        </div>
                    )}
                    
                    {/* Show submenu under Settings */}
                    {item.hasSubmenu && !isCollapsed && isExpanded && (
                        <div className="sidebar-submenu">
                            {item.submenu.map(sub => (
                                <div key={sub.id} onClick={() => onViewChange(sub.view)}>
                                    {sub.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
```

**Component:** `src/renderer/components/CategoryManager.jsx`

```jsx
// Visual Category Management Interface
const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [editingCategory, setEditingCategory] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Category CRUD operations
    const handleCreateCategory = async () => {
        const result = await window.electronAPI.categories.create(newCategory);
        if (result.success) {
            loadCategories();
            setShowAddModal(false);
        }
    };

    const handleUpdateCategory = async (id, data) => {
        await window.electronAPI.categories.update(id, data);
        loadCategories();
    };

    const handleDeleteCategory = async (id) => {
        if (confirm('Kategoriyi silmek istediğinizden emin misiniz?')) {
            await window.electronAPI.categories.delete(id);
            loadCategories();
        }
    };

    // Render hierarchical category tree
    const renderCategory = (category, level = 0) => {
        const isEditing = editingCategory?.id === category.id;
        
        return (
            <div key={category.id} style={{ paddingLeft: `${level * 24}px` }}>
                <div className="category-row">
                    {/* Drag handle for future reordering */}
                    <GripVertical size={16} className="drag-handle" />
                    
                    {/* Expand/collapse for children */}
                    {category.children?.length > 0 && (
                        <button onClick={() => toggleCategory(category.id)}>
                            {isExpanded ? <ChevronDown /> : <ChevronRight />}
                        </button>
                    )}
                    
                    {/* Editable fields */}
                    {isEditing ? (
                        <>
                            <input value={editingCategory.icon} onChange={...} />
                            <input value={editingCategory.name} onChange={...} />
                            <button onClick={() => handleUpdateCategory(category.id, editingCategory)}>
                                <Save size={16} />
                            </button>
                        </>
                    ) : (
                        <>
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                            <button onClick={() => setEditingCategory({...category})}>
                                <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDeleteCategory(category.id)}>
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
                
                {/* Render children recursively */}
                {category.children?.map(child => renderCategory(child, level + 1))}
            </div>
        );
    };

    return (
        <div className="category-manager">
            <button onClick={() => setShowAddModal(true)}>
                <Plus size={20} /> Yeni Kategori
            </button>
            
            <div className="category-list">
                {categories.map(cat => renderCategory(cat, 0))}
            </div>
            
            {/* Modal for creating/editing categories */}
            {showAddModal && (
                <CategoryModal 
                    onSave={handleCreateCategory}
                    onClose={() => setShowAddModal(false)}
                />
            )}
        </div>
    );
};
```

**Component:** `src/renderer/components/Dashboard.jsx` (Enhanced)

```jsx
// Workflow card with category assignment
<div className="workflow-card">
    <h4>{workflow.name}</h4>
    
    {/* Category dropdown selector */}
    <div className="workflow-category-selector">
        <button onClick={() => setShowCategoryDropdown(workflow.id)}>
            {getCategoryName(workflow.category_id) || 'Kategori Seç'}
        </button>
        
        {showCategoryDropdown === workflow.id && (
            <div className="category-dropdown">
                <div onClick={() => handleAssignCategory(workflow.id, null)}>
                    ❌ Kategori Kaldır
                </div>
                
                {/* Main categories */}
                {categories.filter(c => !c.parent_id).map(category => (
                    <div key={category.id}>
                        <div onClick={() => handleAssignCategory(workflow.id, category.id)}>
                            {category.icon} {category.name}
                        </div>
                        
                        {/* Sub-categories with indentation */}
                        {categories.filter(c => c.parent_id === category.id).map(subCat => (
                            <div 
                                key={subCat.id}
                                style={{ paddingLeft: '28px' }}
                                onClick={() => handleAssignCategory(workflow.id, subCat.id)}
                            >
                                {subCat.icon} {subCat.name}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )}
    </div>
</div>

// Filter workflows by category
const filteredWorkflows = selectedCategoryFilter
    ? workflows.filter(w => w.category_id === selectedCategoryFilter)
    : workflows;

// Show filter badge
{selectedCategoryFilter && (
    <button onClick={() => setSelectedCategoryFilter(null)}>
        ✖ Filtreyi Kaldır ({getCategoryName(selectedCategoryFilter)})
    </button>
)}
```

**Styling:** `src/renderer/components/Sidebar.css`

```css
/* Sidebar base styles */
.sidebar {
    width: 260px;
    height: 100vh;
    background: linear-gradient(180deg, #1e3a5f 0%, #2c5282 100%);
    color: #ffffff;
    transition: width 0.3s ease;
}

.sidebar-collapsed {
    width: 64px;
}

/* Menu item styles */
.sidebar-menu-item {
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.sidebar-menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(2px);
}

.sidebar-menu-item.active {
    background: rgba(255, 255, 255, 0.15);
}

/* Category styles */
.sidebar-category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.sidebar-category-header:hover {
    background: rgba(255, 255, 255, 0.08);
}

.category-count {
    background: rgba(255, 255, 255, 0.15);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
}

/* Nested category indentation */
.sidebar-category-children {
    padding-left: 12px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    margin-left: 20px;
    animation: slideIn 0.2s ease;
}

/* Submenu styles */
.sidebar-submenu {
    padding-left: 20px;
    margin-top: 4px;
}

.sidebar-submenu-item {
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
}

.sidebar-submenu-item:hover {
    background: rgba(255, 255, 255, 0.08);
}

/* Animations */
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateX(-10px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}
```

**Styling:** `src/renderer/components/CategoryManager.css`

```css
/* Category Manager Layout */
.category-manager {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
}

/* Category tree item */
.category-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    transition: background 0.2s;
}

.category-row:hover {
    background: #f9fafb;
}

/* Drag handle */
.drag-handle {
    color: #9ca3af;
    cursor: grab;
}

.drag-handle:active {
    cursor: grabbing;
}

/* Action buttons */
.action-btn {
    padding: 8px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
}

.edit-btn:hover {
    color: #f59e0b;
    background: #fffbeb;
}

.delete-btn:hover {
    color: #ef4444;
    background: #fef2f2;
}

/* Modal styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s;
}

.modal-content {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s;
}

/* Icon picker */
.icon-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 8px;
}

.icon-option {
    padding: 12px;
    font-size: 24px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.icon-option.selected {
    border-color: #3b82f6;
    background: #eff6ff;
}
```

#### 🔒 Backend Logic (Private - Not Shown)

**Database Schema:**
```sql
CREATE TABLE workflow_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER DEFAULT NULL,
    icon TEXT DEFAULT '📁',
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES workflow_categories(id) ON DELETE CASCADE
);

ALTER TABLE workflows ADD COLUMN category_id INTEGER REFERENCES workflow_categories(id);
```

**API Methods (Private Implementation):**
- `getAllCategories()` - Fetch all active categories with ordering
- `getCategoryTree()` - Build hierarchical tree structure recursively
- `createCategory(data)` - Create new category with validation
- `updateCategory(id, data)` - Update existing category
- `deleteCategory(id)` - Soft delete with cascade handling
- `getWorkflowsByCategory(categoryId)` - Filter workflows
- `assignWorkflowToCategory(workflowId, categoryId)` - Link workflow to category
- `loadDefaultCategories()` - Seed default categories on first run

**Default Categories:**
- 👨‍🎓 Öğrenci İşlemleri
  - ✏️ Güncelleme
  - ➕ Ekleme
  - 🔍 Sorgulama
- 📚 Ders İşlemleri
  - ➕ Ders Ekleme
  - ✏️ Ders Güncelleme
  - 🗑️ Ders Silme
- 📊 Raporlama
  - 📈 Not Raporları
  - 📉 Devamsızlık Raporları
- ⚙️ Sistem İşlemleri

#### 🎯 Benefits

- ✅ **Organization:** Workflows organized by purpose/department
- ✅ **Scalability:** Unlimited nesting depth for complex hierarchies
- ✅ **User-Friendly:** Visual tree editor with drag indicators
- ✅ **Smart Navigation:** Click-to-filter from sidebar
- ✅ **Flexible:** Admin-defined categories vs hard-coded
- ✅ **Performance:** Indexed queries for fast filtering
- ✅ **UX Polish:** Smooth animations and hover effects

#### 📊 Metrics

- **Lines of Code (UI):** ~600 lines (Sidebar + CategoryManager + Dashboard changes)
- **Lines of Code (CSS):** ~400 lines (Sidebar.css + CategoryManager.css)
- **Lines of Code (Backend):** ~500 lines (Private repo - database.js, index.js, preload.js)
- **Development Time:** 6-8 hours
- **Database Tables:** 1 new table, 1 column addition
- **Default Categories:** 12 pre-configured

#### 🔄 User Workflow

1. **Admin Setup:**
   - Navigate to Settings → Kategori Yönetimi
   - Create main categories (e.g., "Öğrenci İşlemleri")
   - Add subcategories (e.g., "Güncelleme", "Ekleme")
   - Customize icons and descriptions

2. **Workflow Assignment:**
   - Open Dashboard
   - Click "Kategori Seç" on any workflow card
   - Select category from hierarchical dropdown
   - Category saved and displayed on card

3. **Filtering:**
   - Click category in sidebar
   - Dashboard shows only workflows in that category
   - "Clear Filter" button to show all workflows
   - Empty state with "Show All" if category is empty

4. **Navigation:**
   - Collapse sidebar for more space
   - Expand settings submenu for admin options
   - Workflows menu shows live category tree

---

### 🌐 Browser Selection & Launch UI (Nov 2025)

**Status:** ✅ Implemented  
**Type:** UI + Backend Integration  
**Complexity:** High

#### 📋 Overview

Smart browser selection system that allows users to connect to existing browser sessions or launch new ones in debug mode, eliminating the need for repeated logins during workflow execution.

#### 🎨 User Experience

1. **Browser Launch:** Click "Chrome ile Başlat" or "Edge ile Başlat"
2. **Login Once:** Authenticate in the opened browser
3. **Start Workflow:** Click "Çalıştır" on any workflow
4. **Select Browser:** Choose from detected browsers or launch new
5. **Execute:** Workflow runs in selected browser (no re-login needed)
6. **Persistence:** Browser stays open after workflow completion

#### 💻 Technical Implementation (UI Layer)

**Component:** `src/renderer/components/WorkflowRunner.jsx`

```jsx
// Browser Launch Section
<div className="browser-launch-section">
    <h3>🌐 Tarayıcı Hazırlığı</h3>
    <div className="browser-launch-buttons">
        <button onClick={() => handleLaunchBrowser('chrome')} className="chrome-btn">
            🌐 Chrome ile Başlat
        </button>
        <button onClick={() => handleLaunchBrowser('edge')} className="edge-btn">
            🔷 Edge ile Başlat
        </button>
    </div>
</div>

// Browser Selection Modal
{showBrowserSelection && (
    <div className="browser-selection-modal">
        <div className="modal-content">
            <h3>🌐 Tarayıcı Seçin</h3>
            <p className="help-text">
                Açık olan ve login olduğunuz tarayıcıyı seçerseniz, 
                yeniden login yapmanıza gerek kalmaz.
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
```

**Styling:** `src/renderer/components/WorkflowRunner.css`

```css
/* Browser Launch Section */
.browser-launch-section {
    background: #e3f2fd;
    padding: 20px;
    border-radius: 8px;
    border: 2px solid #2196F3;
}

.launch-browser-btn {
    flex: 1;
    padding: 15px 20px;
    font-size: 16px;
    font-weight: 600;
    border: 2px solid;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
}

.chrome-btn:hover {
    background: #4285F4;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
}

/* Browser Selection Modal */
.browser-selection-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.browser-choice-btn:hover {
    background: #e3f2fd;
    border-color: #2196F3;
    transform: translateX(5px);
}
```

#### 🔒 Backend Logic (Private - Not Shown)

**Browser Detection Algorithm:**
- OS process enumeration (tasklist on Windows)
- Debug port availability checking (HTTP GET to localhost:9222/json/version)
- Browser type identification (Chrome vs Edge via User-Agent)
- Port range scanning (9222, 9223, 9224)

**Connection Management:**
- `puppeteer.connect()` for existing browsers
- `puppeteer.launch()` for new temporary sessions
- Session persistence flag (`connectedToExisting`)
- Graceful disconnect vs close logic

**Security Features:**
- No credential storage (browser session only)
- Temporary user data dir for new browsers
- Automatic cleanup on app exit
- Debug port access control

#### 🎯 Benefits

- ✅ **Time Saving:** No repeated logins
- ✅ **Security:** Credentials stay in browser
- ✅ **Flexibility:** Use existing or new browser
- ✅ **Persistence:** Browser stays open for next workflow
- ✅ **User-Friendly:** One-click browser launch

---

### 🔄 Workflow Duplication (Nov 2025)

**Status:** ✅ Implemented  
**Type:** UI + Backend Integration  
**Complexity:** Medium

#### 📋 Overview

One-click workflow copying with all action steps, implemented with modern React patterns and atomic database transactions.

#### 🎨 User Experience

1. **Trigger:** Click "Copy" button on workflow card
2. **Modal Opens:** Auto-suggested name with current date
3. **Edit Name:** Real-time validation (min 3 characters)
4. **Confirm:** Press Enter or click "Kopyala" button
5. **Result:** New workflow appears instantly in dashboard

#### 💻 Technical Implementation (UI Layer)

**Component:** `src/renderer/components/Dashboard.jsx`

```jsx
// State Management
const [showDuplicateModal, setShowDuplicateModal] = useState(false);
const [workflowToDuplicate, setWorkflowToDuplicate] = useState(null);
const [newWorkflowName, setNewWorkflowName] = useState('');

// Open Modal Handler
const openDuplicateModal = (workflow) => {
    setWorkflowToDuplicate(workflow);
    const today = new Date().toLocaleDateString('tr-TR');
    setNewWorkflowName(`${workflow.name} (Kopya - ${today})`);
    setShowDuplicateModal(true);
};

// Duplication Handler
const handleDuplicateWorkflow = async () => {
    if (!workflowToDuplicate || !newWorkflowName.trim()) return;
    
    try {
        const result = await window.electronAPI.workflows.duplicate(
            workflowToDuplicate.id,
            newWorkflowName.trim()
        );
        
        if (result.success) {
            // Refresh dashboard and close modal
            await loadDashboardData();
            setShowDuplicateModal(false);
        }
    } catch (error) {
        console.error('Workflow duplication failed:', error);
    }
};

// Keyboard Support
<input
    onKeyDown={(e) => {
        if (e.key === 'Enter' && isValidName) {
            handleDuplicateWorkflow();
        }
    }}
/>
```

**Styling:** `src/renderer/styles/global.css`

```css
/* Modal Overlay */
.modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease-out;
    z-index: 1000;
}

/* Modal Content */
.modal-content {
    background: white;
    border-radius: var(--border-radius);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease-out;
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

#### 🔒 Backend Logic (Private Repository)

**File:** `src/main/database.js` (Not in public repo)

**Key Concepts:**
- Atomic database transaction (BEGIN → COMMIT/ROLLBACK)
- Input validation (ID type check, name length 3-100 chars)
- Duplicate workflow + all action steps in single transaction
- Error handling with user-friendly messages
- Uses `lastInsertRowid` for new workflow ID

**IPC Bridge:** `src/preload.js` (Public - Pattern Only)

```javascript
workflows: {
    duplicate: (workflowId, newName) => 
        ipcRenderer.invoke('workflow:duplicate', workflowId, newName)
}
```

#### 📊 Metrics

- **Lines of Code (UI):** ~130 lines (Dashboard.jsx)
- **Lines of Code (CSS):** ~180 lines (Modal styles)
- **Lines of Code (Backend):** ~200 lines (Private repo)
- **Development Time:** 2-3 hours
- **Test Coverage:** Manual testing with workflow ID 23

#### ✅ Benefits

1. **User Productivity:** Copy complex workflows in 3 clicks
2. **Data Safety:** Atomic transactions prevent partial copies
3. **UX Polish:** Smooth animations and keyboard shortcuts
4. **Error Prevention:** Real-time validation prevents invalid names

---

## 🎨 UI Components Showcase

### Modal Dialog System

**Purpose:** Reusable modal component for user interactions

**Features:**
- Backdrop overlay with blur effect
- Smooth enter/exit animations
- Keyboard navigation (Enter, Escape)
- Focus trapping
- Responsive design

**Usage:**
```jsx
{showModal && (
    <div className="modal-overlay" onClick={closeModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
                <h3>Modal Title</h3>
            </div>
            <div className="modal-body">
                {/* Content */}
            </div>
            <div className="modal-footer">
                <button onClick={closeModal}>Cancel</button>
                <button onClick={handleConfirm}>Confirm</button>
            </div>
        </div>
    </div>
)}
```

### Dashboard Cards

**Purpose:** Workflow visualization and management

**Features:**
- Card-based layout with hover effects
- Action buttons (Edit, Delete, Copy)
- Status indicators
- Step count badges
- Responsive grid layout

---

## 🗄️ Database Schema (Public)

**File:** `database/academic-schema.sql`

**Tables:**
- `students` - Student records
- `courses` - Course definitions
- `enrollments` - Student-course relationships
- `grades` - Grade entries
- `batch_jobs` - Bulk operation tracking

**Note:** Query logic and optimizations are in private repository.

---

## 🔐 Security Patterns (Public)

### Preload Script

**File:** `src/preload.js`

**Pattern:** ContextBridge for secure IPC

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    workflows: {
        getAll: () => ipcRenderer.invoke('workflow:getAll'),
        duplicate: (id, name) => ipcRenderer.invoke('workflow:duplicate', id, name)
    }
});
```

**Benefits:**
- No direct Node.js access from renderer
- Type-safe IPC channels
- Whitelist approach for exposed APIs

---

## 📚 Development Learnings

### React State Management

**Lesson:** Multiple related states need careful coordination

```jsx
// ❌ Anti-pattern: Independent states
const [modalOpen, setModalOpen] = useState(false);
const [workflowId, setWorkflowId] = useState(null);

// ✅ Better: Related state together
const [modalState, setModalState] = useState({
    isOpen: false,
    workflow: null,
    newName: ''
});
```

### CSS Animations

**Lesson:** Separate entrance/exit animations improve UX

```css
/* Entrance */
.modal-entering {
    animation: fadeIn 0.2s ease-out;
}

/* Exit */
.modal-exiting {
    animation: fadeOut 0.2s ease-in;
}
```

### Database Transactions

**Lesson:** Always use transactions for multi-step operations

```javascript
// ❌ Without transaction: Partial failure risk
INSERT INTO workflows ...;
INSERT INTO steps ...;  // If this fails, orphaned workflow

// ✅ With transaction: All-or-nothing
BEGIN TRANSACTION;
INSERT INTO workflows ...;
INSERT INTO steps ...;
COMMIT;  // Only if all succeed
```

---

## 🔮 Future Enhancements (Planned)

### AKTS/Semester Credit Validation (In Progress)
- Automatic semester detection from enrollment date
- Per-semester 30 AKTS minimum rule
- Multi-university format support (different transcript layouts)
- Format 1 (Tamamlanan Kredi/AKTS table) vs Format 2 (Başarılan Kredi + Sınıfı/Dönemi) handling

### Workflow Templates
- Pre-built workflow templates
- Community template sharing
- Template marketplace

### Batch Duplication
- Select multiple workflows
- Bulk copy with name pattern
- Progress indicator

### Version Control
- Workflow versioning
- Diff viewer
- Rollback capability

---

## 📞 Questions?

For questions about these features or to request production access:

📧 **Email:** hakankarabogaz@tarsus.edu.tr  
🐙 **GitHub:** [@HakanKarabogaz](https://github.com/HakanKarabogaz)

---

**Made with ❤️ for Academic Automation**
