document.addEventListener('DOMContentLoaded', () => {
    const langToggles = document.querySelectorAll('#language-toggle, #mobile-lang-toggle');
    const langTexts = document.querySelectorAll('#lang-text, #mobile-lang-text');
    
    // Check for saved language or default to browser language/es
    let currentLang = localStorage.getItem('language') || 'es';
    
    // Function to update content
    function updateContent(lang) {
        // Helper to get translation value
        const getTranslation = (key) => {
            const keys = key.split('.');
            let value = translations[lang];
            for (const k of keys) {
                if (value && value[k]) {
                    value = value[k];
                } else {
                    return null;
                }
            }
            return value;
        };

        // Update Text Content (innerHTML)
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const value = getTranslation(key);
            if (value) element.innerHTML = value;
        });

        // Update Title Attribute
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const value = getTranslation(key);
            if (value) element.title = value;
        });
        
        // Update Placeholder Attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const value = getTranslation(key);
            if (value) element.placeholder = value;
        });

        // Update Toggle Text
        langTexts.forEach(text => {
            text.textContent = lang === 'es' ? 'EN' : 'ES';
        });

        // Save preference
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
    }

    // Initialize
    updateContent(currentLang);

    // Event Listeners
    langToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            currentLang = currentLang === 'es' ? 'en' : 'es';
            updateContent(currentLang);
        });
    });
});
