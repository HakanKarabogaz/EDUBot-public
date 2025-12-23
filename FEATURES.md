# 🎯 EDUBot Feature Documentation

> **Last Updated:** December 23, 2025  
> **Version:** Demo/Public (UI Showcase)

---

## 🆕 Recent Updates

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
