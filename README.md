# 🤖 EDUBot - Academic Administration Automation (Demo)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows-blue.svg)](https://www.microsoft.com/windows)
[![Framework: Electron](https://img.shields.io/badge/framework-Electron-47848F.svg)](https://www.electronjs.org/)
[![UI: React](https://img.shields.io/badge/UI-React-61DAFB.svg)](https://reactjs.org/)

> ⚠️ **This is a DEMO/EDUCATIONAL version for portfolio showcase only.**  
> 🔒 **Production features and core business logic are in private repository.**  
> 💼 **Commercial inquiries: hakankarabogaz@tarsus.edu.tr**

---

## 📋 Overview

EDUBot is an **Electron-based desktop automation tool** designed for academic administration tasks in Turkish universities. This repository showcases the **UI/UX components and architecture** while keeping core automation logic private.

### ✨ Key Features (Demo Version)

- 🎨 **Modern React UI** - Dashboard, workflow designer, data manager
- 📊 **Database Schema** - Academic data model (students, courses, grades)
- 🔐 **Secure IPC Bridge** - Electron preload security patterns
- 🎯 **Component Showcase** - Modal dialogs, forms, tables
- 📱 **Responsive Design** - Modern CSS with animations
- 🔄 **Workflow Duplication** - One-click workflow copy with modal UI
  - ✅ Interactive modal dialog with smooth animations
  - ✅ Auto-suggested naming (Original Name + Date)
  - ✅ Real-time input validation
  - ✅ Keyboard shortcuts (Enter to confirm)
- 🌐 **Browser Selection UI** (NEW - Nov 2025)
  - ✅ One-click browser launch buttons (Chrome/Edge)
  - ✅ Interactive browser selection modal
  - ✅ Visual browser type indicators
  - ✅ Smart workflow execution without re-login
  - ✅ Persistent session management UI

### 🚫 Not Included in Public Version

The following production features are **NOT** in this repository:

- ❌ Core workflow execution engine
- ❌ Browser automation controller
- ❌ Smart element selector algorithms
- ❌ Data mapping & processing logic
- ❌ Target system integrations
- ❌ Advanced error handling & retry mechanisms
- ❌ Production-ready security features

---

## 🏗️ Architecture (High-Level)

```
┌─────────────────────────────────────┐
│         EDUBot Platform             │
├──────────────┬──────────────────────┤
│  Frontend    │  Backend (Private)   │
│  (Public)    │                      │
├──────────────┼──────────────────────┤
│ React UI     │ Workflow Engine      │
│ Components   │ Browser Controller   │
│ CSS/Styles   │ Smart Selectors      │
│ IPC Client   │ Data Mapper          │
└──────────────┴──────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend (Public)
- **Framework:** Electron + React 18
- **Build Tool:** Vite
- **Styling:** CSS3 with CSS Variables
- **Icons:** Lucide React
- **State:** React Hooks (useState, useEffect)

### Backend (Private - Not in this repo)
- **Runtime:** Node.js
- **Database:** SQLite3 / Better-SQLite3
- **Automation:** Puppeteer (Headless Chrome)
- **Architecture:** Event-driven with IPC

---

## 📦 Installation (Demo UI Only)

```bash
# Clone repository
git clone https://github.com/HakanKarabogaz/EDUBot-public.git
cd EDUBot-public

# Install dependencies
npm install

# Run development server (UI only)
npm run dev
```

> ⚠️ **Note:** This will only show the UI components. Core functionality requires private backend modules.

---

## 📚 Documentation

- 📖 **[FEATURES.md](./FEATURES.md)** - Detailed feature documentation with code examples
- 🔒 **[SECURITY.md](./SECURITY.md)** - Security policies and vulnerability reporting
- ⚖️ **[LICENSE](./LICENSE)** - AGPL-3.0 license terms and commercial options

---

## 📸 Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)
*Modern dashboard with workflow management and statistics*

### Workflow Duplication Feature
![Workflow Duplication](docs/screenshots/workflow-duplication.png)
*One-click workflow copy with interactive modal dialog*

**Recent Feature (Jan 2026):** AI-powered decision-making mechanisms have been integrated into the workflow. 

Workflow Duplication
- Click "Copy" button on any workflow card
- Modal dialog opens with auto-suggested name
- Edit name and press Enter or click "Kopyala"
- New workflow created instantly with all steps
- Behind the scenes: Atomic database transaction copies workflow + all action steps

**Implementation Highlights (UI Layer - Public):**
```jsx
// Modal state management
const [showDuplicateModal, setShowDuplicateModal] = useState(false);
const [workflowToDuplicate, setWorkflowToDuplicate] = useState(null);
const [newWorkflowName, setNewWorkflowName] = useState('');

// Auto-suggested naming with current date
const defaultName = `${workflow.name} (Kopya - ${new Date().toLocaleDateString('tr-TR')})`;

// Real-time validation
const isValidName = newWorkflowName.trim().length >= 3;

// Smooth animations (CSS)
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); } to { transform: translateY(0); } }
```

**Backend Logic (Private Repo - Not shown):**
- Transaction-based atomic copy (BEGIN → COMMIT/ROLLBACK)
- Validation (ID check, name length 3-100 chars)
- Duplicate detection with friendly error messages
- Workflow + all action steps copied in single transaction
- Automatic ID generation using `lastInsertRowid`

### Workflow Designer
![Workflow Designer](docs/screenshots/workflow-designer.png)
*Visual workflow creation interface*

### Data Import
![Data Import](docs/screenshots/hybrid-import.png)
*CSV data import and preview*

### Browser Selection (NEW - Nov 2025)
![Browser Selection](docs/screenshots/browser-selection.png)
*Smart browser detection and selection for workflow execution*

**Key Features:**
- **One-Click Launch:** Start Chrome/Edge in debug mode directly from UI
- **Smart Detection:** Automatically finds open browsers with debug ports
- **Visual Selection:** Clear icons and port information
- **Session Persistence:** Browser stays open after workflow completion
- **No Re-login:** Connect to existing browser sessions

**UI Components (Showcased):**
```jsx
// Browser Launch Buttons
<button onClick={() => handleLaunchBrowser('chrome')} className="chrome-btn">
  🌐 Chrome ile Başlat
</button>
<button onClick={() => handleLaunchBrowser('edge')} className="edge-btn">
  🔷 Edge ile Başlat
</button>

// Browser Selection Modal
{showBrowserSelection && (
  <div className="browser-selection-modal">
    {browserChoices.map(choice => (
      <button onClick={() => handleBrowserSelect(choice)}>
        {choice.label}
      </button>
    ))}
  </div>
)}
```

**Backend Logic (Private - Not shown):**
- Browser process detection via OS commands
- Debug port availability checking (9222, 9223, 9224)
- Puppeteer connection management (connect vs launch)
- Session persistence (disconnect without close)

---

## 🎓 Use Cases (Production Version)

The full production version (private) is used for:

- ✅ Bulk grade entry to university systems
- ✅ Student data management automation
- ✅ Course enrollment processing
- ✅ Academic workflow automation
- ✅ YÖKSİS/OBS integration

---

## 📜 License

This project is licensed under **AGPL-3.0** License.

### 🔒 License Restrictions

- ✅ **Personal Use:** Free for educational and research purposes
- ✅ **Open Source Projects:** Free if your project is also AGPL-3.0
- ❌ **Commercial Use:** Requires commercial license
- ❌ **SaaS/Cloud:** Requires special license
- ❌ **Closed Source:** Not allowed without permission

**Commercial License Available:** Contact hakankarabogaz@tarsus.edu.tr

---

## ⚖️ Legal Disclaimer

```
This software is provided "AS IS" for educational and demonstration purposes only.

- This is NOT production-ready software
- No warranties or guarantees provided
- User assumes all responsibility for use
- Not affiliated with any university system
- Automation must comply with target system's Terms of Service
```

---

## 🤝 Contributing

This is a **showcase repository**. Contributions are limited to:

- 🐛 Bug reports (UI/UX issues only)
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🎨 UI/Design enhancements

**Core features:** Not accepting contributions (private repo)

---

## 👨‍💻 Author

**Hakan Karaboğaz**
- 📧 Email: hakankarabogaz@tarsus.edu.tr
- 🐙 GitHub: [@HakanKarabogaz](https://github.com/HakanKarabogaz)
- 🏢 Institution: Tarsus University

---

## 📌 Project Status

- ✅ **UI/UX:** Complete and showcased here
- 🔒 **Backend:** Private repository (production-ready)
- 🚀 **Status:** Active development
- 📅 **Last Updated:** November 2025

---

## 🔗 Related Projects

- [Electron](https://www.electronjs.org/) - Desktop app framework
- [React](https://reactjs.org/) - UI library
- [Puppeteer](https://pptr.dev/) - Browser automation (not in this repo)

---

## 📞 Commercial Inquiries

Interested in the **full production version**?

- 🏢 **Enterprise License:** Custom features + support
- 🎓 **University License:** Tailored for your institution
- 💼 **Consulting:** Implementation and training
- 🛠️ **Custom Development:** Specific integrations

**Contact:** hakankarabogaz@tarsus.edu.tr

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Made with ❤️ for Turkish Universities

</div>
