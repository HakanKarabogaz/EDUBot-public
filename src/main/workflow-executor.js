/**
 * workflow-executor.js
 * Workflow Execution Engine - Core Business Logic
 * 
 * Görevler:
 * - Workflow'ları çalıştırma
 * - Step'leri sırayla işleme
 * - Data source'lardan veri okuma
 * - Browser automation
 * - Error handling & retry logic
 * - Execution logging
 */

const BrowserController = require('./browser-controller');
const SimpleSelector = require('./simple-selector'); // Yeni basit selector
const DatabaseManager = require('./database');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

class WorkflowExecutor extends EventEmitter {
    constructor() {
        super(); // EventEmitter constructor
        this.browser = null;
        this.selector = null;
        this.db = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentWorkflowId = null;
        this.currentStepIndex = 0;
        this.executionLogId = null;
        this.executionContext = {}; // Execute script sonuçlarını sakla
    }

    /**
     * Detect login status based on DOM heuristics
     */
    async isLoggedIn() {
        try {
            return await this.browser.evaluate(() => {
                try {
                    // If there is a clear logout link or text, assume logged in
                    const anchors = Array.from(document.querySelectorAll('a'));
                    for (const a of anchors) {
                        const t = (a.innerText || '').trim().toLowerCase();
                        if (/çıkış|logout|sign out|oturumu kapat/i.test(t)) return true;
                    }

                    // Common profile areas
                    const profile = document.querySelector('[class*="user"], [id*="user"], [class*="profile"], .navbar-user, .profile-menu');
                    if (profile && (profile.textContent || '').trim().length > 0) return true;

                    // If login form elements are present, not logged in
                    if (document.querySelector('input[type="password"], input[name*="password"], form[action*="login"], form[action*="authenticate"]')) return false;

                    // If OTP / verification code inputs are present, not logged in (2FA)
                    if (document.querySelector('input[name*="code"], input[name*="otp"], input[id*="code"], input[id*="otp"], input[placeholder*="kod"], input[placeholder*="Doğrul"], input[placeholder*="OTP"], input[name*="pin"], input[name*="verification"]')) return false;

                    // Fallback: if page contains no obvious login form, assume logged-in for auto-resume
                    return true;
                } catch (e) {
                    return false;
                }
            });
        } catch (e) {
            return false;
        }
    }

