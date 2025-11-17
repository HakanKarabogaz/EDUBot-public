# 🎯 EDUBot Feature Documentation

> **Last Updated:** November 3, 2025  
> **Version:** Demo/Public (UI Showcase)

---

## 🆕 Recent Features

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
