/**
 * smart-selector.js
 * Multi-Strategy Element Finder - Dinamik ID Çözümü
 * 
 * Strateji Öncelik Sırası:
 * 1. Stable Attributes (name, data-*, aria-*)
 * 2. XPath (relative paths)
 * 3. CSS Selectors (class combinations)
 * 4. Text Content (görünen metin)
 * 5. Position (parent + index)
 */

class SmartSelector {
    constructor(page) {
        this.page = page;
        this.defaultTimeout = 30000;
    }

    /**
     * Element bul - Tüm stratejileri dene
     * @param {Object} selectors - Multi-strategy selector objesi
     * @param {number} timeout - Timeout (ms)
     * @returns {ElementHandle} Bulunan element
     */
    async findElement(selectors, timeout = null) {
        const strategies = [
            { name: 'ID', fn: () => this.findById(selectors) },
            { name: 'Name', fn: () => this.findByName(selectors) },
            { name: 'Stable Attributes', fn: () => this.findByStableAttributes(selectors) },
            { name: 'XPath', fn: () => this.findByXPath(selectors) },
            { name: 'CSS', fn: () => this.findByCSS(selectors) },
            { name: 'Text', fn: () => this.findByText(selectors) },
            { name: 'Position', fn: () => this.findByPosition(selectors) }
        ];

        const startTime = Date.now();
        const maxTime = timeout || this.defaultTimeout;

        while (Date.now() - startTime < maxTime) {
            for (const strategy of strategies) {
                try {
                    console.log(`🔍 Trying strategy: ${strategy.name}`);
                    const element = await strategy.fn();
                    
                    if (element) {
                        console.log(`✅ Element found using: ${strategy.name}`);
                        return element;
                    }
                } catch (error) {
                    // Bu strateji başarısız, sonrakine geç
                    console.log(`⚠️ Strategy ${strategy.name} failed, trying next...`);
                }
            }

            // Kısa bekleme sonra tekrar dene
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        throw new Error(`Element not found after trying all strategies (timeout: ${maxTime}ms)`);
    }

    /**
     * ID ile bul
     */
    async findById(selectors) {
        if (!selectors.id) return null;

        try {
            const element = await this.page.$(`#${selectors.id}`);
            return element;
        } catch (error) {
            return null;
        }
    }

    /**
     * Name attribute ile bul
     */
    async findByName(selectors) {
        if (!selectors.name) return null;

        try {
            const element = await this.page.$(`[name="${selectors.name}"]`);
            return element;
        } catch (error) {
            return null;
        }
    }

    /**
     * Stable attributes ile bul (data-*, aria-*, role, etc.)
     */
    async findByStableAttributes(selectors) {
        if (!selectors.attributes) return null;

        try {
            // data-* attributes
            if (selectors.attributes['data-field']) {
                const element = await this.page.$(`[data-field="${selectors.attributes['data-field']}"]`);
                if (element) return element;
            }

            if (selectors.attributes['data-id']) {
                const element = await this.page.$(`[data-id="${selectors.attributes['data-id']}"]`);
                if (element) return element;
            }

            // aria-* attributes
            if (selectors.attributes['aria-label']) {
                const element = await this.page.$(`[aria-label="${selectors.attributes['aria-label']}"]`);
                if (element) return element;
            }

            if (selectors.attributes['aria-labelledby']) {
                const element = await this.page.$(`[aria-labelledby="${selectors.attributes['aria-labelledby']}"]`);
                if (element) return element;
            }

            // role attribute
            if (selectors.attributes['role']) {
                const element = await this.page.$(`[role="${selectors.attributes['role']}"]`);
                if (element) return element;
            }

            // placeholder
            if (selectors.attributes['placeholder']) {
                const element = await this.page.$(`[placeholder="${selectors.attributes['placeholder']}"]`);
                if (element) return element;
            }

            // title
            if (selectors.attributes['title']) {
                const element = await this.page.$(`[title="${selectors.attributes['title']}"]`);
                if (element) return element;
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * XPath ile bul
     */
    async findByXPath(selectors) {
        if (!selectors.xpath) return null;

        try {
            const elements = await this.page.$x(selectors.xpath);
            return elements.length > 0 ? elements[0] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * CSS selector ile bul
     */
    async findByCSS(selectors) {
        if (!selectors.css) return null;

        try {
            const element = await this.page.$(selectors.css);
            return element;
        } catch (error) {
            return null;
        }
    }

    /**
     * Text içeriği ile bul
     */
    async findByText(selectors) {
        if (!selectors.text) return null;

        try {
            // XPath ile text içeren elementi bul
            const xpath = `//*[contains(text(), "${selectors.text}")]`;
            const elements = await this.page.$x(xpath);
            return elements.length > 0 ? elements[0] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Position ile bul (parent + index)
     */
    async findByPosition(selectors) {
        if (!selectors.position || !selectors.position.parent) return null;

        try {
            const { parent, index } = selectors.position;
            
            // Parent elementi bul
            const parentElement = await this.page.$(parent);
            if (!parentElement) return null;

            // Parent'ın child'larını al
            const children = await parentElement.$$(':scope > *');
            
            // Index'teki child'ı döndür
            if (index < children.length) {
                return children[index];
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Element bilgilerini topla (Element Picker için)
     * @param {ElementHandle} element - Hedef element
     * @returns {Object} Element bilgileri
     */
    async extractElementInfo(element) {
        try {
            const info = await this.page.evaluate((el) => {
                // Helper: Get XPath
                function getXPath(element) {
                    if (element.id) {
                        return `//*[@id="${element.id}"]`;
                    }
                    
                    if (element === document.body) {
                        return '/html/body';
                    }

                    let ix = 0;
                    const siblings = element.parentNode.childNodes;
                    
                    for (let i = 0; i < siblings.length; i++) {
                        const sibling = siblings[i];
                        if (sibling === element) {
                            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
                        }
                        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                            ix++;
                        }
                    }
                }

                // Helper: Get CSS Selector
                function getCSSSelector(element) {
                    if (element.id) {
                        return `#${element.id}`;
                    }

                    let path = [];
                    while (element.parentElement) {
                        let selector = element.tagName.toLowerCase();
                        
                        if (element.className) {
                            const classes = element.className.split(' ').filter(c => c.trim());
                            if (classes.length > 0) {
                                selector += '.' + classes.join('.');
                            }
                        }

                        path.unshift(selector);
                        element = element.parentElement;
                    }

                    return path.join(' > ');
                }

                // Helper: Get all attributes
                function getAttributes(element) {
                    const attrs = {};
                    for (let i = 0; i < element.attributes.length; i++) {
                        const attr = element.attributes[i];
                        attrs[attr.name] = attr.value;
                    }
                    return attrs;
                }

                // Helper: Get parent info
                function getParentInfo(element) {
                    if (!element.parentElement) return null;

                    const parent = element.parentElement;
                    const siblings = Array.from(parent.children);
                    const index = siblings.indexOf(element);

                    let parentSelector = parent.tagName.toLowerCase();
                    if (parent.id) {
                        parentSelector = `#${parent.id}`;
                    } else if (parent.className) {
                        const classes = parent.className.split(' ').filter(c => c.trim());
                        if (classes.length > 0) {
                            parentSelector += '.' + classes.join('.');
                        }
                    }

                    return {
                        parent: parentSelector,
                        index: index
                    };
                }

                return {
                    tag: el.tagName.toLowerCase(),
                    id: el.id || null,
                    name: el.getAttribute('name') || null,
                    className: el.className || null,
                    xpath: getXPath(el),
                    css: getCSSSelector(el),
                    text: el.textContent ? el.textContent.trim().substring(0, 50) : null,
                    attributes: getAttributes(el),
                    position: getParentInfo(el)
                };
            }, element);

            return info;
        } catch (error) {
            console.error('❌ Extract element info failed:', error);
            throw error;
        }
    }

    /**
     * Sayfadaki tüm interaktif elementleri bul
     * @returns {Array} Element listesi
     */
    async findAllInteractiveElements() {
        try {
            const elements = await this.page.$$('input, button, select, textarea, a[href]');
            
            const elementInfos = [];
            for (const element of elements) {
                const info = await this.extractElementInfo(element);
                elementInfos.push(info);
            }

            return elementInfos;
        } catch (error) {
            console.error('❌ Find interactive elements failed:', error);
            throw error;
        }
    }

    /**
     * Element'in görünür olup olmadığını kontrol et
     * @param {ElementHandle} element - Kontrol edilecek element
     */
    async isVisible(element) {
        try {
            const isVisible = await this.page.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       el.offsetWidth > 0 &&
                       el.offsetHeight > 0;
            }, element);

            return isVisible;
        } catch (error) {
            return false;
        }
    }

    /**
     * Element'in tıklanabilir olup olmadığını kontrol et
     * @param {ElementHandle} element - Kontrol edilecek element
     */
    async isClickable(element) {
        try {
            const isClickable = await this.page.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return style.pointerEvents !== 'none' && 
                       !el.disabled &&
                       style.display !== 'none' &&
                       style.visibility !== 'hidden';
            }, element);

            return isClickable;
        } catch (error) {
            return false;
        }
    }

    /**
     * Selector objesini optimize et (en güvenilir olanları seç)
     * @param {Object} selectors - Ham selector objesi
     * @returns {Object} Optimize edilmiş selector objesi
     */
    optimizeSelectors(selectors) {
        const optimized = {};

        // ID varsa ama dinamikse (sayı içeriyorsa) kullanma
        if (selectors.id && !/\d{5,}/.test(selectors.id)) {
            optimized.id = selectors.id;
        }

        // Name her zaman güvenilir
        if (selectors.name) {
            optimized.name = selectors.name;
        }

        // Stable attributes öncelikli
        if (selectors.attributes) {
            const stableAttrs = {};
            
            // data-* attributes
            Object.keys(selectors.attributes).forEach(key => {
                if (key.startsWith('data-') || 
                    key.startsWith('aria-') || 
                    key === 'role' ||
                    key === 'placeholder' ||
                    key === 'title') {
                    stableAttrs[key] = selectors.attributes[key];
                }
            });

            if (Object.keys(stableAttrs).length > 0) {
                optimized.attributes = stableAttrs;
            }
        }

        // XPath (relative)
        if (selectors.xpath) {
            optimized.xpath = selectors.xpath;
        }

        // CSS (class-based)
        if (selectors.css && !selectors.css.includes('#')) {
            optimized.css = selectors.css;
        }

        // Text (kısa ve unique ise)
        if (selectors.text && selectors.text.length < 30) {
            optimized.text = selectors.text;
        }

        // Position (fallback)
        if (selectors.position) {
            optimized.position = selectors.position;
        }

        return optimized;
    }

    /**
     * Timeout ayarla
     */
    setTimeout(timeout) {
        this.defaultTimeout = timeout;
    }
}

module.exports = SmartSelector;