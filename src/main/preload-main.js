// MAIN IÇINDE TEST PRELOAD
console.log('🔥 MAIN KLASÖRÜNDE TEST PRELOAD ÇALIŞTI! 🔥');

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mainTestAPI', {
    test: () => 'MAIN TEST API ÇALIŞIYOR!'
});

console.log('🔥 MAIN TEST API EXPOSED 🔥');