    /**
     * Wait for login to be detected in DOM
     */
    async waitForLoginToComplete(timeout = 2 * 60 * 1000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                if (await this.isLoggedIn()) return true;
            } catch (e) {
                // ignore
            }
            await this.sleep(1000);
        }
        return false;
    }

    /**
     * Detect login state by checking for common DOM markers (logout link, user nav, etc.)
     */
    async isLoggedIn() {
        try {
            const res = await this.browser.evaluate(() => {
                // heuristic: presence of a logout link, user menu, or non-login forms
                const logout = document.querySelector('a[href*="logout"], a[ng-click*="logout"], .user-menu');
                if (logout) return true;
                // also check for absence of typical login form inputs
                const loginForm = document.querySelector('form#login, input[type="password"]');
                if (!loginForm) return true;
                return false;
            });
            return !!res;
        } catch (e) {
            return false;
        }
    }

    /**
     * Wait for login to complete by polling `isLoggedIn`.
     */
    async waitForLoginToComplete(targetUrl, timeout = 120000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const ok = await this.isLoggedIn();
            if (ok) return true;
            await this.sleep(1000);
        }
        throw new Error('Login wait timeout');
    }

    /**
     * Strip UTF-8 BOM if present
     */
    stripBOM(str) {
        if (!str || typeof str !== 'string') return str;
        if (str.charCodeAt(0) === 0xFEFF) return str.slice(1);
        // also handle common BOM byte sequence when string was mis-decoded
        if (str.startsWith('\uFEFF')) return str.replace(/\uFEFF/, '');
        return str;
    }

    /**
     * Safe JSON.parse which strips BOM and trims before parsing.
     * Returns parsed object or null on failure.
     */
    safeParseJson(raw) {
        if (raw === null || typeof raw === 'undefined') return null;
        if (typeof raw !== 'string') return null;
        let s = raw.trim();
        s = this.stripBOM(s);
        try {
            return JSON.parse(s);
        } catch (e) {
            return null;
        }
    }

    /**
     * Initialize executor
     * @param {DatabaseManager} dbInstance - Database instance from main process
     */
    async initialize(dbInstance) {
        try {
            console.log('🔧 Initializing Workflow Executor...');
            
            // Database instance'ını main process'den al
            // Accept either a DatabaseManager instance or a path string.
            if (!dbInstance) {
                throw new Error('Database instance or path must be provided to WorkflowExecutor.initialize');
            }

            if (typeof dbInstance === 'string') {
                // dbInstance is actually the DB path - create and init DatabaseManager
                const DatabaseManager = require('./database');
                this.db = new DatabaseManager(dbInstance);
                await this.db.init();
            } else {
                // Assume it's already a DatabaseManager-like instance
                this.db = dbInstance;
            }

            // Browser controller
            this.browser = new BrowserController();

            console.log('✅ Workflow Executor initialized');
        } catch (error) {
            console.error('❌ Executor initialization failed:', error);
            throw error;
        }
    }

    /**
     * Workflow durumunu sıfırla
     */
    resetState() {
        console.log('🔄 Workflow state resetting...');
        this.isRunning = false;
        this.isPaused = false;
        this.currentWorkflowId = null;
        this.currentStepIndex = 0;
        console.log('✅ Workflow state reset');
    }

    /**
     * Workflow çalıştır
     * @param {number} workflowId - Workflow ID
     * @param {number} dataSourceId - Data source ID
     * @param {Object} options - Execution options
     */
    async executeWorkflow(workflowId, dataSourceId, options = {}) {
        if (this.isRunning) {
            throw new Error('Another workflow is already running');
        }

        try {
            this.isRunning = true;
            this.isPaused = false;
            this.currentWorkflowId = workflowId;
            this.currentStepIndex = 0;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 Starting Workflow Execution`);
            console.log(`Workflow ID: ${workflowId}`);
            console.log(`Data Source ID: ${dataSourceId}`);
            console.log(`${'='.repeat(60)}\n`);

            // Workflow bilgilerini al
            const workflow = await this.db.getWorkflow(workflowId);
            if (!workflow) {
                throw new Error(`Workflow not found: ${workflowId}`);
            }

            // Step'leri al (sıralı)
            const steps = await this.db.getStepsByWorkflow(workflowId);
            if (steps.length === 0) {
                throw new Error('No steps found in workflow');
            }

            console.log(`📋 Workflow: ${workflow.name}`);
            console.log(`📊 Total Steps: ${steps.length}`);
            console.log(`🎯 Target URL: ${workflow.target_url}\n`);

            // Data source'dan kayıtları al
            const records = await this.loadDataSource(dataSourceId);
            console.log(`📦 Records to process: ${records.length}\n`);

            // Execution log oluştur - workflow başlatma
            this.executionLogId = await this.db.createExecutionLog(
                workflowId, 
                null, // step_id = null for workflow start
                null, // record_index = null for workflow start
                'started', 
                `Workflow started with ${records.length} records`, 
                null, 
                Date.now()
            );

            // Browser'ı başlat (güvenli mod - login bilgileri kaydedilmez)
            await this.browser.launch(options.browserOptions || {});
            this.selector = new SimpleSelector(this.browser.getPage()); // Yeni basit selector

            // İlk sayfaya git
            await this.browser.navigateTo(workflow.target_url);
            await this.browser.wait(2000); // Sayfa yüklenmesini bekle

            // Login kontrolü
            const currentUrl = this.browser.getCurrentUrl();
            if (currentUrl.includes('login') || currentUrl.includes('auth') || currentUrl.includes('ekampus')) {
                console.log('🔐 LOGIN SAYFASI TESPİT EDİLDİ!');
                console.log('🛡️ GÜVENLİK: EDUBot login bilgilerinizi kaydetmez');
                console.log('📋 YAPILMASI GEREKENLER:');
                console.log('   1. Açık browser\'da manuel login yapın');
                console.log('   2. Login olduktan sonra hedef sayfaya gidin');
                console.log('   3. EDUBot\'ta "Devam Et" butonuna tıklayın');
                console.log('⏸️ İşlem duraklatıldı - kullanıcı müdahalesi bekleniyor...');
                
                // Execution'ı duraklat
                this.isPaused = true;
                // Mark this pause as login-related so we can auto-resume when user completes login
                this._loginPause = true;
                
                // UI'ye bildir
                this.emit('login-required', {
                    message: 'Login gerekli - güvenliğiniz için manuel login yapın',
                    currentUrl: currentUrl,
                    targetUrl: workflow.target_url
                });

                // Auto-resume is disabled by default in manual mode; the app should
                // trigger resume via the UI after login. If you need auto-resume, set
                // options.autoResumeOnLogin = true when calling executeWorkflow.
                if (options && options.autoResumeOnLogin === true) {
                    (async () => {
                        const timeout = (options && options.loginAutoResumeTimeout) || 2 * 60 * 1000; // default 2dk
                        console.log('🔎 Auto-resume watcher (DOM-based login detection) started (timeout ' + timeout + 'ms)');
                        const logged = await this.waitForLoginToComplete(timeout);
                        if (logged) {
                            console.log('▶️ Login detected via DOM - navigating to target and resuming workflow');
                            try {
                                await this.browser.navigateTo(workflow.target_url);
                            } catch (e) {
                                console.warn('  ⚠️ Target navigation failed after login:', e.message);
                            }
                            this._loginPause = false;
                            this.isPaused = false;
                            this.emit('login-auto-resume', { currentUrl: this.browser.getCurrentUrl() });
                        } else {
                            console.log('⏱️ Auto-resume watcher timeout reached; waiting for manual resume');
                        }
                    })();
                } else {
                    console.log('🔒 Auto-resume disabled by options or default; waiting for manual resume');
                }
            }

            // Her kayıt için workflow'u çalıştır
            let successCount = 0;
            let errorCount = 0;
            let isLoggedIn = false; // Login durumunu takip et

            for (let i = 0; i < records.length; i++) {
                if (!this.isRunning) {
                    console.log('⏹️ Execution stopped by user');
                    break;
                }

                // Pause kontrolü
                while (this.isPaused) {
                    await this.sleep(500);
                }

                const record = records[i];
                console.log(`\n${'─'.repeat(60)}`);
                console.log(`📝 Processing Record ${i + 1}/${records.length}`);
                console.log(`${'─'.repeat(60)}`);

                try {
                    // İlk kayıt için tüm step'leri çalıştır (navigate + login)
                    // Diğer kayıtlar için sadece login gerektirmeyen step'leri çalıştır
                    if (i === 0) {
                        // İlk kayıt: Tüm step'leri çalıştır
                        await this.executeSteps(steps, record);
                        isLoggedIn = true;
                        console.log(`🔓 Login completed for session`);
                    } else {
                        // Sonraki kayıtlar: Login step'lerini atla
                        const dataProcessingSteps = steps.filter(step => 
                            step.action_type !== 'navigate' && 
                            step.action_type !== 'wait_for_user'
                        );
                        
                        if (dataProcessingSteps.length > 0) {
                            console.log(`📊 Processing data for record ${i + 1} (login already done)`);
                            await this.executeSteps(dataProcessingSteps, record);
                        } else {
                            console.log(`✅ Record ${i + 1} processed (no additional steps needed)`);
                        }
                    }

                    successCount++;
                    console.log(`✅ Record ${i + 1} processed successfully`);

                    // Queue'dan sil
                    await this.db.deleteFromQueue(record.id);

                } catch (error) {
                    errorCount++;
                    console.error(`❌ Record ${i + 1} failed:`, error.message);

                    // Queue'da error olarak işaretle
                    await this.db.updateQueueStatus(record.id, 'failed', error.message);
                }

                // Execution log güncelle
                await this.db.updateExecutionLog(this.executionLogId, {
                    processed_records: i + 1,
                    success_count: successCount,
                    error_count: errorCount
                });

                // No background auto-resume watcher in manual mode.
                // Kayıtlar arası bekleme (rate limiting)
                if (i < records.length - 1 && options.delayBetweenRecords) {
                    console.log(`⏳ Waiting ${options.delayBetweenRecords}ms before next record...`);
                    await this.sleep(options.delayBetweenRecords);
                }
            }

            // Execution tamamlandı
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ Workflow Execution Completed`);
            console.log(`Success: ${successCount} | Errors: ${errorCount}`);
            console.log(`${'='.repeat(60)}\n`);

            // Log'u tamamla
            await this.db.updateExecutionLog(this.executionLogId, {
                status: 'completed',
                completed_at: new Date().toISOString()
            });

            return {
                success: true,
                totalRecords: records.length,
                successCount,
                errorCount
            };

        } catch (error) {
            console.error('❌ Workflow execution failed:', error);

            // Log'u error olarak işaretle
            if (this.executionLogId) {
                await this.db.updateExecutionLog(this.executionLogId, {
                    status: 'error',
                    error_message: error.message,
                    completed_at: new Date().toISOString()
                });
            }

            throw error;

        } finally {
            // Cleanup
            await this.cleanup();
        }
    }

    /**
     * Step'leri sırayla çalıştır
     * @param {Array} steps - Step listesi
     * @param {Object} record - Mevcut kayıt
     */
    async executeSteps(steps, record) {
        for (let i = 0; i < steps.length; i++) {
            if (!this.isRunning) break;

            while (this.isPaused) {
                await this.sleep(500);
            }

            this.currentStepIndex = i;
            const step = steps[i];

            console.log(`\n  Step ${i + 1}/${steps.length}: ${step.action_type.toUpperCase()}`);
            console.log(`  Description: ${step.description || 'N/A'}`);

            try {
                await this.executeStep(step, record);
                console.log(`  ✅ Step completed`);

                // Step'ler arası bekleme
                if (step.wait_after && step.wait_after > 0) {
                    console.log(`  ⏳ Waiting ${step.wait_after}ms...`);
                    await this.sleep(step.wait_after);
                }

            } catch (error) {
                console.error(`  ❌ Step failed:`, error.message);

                // Retry logic
                if (step.retry_count && step.retry_count > 0) {
                    console.log(`  🔄 Retrying step (max ${step.retry_count} attempts)...`);
                    
                    for (let retry = 1; retry <= step.retry_count; retry++) {
                        try {
                            console.log(`  🔄 Retry attempt ${retry}/${step.retry_count}`);
                            await this.sleep(1000); // Retry öncesi bekleme
                            await this.executeStep(step, record);
                            console.log(`  ✅ Step succeeded on retry ${retry}`);
                            break;
                        } catch (retryError) {
                            if (retry === step.retry_count) {
                                throw new Error(`Step failed after ${step.retry_count} retries: ${retryError.message}`);
                            }
                        }
                    }
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Tek bir step'i çalıştır
     * @param {Object} step - Step objesi
     * @param {Object} record - Mevcut kayıt
     */
    async executeStep(step, record) {
        // Config parsing - handle null/undefined using safe parser
        let config = {};
        if (step.config) {
            const parsed = this.safeParseJson(step.config);
            config = parsed || {};
        }

        // Selector parsing - handle both string and JSON formats
        let selectors;
        if (step.selector) {
            const parsedSel = this.safeParseJson(step.selector);
            if (parsedSel) selectors = parsedSel;
            else selectors = { primary: step.selector };
        } else {
            selectors = { primary: '' };
        }

        // Selector template variables'ı replace et
        if (selectors.primary) {
            selectors.primary = this.replaceTemplateVariables(selectors.primary, record);
        }
        if (selectors.alternatives) {
            selectors.alternatives = selectors.alternatives.map(alt => 
                this.replaceTemplateVariables(alt, record)
            );
        }

        // Selector'ı optimize et
        const optimizedSelectors = this.selector.optimizeSelectors(selectors);

        switch (step.action_type) {
            case 'navigate':
                config.url = step.value; // URL'i step.value'dan al
                await this.actionNavigate(config);
                break;

            case 'click':
                await this.actionClick(optimizedSelectors, config);
                break;

            case 'type':
                await this.actionType(optimizedSelectors, config, record, step);
                break;

            case 'select':
                // Template variables'ı replace et
                if (config.value) {
                    config.value = this.replaceTemplateVariables(config.value, record);
                }
                await this.actionSelect(optimizedSelectors, config, record);
                break;

            case 'wait':
                await this.actionWait(config);
                break;

            case 'wait_for_element':
                await this.actionWaitForElement(optimizedSelectors, config);
                break;

            case 'screenshot':
                await this.actionScreenshot(config, record);
                break;

            case 'execute_script':
                // Template variables'ı replace et
                if (config.script) {
                    config.script = this.replaceTemplateVariables(config.script, record);
                }
                // Pass the raw step object so actionExecuteScript can inspect the original
                // `step.config` string in case JSON.parse had failed earlier and we need
                // to attempt a best-effort extraction of the script.
                await this.actionExecuteScript(config, record, step);
                break;

            case 'wait_for_user':
                await this.actionWaitForUser(step, config);
                break;

            default:
                throw new Error(`Unknown action type: ${step.action_type}`);
        }
    }

    /**
     * Action: Navigate
     */
    async actionNavigate(config) {
        const url = config.url;
        console.log(`  🌐 Navigating to: ${url}`);
        await this.browser.navigateTo(url, config.waitUntil || 'networkidle2');
    }

    /**
     * Action: Click
     */
async actionClick(selectors, config) {
    console.log(`  👆 Clicking element...`);
    
    // Dropdown elementleri için özel bekleme
    if (selectors.primary && selectors.primary.includes('dropdown-menu')) {
        console.log('  🔄 Dropdown element detected, waiting for visibility...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const element = await this.selector.findElement(selectors, config.timeout || 30000);
    
    if (!element) {
        throw new Error('Element not found for clicking');
    }

    // Element'in clickable olduğunu kontrol et
    const isVisible = await element.isIntersectingViewport();
    if (!isVisible) {
        console.log('  📍 Element not visible, scrolling into view...');
        await element.scrollIntoView();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Element'e tıkla
    try {
        await element.click();
        console.log('✅ Element clicked successfully');
    } catch (error) {
        // Alternatif click yöntemi
        console.log('  🔄 Trying alternative click method...');
        await element.evaluate(el => el.click());
        console.log('✅ Element clicked with evaluate method');
    }
}

    /**
     * Replace template variables in value string
     */
    replaceTemplateVariables(value, record) {
        if (!value || !value.includes('{{')) return value;
        
        let result = value;
        const templatePattern = /\{\{([^}]+)\}\}/g;
        let match;
        
        while ((match = templatePattern.exec(value)) !== null) {
            const variableName = match[1].trim();
            let replacement = '';
            
            // Önce execution context'ten bak (execute_script sonuçları için)
            if (this.executionContext && this.executionContext[variableName]) {
                replacement = this.executionContext[variableName];
            }
            // Sonra record'dan bak
            else if (record[variableName]) {
                replacement = record[variableName];
            }
            
            result = result.replace(match[0], replacement);
        }
        
        return result;
    }

    /**
     * Action: Type
     */
    async actionType(selectors, config, record, step) {
        // Data mapping - step.value'dan değeri al
        let value = step.value || '';
        
        // Template variables'ı replace et ({{name}} -> record.name)
        value = this.replaceTemplateVariables(value, record);

        console.log(`  ⌨️ Typing: ${value}`);
        
        // Wait a little longer for the input to become available (network/Angular delays)
        const waitTimeout = Math.max(config.timeout || 30000, 5000);
        let element = await this.selector.findElement(selectors, waitTimeout);
        // If not found, allow a short retry loop
        if (!element) {
            console.log('  ⚠️ Element bulunamadı, kısa süre yeniden denenecek...');
            for (let t = 0; t < 5; t++) {
                await this.sleep(500);
                element = await this.selector.findElement(selectors, waitTimeout);
                if (element) break;
            }
        }
        
        if (!element) {
            throw new Error(`Element bulunamadı for selector ${JSON.stringify(selectors)} - check page state or selectors.`);
        }
        // Mevcut değeri temizle
        await element.click({ clickCount: 3 });
        await this.browser.getPage().keyboard.press('Backspace');
        
        // Yeni değeri yaz
        await element.type(value, { delay: config.typeDelay || 50 });
    }

    /**
     * Action: Select
     */
    async actionSelect(selectors, config, record) {
        // Data mapping
        let value = config.value;
        
        // Template variables'ı replace et ({{letter_grade}} -> record.letter_grade)
        if (value) {
            value = this.replaceTemplateVariables(value, record);
        }
        
        if (config.dataField && record[config.dataField]) {
            value = record[config.dataField];
        }

        console.log(`  📋 Selecting: ${value}`);
        
        const element = await this.selector.findElement(selectors, config.timeout);
        
        // Select element'i seç
        await this.browser.getPage().evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, element, value);
    }

    /**
     * Action: Wait
     */
    async actionWait(config) {
        const duration = config.duration || 1000;
        console.log(`  ⏳ Waiting ${duration}ms...`);
        await this.sleep(duration);
    }

    /**
     * Action: Wait for Element
     */
    async actionWaitForElement(selectors, config) {
        console.log(`  ⏳ Waiting for element...`);
        await this.selector.findElement(selectors, config.timeout);
    }

    /**
     * Action: Screenshot
     */
    async actionScreenshot(config, record) {
        const filename = config.filename || `screenshot_${Date.now()}.png`;
        const filepath = path.join(config.directory || './screenshots', filename);
        
        console.log(`  📸 Taking screenshot: ${filepath}`);
        
        // Directory oluştur
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        
        await this.browser.screenshot(filepath, config.options || {});
    }

    /**
     * Action: Execute Script
     */
    async actionExecuteScript(config, record, step = null) {
        console.log(`  🔧 Executing custom script...`);

        // 1. Scripti doğrudan config.script'ten al
        let rawScript = (config.script || '').trim();
        console.log('DEBUG: config.script:', rawScript);
        let cleanedScript = rawScript.replace(/;[\s\r\n]*$/g, '');

        // 2. Eğer script boşsa, önce tekrar JSON.parse ile parse etmeye çalış
        if ((!cleanedScript || cleanedScript.length === 0) && step && step.config && typeof step.config === 'string') {
            console.warn('  ⚠️ cleaned script is empty; attempting fallback extraction from step.config');
            try {
                let parsed = null;
                try {
                    parsed = JSON.parse(step.config);
                } catch (jsonErr) {
                    // JSON.parse başarısızsa regex fallback'e geç
                }
                if (parsed && parsed.script) {
                    cleanedScript = String(parsed.script).trim();
                    // preserve storeAs when found in parsed step.config
                    if (parsed.storeAs) config.storeAs = parsed.storeAs;
                    console.log('  ✅ Fallback (JSON.parse) ile script bulundu, uzunluk:', cleanedScript.length);
                }
            } catch (e) {
                // ignore, regex fallback'e geç
            }
        }

        // 3. Hala script boşsa, regex ile greedy modda script'i çıkart
        if ((!cleanedScript || cleanedScript.length === 0) && step && step.config && typeof step.config === 'string') {
            try {
                // Greedy: ilk "script":" ile başlar, ilk "storeAs" veya son "} den önce biter
                const m = step.config.match(/"script"\s*:\s*"([\s\S]*?)"\s*,\s*"storeAs"/);
                if (m && m[1]) {
                    let extracted = m[1];
                    // Unescape common JSON escapes
                    extracted = extracted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    extracted = extracted.trim();
                    if (extracted.length > 0) {
                        cleanedScript = extracted.replace(/;[\s\r\n]*$/g, '');
                        // attempt to extract storeAs from the raw string
                        try {
                            const storeMatch = step.config.match(/"storeAs"\s*:\s*"([^\"]+)"/);
                            if (storeMatch && storeMatch[1]) config.storeAs = storeMatch[1];
                        } catch (e) {}
                        console.log('  ✅ Fallback (regex) ile script bulundu, uzunluk:', cleanedScript.length);
                    }
                }
            } catch (e) {
                console.error('  ❌ Regex fallback extraction failed:', String(e));
            }
        }

        // 3c. Hala script boşsa, step.config içinde ham JS olabilir (legacy). Eğer
        // config string'i doğrudan (function... veya (async function...) ile başlıyorsa
        // bunu script olarak kabul edelim.
        if ((!cleanedScript || cleanedScript.length === 0) && step && step.config && typeof step.config === 'string') {
            const confTrim = step.config.trim();
            if (/^\(async function|^\(function|^function\s+/i.test(confTrim)) {
                cleanedScript = confTrim.replace(/;[\s\r\n]*$/g, '');
                console.log('  ✅ Fallback (raw step.config) ile script bulundu, uzunluk:', cleanedScript.length);
            }
        }


        // 3b. Hala script boşsa, step.value içinde script olabilir (legacy)
        if ((!cleanedScript || cleanedScript.length === 0) && step && step.value && typeof step.value === 'string') {
            const val = step.value.trim();
            // Heuristics: başlangıçta IIFE veya function ya da DOM sorguları içeriyorsa script say
            if (/^(\(async|\(function|function\s+|async\s+function)/i.test(val) || val.includes('querySelector') || val.includes('getAttribute') || val.includes('document.')) {
                cleanedScript = val.replace(/;[\s\r\n]*$/g, '');
                console.log('  ✅ Fallback (step.value) ile script bulundu, uzunluk:', cleanedScript.length);
            }
        }
        // 4. Debug: fallback sonrası scriptin ilk 100 karakterini göster
        if (!cleanedScript || cleanedScript.length === 0) {
            console.log('DEBUG: fallback extracted script: (boş)');
        } else {
            console.log('DEBUG: fallback extracted script (ilk 100):', cleanedScript.substring(0, 100));
        }

    // 5. Scripti temizle ve BOM'dan arındır
    cleanedScript = this.stripBOM(cleanedScript);

        // 6. Normalize SQL-escaped single quotes ('' -> ') and clean CRLF
        try {
            // keep existing empty string literals (''), do not replace them globally
            cleanedScript = cleanedScript.replace(/\r\n/g, '\n');
            cleanedScript = cleanedScript.trim();
        } catch (e) {
            // keep original if replacement fails
        }

        // 7. Unescape JSON-style escapes (\" -> ") if present. We attempt a JSON.parse
        // based decode first (robust), and fall back to manual replacements.
        try {
            if (cleanedScript.includes('\\"') || cleanedScript.includes('\\\\')) {
                const wrappedJson = '"' + cleanedScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
                cleanedScript = JSON.parse(wrappedJson);
            }
        } catch (e) {
            // fallback manual normalization
            try {
                cleanedScript = cleanedScript.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            } catch (e2) {
                // keep original
            }
        }

        // 7. If the script is an IIFE that ends with '()' and begins with an
        // anonymous function expression, rewrite the trailing '()' to pass the
        // runner-provided parameters (record, executionContext). This allows
        // legacy IIFEs that expect parameters to receive them.
        let scriptToRun = cleanedScript;
        try {
            const trimmed = (scriptToRun || '').trim();
            if (/^\(?\s*(?:async\s+)?function/i.test(trimmed) && /\(\s*\)\s*;?\s*$/.test(trimmed)) {
                scriptToRun = scriptToRun.replace(/\(\s*\)\s*;?\s*$/, '(record, executionContext)');
            }
        } catch (e) {
            // ignore and use original cleanedScript
        }

        // 8. Wrap script so that if it's a function expression we call it with
        // the 'record' argument; if it's an expression, return its value.
        // This keeps backwards compatibility with both styles.
        const wrapped = `return (typeof (${scriptToRun}) === 'function' ? (${scriptToRun})(record, executionContext) : (${scriptToRun}));`;
        try {
            console.log(`  🧪 Wrapped script preview (start):`, wrapped.substring(0, 800));
        } catch (e) {}

        let result;
        try {
            if (!cleanedScript || cleanedScript.length === 0) {
                throw new Error('Empty script after cleaning - aborting evaluate');
            }
            result = await this.browser.evaluate((scriptStr, recordData, executionContext) => {
                const script = new Function('record', 'executionContext', scriptStr);
                return script(recordData, executionContext);
            }, wrapped, record, this.executionContext);
        } catch (e) {
            try {
                console.error('  ❌ Evaluate failed - wrapped script (preview 2000 chars):', wrapped.substring(0, 2000));
            } catch (e2) {}
            throw e;
        }

        console.log(`  ✅ Script result (raw):`, result);

        // DOM diagnostics removed (was temporary for debugging step 5)

        // Sonuçları güvenli şekilde logla ve kaydet
        let serializableResult = result;
        try {
            JSON.stringify(result);
        } catch (e) {
            try {
                if (result && typeof result === 'object') {
                    serializableResult = {};
                    Object.getOwnPropertyNames(result).forEach(k => {
                        try { serializableResult[k] = result[k]; } catch (e2) { serializableResult[k] = String(result[k]); }
                    });
                } else {
                    serializableResult = String(result);
                }
            } catch (e2) {
                serializableResult = String(result);
            }
        }

        try { console.log(`  📊 Script details:`, JSON.stringify(serializableResult, null, 2)); } catch (e) { console.log('  📊 Script details (toString):', String(serializableResult)); }

        if (config.storeAs && typeof serializableResult !== 'undefined') {
            if (!this.executionContext) this.executionContext = {};
            this.executionContext[config.storeAs] = serializableResult;
            console.log(`  💾 Stored result as '${config.storeAs}':`, serializableResult);
        }
        return result;
    }

    /**
     * Data source'dan kayıtları yükle
     * @param {number} dataSourceId - Data source ID
     */
    async loadDataSource(dataSourceId) {
        const dataSource = await this.db.getDataSource(dataSourceId);
        if (!dataSource) {
            throw new Error(`Data source not found: ${dataSourceId}`);
        }

        // Data source'dan direkt veri al (queue sistem yok)
        let records = await this.db.getDataSourceData(dataSourceId);

        // If the stored data is not an array (for example CSV/JSON dataSources often store a config object),
        // try to load using DataMapper which knows how to read CSV/JSON files.
        if (!Array.isArray(records)) {
            try {
                const DataMapper = require('./data-mapper');
                const dm = new DataMapper(this.db.dbPath);
                await dm.initialize();
                // DataMapper.loadDataSource expects a dataSource id (it will call db.getDataSource internally)
                records = await dm.loadDataSource(dataSourceId);
            } catch (e) {
                console.warn('⚠️ Fallback to DataMapper failed:', e.message);
            }
        }

        if (!records || !Array.isArray(records) || records.length === 0) {
            throw new Error('No data found in data source');
        }

        console.log(`📊 Loaded ${Array.isArray(records) ? records.length : 0} records from data source`);
        return records;
    }

    /**
     * Execution'ı duraklat
     */
    pause() {
        if (this.isRunning && !this.isPaused) {
            this.isPaused = true;
            console.log('⏸️ Execution paused');
        }
    }

    /**
     * Execution'ı devam ettir
     */
    resume() {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            console.log('▶️ Execution resumed');
        }
    }

    /**
     * Execution'ı durdur
     */
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            console.log('⏹️ Execution stopped');
        }
    }

    /**
     * Mevcut durumu al
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentWorkflowId: this.currentWorkflowId,
            currentStepIndex: this.currentStepIndex,
            executionLogId: this.executionLogId
        };
    }

    /**
     * Workflow'u durdur
     */
    async stop() {
        try {
            console.log('⏹️ Stopping workflow execution...');
            this.isRunning = false;
            this.isPaused = false;
            
            // Execution log'u güncelle
            if (this.executionLogId) {
                await this.db.updateExecutionLog(this.executionLogId, {
                    status: 'stopped',
                    completed_at: new Date().toISOString()
                });
            }
            
            // Browser'ı kapat
            await this.cleanup();
            
            console.log('✅ Workflow stopped successfully');
        } catch (error) {
            console.error('❌ Failed to stop workflow:', error);
            throw error;
        }
    }

    /**
     * Workflow'u duraklat
     */
    pause() {
        if (this.isRunning) {
            this.isPaused = true;
            console.log('⏸️ Workflow paused');
        }
    }

    /**
     * Workflow'u devam ettir
     */
    resume() {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            console.log('▶️ Workflow resumed');
        }
    }

    /**
     * Cleanup
     */
    async cleanup() {
        try {
            if (this.browser && this.browser.isOpen()) {
                await this.browser.close();
            }
            
            this.isRunning = false;
            this.isPaused = false;
            this.currentWorkflowId = null;
            this.currentStepIndex = 0;
            this.executionLogId = null;
            
            console.log('🧹 Cleanup completed');
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }

    /**
     * Wait for user action (manual login, etc.)
     */
    async actionWaitForUser(step) {
        console.log('⏸️ Kullanıcı müdahalesi bekleniyor:', step.waitMessage || 'Devam etmek için bir tuşa basın...');
        
        // İstatistik güncelle
        await this.updateStepStats(step, 'waiting_for_user');
        
        // Renderer'a kullanıcı müdahalesi gerektiğini bildir
        this.sendToRenderer('workflow-waiting-for-user', {
            message: step.waitMessage || 'Lütfen gerekli işlemi yapın ve devam etmek için tıklayın.',
            stepName: step.name,
            stepIndex: this.currentStepIndex
        });
        
        // Kullanıcı müdahalesini bekle
        return new Promise((resolve) => {
            console.log('🔧 Event listener ekleniyor...');
            
            const handler = () => {
                console.log('🎉 user-continue event yakalandı!');
                this.removeListener('user-continue', handler);
                console.log('✅ Kullanıcı devam etti - WAIT_FOR_USER adımı tamamlandı');
                resolve(true);
            };
            
            this.on('user-continue', handler);
            console.log('✅ Event listener eklendi, bekleniyor...');
        });
    }

    /**
     * Pause execution
     */
    async pauseExecution() {
        this.isPaused = true;
        console.log('⏸️ Workflow execution paused');
    }

    /**
     * Resume execution
     */
    async resumeExecution() {
        this.isPaused = false;
        console.log('▶️ Workflow execution resumed');
    }

    /**
     * Stop execution
     */
    async stopExecution() {
        this.isRunning = false;
        this.isPaused = false;
        
        // Remove all event listeners
        this.removeAllListeners('user-continue');
        
        if (this.browser && this.browser.isOpen()) {
            await this.browser.close();
        }
        
        console.log('⏹️ Workflow execution stopped');
    }

    /**
     * Update step statistics
     */
    async updateStepStats(step, status) {
        try {
            // Bu method step istatistiklerini günceller
            // Şimdilik basit bir implementation yapalım
            console.log(`📊 Step ${step.step_order} status: ${status}`);
            
            // Burada step execution log'u kaydedilebilir
            // await this.db.updateStepExecution(step.id, status);
            
            return true;
        } catch (error) {
            console.error('❌ Update step stats failed:', error);
            return false;
        }
    }

    /**
     * Send message to renderer process
     */
    sendToRenderer(channel, data) {
        try {
            // Electron BrowserWindow'a mesaj gönder
            // Şimdilik console log ile simulate edelim
            console.log(`📡 Sending to renderer [${channel}]:`, data);
            
            // TODO: İleride gerçek Electron IPC implementasyonu eklenebilir
            // if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            //     this.mainWindow.webContents.send(channel, data);
            // }
        } catch (error) {
            console.error('❌ Send to renderer failed:', error);
        }
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = WorkflowExecutor;