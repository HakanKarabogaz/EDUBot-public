/**
 * simple-selector.js
 * Basit ve Etkili Element Bulucu
 * Navigation testi başarılı - Bu sefer element bulma da çalışacak!
 */

class SimpleSelector {
    constructor(page) {
        this.page = page;
        this.timeout = 5000; // Daha hızlı test için 5 saniye
    }

    /**
     * Element Bul - Önce basit selector'larla
     */
    async findElement(selectors) {
        console.log('🔍 SimpleSelector: Element aranıyor...', JSON.stringify(selectors, null, 2));
        const maxAttempts = 4;
        const attemptDelay = 400; // ms
        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                // 0. Primary selector ile bul (optimize edilen selector)
                if (selectors.primary) {
                    console.log(`🎯 Primary selector ile arıyor: ${selectors.primary} (attempt ${attempt}/${maxAttempts})`);
                    const element = await this.page.$(selectors.primary);
                    if (element) {
                        console.log('✅ Primary selector ile bulundu!');
                        return element;
                    }
                }
            // 1. ID ile bul (en güvenilir)
            if (selectors.id) {
                console.log(`🎯 ID ile arıyor: #${selectors.id}`);
                const element = await this.page.$(`#${selectors.id}`);
                if (element) {
                    console.log('✅ ID ile bulundu!');
                    return element;
                }
            }

            // 2. Name ile bul
            if (selectors.name) {
                console.log(`🎯 Name ile arıyor: [name="${selectors.name}"]`);
                const element = await this.page.$(`[name="${selectors.name}"]`);
                if (element) {
                    console.log('✅ Name ile bulundu!');
                    return element;
                }
            }

            // 3. CSS Selector ile bul
            if (selectors.css) {
                console.log(`🎯 CSS ile arıyor: ${selectors.css}`);
                const element = await this.page.$(selectors.css);
                if (element) {
                    console.log('✅ CSS ile bulundu!');
                    return element;
                }
            }

            // 4. Text içeriği ile bul (basit versiyon)
            if (selectors.text) {
                console.log(`🎯 Text ile arıyor: "${selectors.text}"`);
                const element = await this.page.$x(`//*[contains(text(), "${selectors.text}")]`);
                if (element && element.length > 0) {
                    console.log('✅ Text ile bulundu!');
                    return element[0];
                }
            }

            // 5. XPath ile bul
            if (selectors.xpath) {
                console.log(`🎯 XPath ile arıyor: ${selectors.xpath}`);
                const elements = await this.page.$x(selectors.xpath);
                if (elements && elements.length > 0) {
                    console.log('✅ XPath ile bulundu!');
                    return elements[0];
                }
            }
                // not found, wait a bit and retry
                console.log(`❌ Element bulunamadı - ${attempt} denemesi başarısız`);
                if (attempt < maxAttempts) await new Promise(r => setTimeout(r, attemptDelay));
            }
            console.log('❌ Hiçbir selector ile element bulunamadı (tüm denemeler bitti)');
            return null;

        } catch (error) {
            console.error('🚨 SimpleSelector Error:', error.message);
            return null;
        }
    }

    /**
     * Element'e tıkla
     */
    async clickElement(selectors, timeout = 30000) {
        try {
            const element = await this.findElement(selectors, timeout);
            
            if (!element) {
                throw new Error('Element not found for clicking');
            }

            // Element'e scroll et
            await element.scrollIntoView();
            
            // Tıkla
            await element.click();
            
            console.log('✅ Element clicked successfully');
            return true;
        } catch (error) {
            console.error('❌ Click failed:', error.message);
            return false;
        }
    }

    /**
     * Element'e text yaz
     */
    async typeInElement(selectors, text) {
        const element = await this.findElement(selectors);
        if (element) {
            console.log(`⌨️ "${text}" yazılıyor...`);
            
            // Önce tıkla (focus)
            await element.click();
            console.log('🎯 Element\'e tiklandi (focus)');
            
            // Mevcut içeriği temizle
            await element.evaluate(el => el.value = '');
            console.log('🧹 Mevcut icerik temizlendi');
            
            // Metni yaz
            try {
                await element.type(text, { delay: 100 }); // Yavaş yazma
            } catch (e) {
                console.warn('⚠️ element.type başarısız, fallback olarak page.type kullanılıyor:', e.message);
                await this.page.type(selectors.primary || 'body', text, { delay: 100 });
            }
            console.log(`✅ "${text}" yazıldı`);
            
            // Yazılan değeri kontrol et
            const writtenValue = await element.evaluate(el => el.value);
            console.log(`🔍 Input\'taki deger: "${writtenValue}"`);
            
            return true;
        }
        console.log('❌ Yazılacak element bulunamadı - ekran görüntüsü alınıyor');
        try {
            await this.page.screenshot({ path: 'tmp/element_not_found.png', fullPage: true });
            console.log('📸 Ekran görüntüsü saved: tmp/element_not_found.png');
        } catch (e) {}
        return false;
    }

    /**
     * Element'e Enter bas
     */
    async pressEnter(selectors) {
        const element = await this.findElement(selectors);
        if (element) {
            await element.press('Enter');
            console.log('✅ Enter basıldı');
            return true;
        }
        console.log('❌ Enter basılacak element bulunamadı');
        return false;
    }

    /**
     * Element görünür mü kontrol et
     */
    async isVisible(selectors) {
        const element = await this.findElement(selectors);
        if (element) {
            const isVisible = await element.evaluate(el => {
                return el.offsetParent !== null && 
                       el.offsetWidth > 0 && 
                       el.offsetHeight > 0;
            });
            console.log(`🔍 Element görünürlük: ${isVisible}`);
            return isVisible;
        }
        console.log('❌ Element bulunamadı, görünürlük kontrol edilemedi');
        return false;
    }

    /**
     * Selectorları optimize et (SmartSelector uyumluluğu için)
     * Workflow-executor bu methodu bekliyor
     */
    optimizeSelectors(selectors) {
        console.log('🔧 SimpleSelector: Selectorlar optimize ediliyor...');
        
        // Eğer string ise JSON parse et
        if (typeof selectors === 'string') {
            try {
                selectors = JSON.parse(selectors);
            } catch (e) {
                console.log('⚠️ JSON parse hatası, string olarak kullanılacak');
                return { primary: selectors };
            }
        }

        // Basit optimizasyon - aynısını döndür
        console.log('✅ Selectorlar optimize edildi:', JSON.stringify(selectors, null, 2));
        return selectors;
    }
}

module.exports = SimpleSelector;