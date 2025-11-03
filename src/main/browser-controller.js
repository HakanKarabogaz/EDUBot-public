/**
 * browser-controller.js
 * Puppeteer Wrapper - Web Automation Controller
 */

const puppeteer = require('puppeteer');
const path = require('path');

class BrowserController {
    constructor() {
        this.browser = null;
        this.page = null;
        this.defaultTimeout = 30000; // 30 saniye
        this.isLaunched = false;
    }

    /**
     * Browser'ı başlatır
     * @param {Object} options - Puppeteer launch options
     */
    async launch(options = {}) {
        try {
            // Güvenli Seçenek 1: Mevcut Chrome'a bağlanmayı dene
            let browser = null;
            
            try {
                console.log('🔗 Mevcut Chrome browser\'ına bağlanmaya çalışılıyor...');
                browser = await puppeteer.connect({
                    browserURL: 'http://localhost:9222',
                    defaultViewport: { width: 1366, height: 768 }
                });
                console.log('✅ Mevcut Chrome\'a bağlandı (login bilgileriniz güvende)');
                this.browser = browser;
            } catch (connectError) {
                console.log('❌ Chrome bağlantı hatası:', connectError.message);
                console.log('⚠️ Mevcut Chrome\'a bağlanılamadı, yeni browser başlatılıyor...');
                
                // Güvenli Seçenek 2: Geçici profil (otomatik silinir)
                const defaultOptions = {
                    headless: false, 
                    defaultViewport: { 
                        width: 1366, 
                        height: 768 
                    },
                    // Geçici profil - kapanınca silinir
                    args: [
                        '--incognito', // Gizli mod
                        '--no-first-run',
                        '--no-default-browser-check',
                        '--disable-default-apps',
                        '--disable-extensions',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-blink-features=AutomationControlled'
                    ]
                };

                this.browser = await puppeteer.launch({
                    ...defaultOptions,
                    ...options
                });
                console.log('✅ Geçici browser başlatıldı (veriler kaydedilmez)');
            }

            this.page = await this.browser.newPage();
            this.page.setDefaultTimeout(this.defaultTimeout);

            // User agent ayarla (bot detection bypass)
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );

            // Extra headers
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
            });

            // Console loglarını yakala
            this.page.on('console', msg => {
                console.log('[Browser Console]:', msg.text());
            });

            // Network hatalarını yakala
            this.page.on('requestfailed', request => {
                const failure = request.failure();
                const errorText = failure ? failure.errorText : 'Unknown error';
                console.error('[Network Error]:', request.url(), errorText);
            });

            // Page crash handler
            this.page.on('error', error => {
                console.error('[Page Error]:', error);
            });

            this.isLaunched = true;
            console.log('✅ Browser launched successfully');
            
            return this.page;
        } catch (error) {
            console.error('❌ Browser launch failed:', error);
            throw error;
        }
    }

    /**
     * URL'ye gider
     * @param {string} url - Hedef URL
     * @param {string} waitUntil - Bekleme stratejisi
     */
    async navigateTo(url, waitUntil = 'networkidle2') {
        if (!this.isLaunched) {
            throw new Error('Browser not launched. Call launch() first.');
        }
        
        try {
            console.log(`🌐 Navigating to: ${url}`);
            await this.page.goto(url, {
                waitUntil,
                timeout: this.defaultTimeout
            });
            console.log('✅ Navigation successful');
        } catch (error) {
            console.error('❌ Navigation failed:', error);
            throw error;
        }
    }

    /**
     * Element bekler (görünür olana kadar)
     * @param {string} selector - CSS selector
     * @param {number} timeout - Timeout (ms)
     */
    async waitForElement(selector, timeout = null) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            console.log(`⏳ Waiting for element: ${selector}`);
            const element = await this.page.waitForSelector(selector, {
                visible: true,
                timeout: timeout || this.defaultTimeout
            });
            console.log('✅ Element found');
            return element;
        } catch (error) {
            console.error(`❌ Element not found: ${selector}`);
            throw error;
        }
    }

    /**
     * Element'e tıklar
     * @param {string} selector - CSS selector
     * @param {Object} options - Click options
     */
    async click(selector, options = {}) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            await this.waitForElement(selector);
            console.log(`👆 Clicking: ${selector}`);
            await this.page.click(selector, options);
            await new Promise(resolve => setTimeout(resolve, 500)); // Stabilite için kısa bekleme
            console.log('✅ Click successful');
        } catch (error) {
            console.error(`❌ Click failed: ${selector}`, error);
            throw error;
        }
    }

    /**
     * Text input'a yazar
     * @param {string} selector - CSS selector
     * @param {string} text - Yazılacak metin
     * @param {Object} options - Type options
     */
    async type(selector, text, options = {}) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            await this.waitForElement(selector);
            console.log(`⌨️ Typing into: ${selector}`);
            
            // Mevcut metni temizle
            await this.page.click(selector, { clickCount: 3 });
            await this.page.keyboard.press('Backspace');
            
            // Yeni metni yaz
            await this.page.type(selector, text, { 
                delay: 50, // İnsan gibi yazma hızı
                ...options 
            });
            
            console.log('✅ Type successful');
        } catch (error) {
            console.error(`❌ Type failed: ${selector}`, error);
            throw error;
        }
    }

    /**
     * Dropdown/select seçimi
     * @param {string} selector - CSS selector
     * @param {string} value - Seçilecek değer
     */
    async select(selector, value) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            await this.waitForElement(selector);
            console.log(`📋 Selecting: ${value} in ${selector}`);
            await this.page.select(selector, value);
            console.log('✅ Select successful');
        } catch (error) {
            console.error(`❌ Select failed: ${selector}`, error);
            throw error;
        }
    }

    /**
     * JavaScript çalıştır
     * @param {Function} fn - Çalıştırılacak fonksiyon
     * @param  {...any} args - Fonksiyon argümanları
     */
    async evaluate(fn, ...args) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            return await this.page.evaluate(fn, ...args);
        } catch (error) {
            console.error('❌ Evaluate failed:', error);
            throw error;
        }
    }

    /**
     * Element'in text içeriğini al
     * @param {string} selector - CSS selector
     */
    async getText(selector) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            await this.waitForElement(selector);
            const text = await this.page.$eval(selector, el => el.textContent);
            return text.trim();
        } catch (error) {
            console.error(`❌ Get text failed: ${selector}`, error);
            throw error;
        }
    }

    /**
     * Element'in value değerini al
     * @param {string} selector - CSS selector
     */
    async getValue(selector) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            await this.waitForElement(selector);
            const value = await this.page.$eval(selector, el => el.value);
            return value;
        } catch (error) {
            console.error(`❌ Get value failed: ${selector}`, error);
            throw error;
        }
    }

    /**
     * Element var mı kontrol et
     * @param {string} selector - CSS selector
     */
    async elementExists(selector) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            const element = await this.page.$(selector);
            return element !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Belirli süre bekle
     * @param {number} ms - Milisaniye
     */
    async wait(ms) {
        console.log(`⏳ Waiting ${ms}ms...`);
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Screenshot al
     * @param {string} path - Dosya yolu
     * @param {Object} options - Screenshot options
     */
    async screenshot(path, options = {}) {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            console.log(`📸 Taking screenshot: ${path}`);
            await this.page.screenshot({ 
                path, 
                fullPage: true,
                ...options 
            });
            console.log('✅ Screenshot saved');
        } catch (error) {
            console.error('❌ Screenshot failed:', error);
            throw error;
        }
    }

    /**
     * Sayfayı yenile
     */
    async reload() {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            console.log('🔄 Reloading page...');
            await this.page.reload({ waitUntil: 'networkidle2' });
            console.log('✅ Page reloaded');
        } catch (error) {
            console.error('❌ Reload failed:', error);
            throw error;
        }
    }

    /**
     * Geri git
     */
    async goBack() {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            console.log('⬅️ Going back...');
            await this.page.goBack({ waitUntil: 'networkidle2' });
            console.log('✅ Navigated back');
        } catch (error) {
            console.error('❌ Go back failed:', error);
            throw error;
        }
    }

    /**
     * İleri git
     */
    async goForward() {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        try {
            console.log('➡️ Going forward...');
            await this.page.goForward({ waitUntil: 'networkidle2' });
            console.log('✅ Navigated forward');
        } catch (error) {
            console.error('❌ Go forward failed:', error);
            throw error;
        }
    }

    /**
     * Mevcut URL'i al
     */
    getCurrentUrl() {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        return this.page.url();
    }

    /**
     * Sayfa başlığını al
     */
    async getTitle() {
        if (!this.isLaunched) {
            throw new Error('Browser not launched');
        }
        
        return await this.page.title();
    }

    /**
     * Browser'ı kapat
     */
    async close() {
        if (this.browser) {
            try {
                console.log('🔒 Closing browser...');
                await this.browser.close();
                this.browser = null;
                this.page = null;
                this.isLaunched = false;
                console.log('✅ Browser closed');
            } catch (error) {
                console.error('❌ Browser close failed:', error);
                throw error;
            }
        }
    }

    /**
     * Timeout ayarla
     * @param {number} timeout - Milisaniye
     */
    setTimeout(timeout) {
        this.defaultTimeout = timeout;
        if (this.page) {
            this.page.setDefaultTimeout(timeout);
        }
        console.log(`⏱️ Timeout set to ${timeout}ms`);
    }

    /**
     * Mevcut page'i döndür
     */
    getPage() {
        return this.page;
    }

    /**
     * Browser açık mı kontrol et
     */
    isOpen() {
        return this.isLaunched && this.browser !== null;
    }
}

module.exports = BrowserController;