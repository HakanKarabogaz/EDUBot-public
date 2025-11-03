// Electron IPC wrapper - preload.js ile iletişim

const electronAPI = {
  // Workflows
  getWorkflows: () => window.electronAPI.invoke('get-workflows'),
  getWorkflow: (id) => window.electronAPI.invoke('get-workflow', id),
  createWorkflow: (data) => window.electronAPI.invoke('create-workflow', data),
  updateWorkflow: (id, data) => window.electronAPI.invoke('update-workflow', { id, data }),
  deleteWorkflow: (id) => window.electronAPI.invoke('delete-workflow', id),
  startWorkflow: (id) => window.electronAPI.invoke('start-workflow', id),

  // Steps
  getSteps: (workflowId) => window.electronAPI.invoke('get-steps', workflowId),
  createStep: (data) => window.electronAPI.invoke('create-step', data),
  updateStep: (id, data) => window.electronAPI.invoke('update-step', { id, data }),
  deleteStep: (id) => window.electronAPI.invoke('delete-step', id),

  // Data Sources
  getDataSources: () => window.electronAPI.invoke('get-data-sources'),
  createDataSource: (data) => window.electronAPI.invoke('create-data-source', data),
  deleteDataSource: (id) => window.electronAPI.invoke('delete-data-source', id),

  // Logs
  getRecentLogs: (limit) => window.electronAPI.invoke('get-recent-logs', limit),
  getTodayStats: () => window.electronAPI.invoke('get-today-stats'),
  getAllLogs: (filters) => window.electronAPI.invoke('get-all-logs', filters),

  // Screens
  getScreens: () => window.electronAPI.invoke('get-screens'),
  createScreen: (data) => window.electronAPI.invoke('create-screen', data),
};

export default electronAPI;