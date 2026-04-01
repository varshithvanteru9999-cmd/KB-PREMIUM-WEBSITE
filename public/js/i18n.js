/**
 * KB Beauty — i18n for category.html
 * Languages: English (en), Telugu (te), Hindi (hi)
 *
 * Only the service description section is multilingual.
 * Labels, buttons, and nav are always in English.
 * Actual service description TEXT comes from DB via ?lang= param.
 * TRANSLATIONS here only covers the static UI labels in that section
 * and the JS fallback strings used when DB has no translation yet.
 */

const TRANSLATIONS = {
    en: {
        label_what: 'What it is',
        label_why: 'Why you need it',
        label_how: 'How it helps',
        default_what: 'A professional beauty treatment made especially for your skin and hair needs.',
        default_why: 'To keep your skin healthy and make you look even more beautiful with expert care.',
        default_how: 'This service gives you a fresh look and helps you feel more confident and relaxed.',
    },
    te: {
        label_what: 'ఏమిటి',
        label_why: 'ఎందుకు అవసరం',
        label_how: 'ఎలా సహాయపడుతుంది',
        default_what: 'మీ చర్మం మరియు జుట్టు అవసరాలకు ప్రత్యేకంగా రూపొందించిన వృత్తిపరమైన బ్యూటీ ట్రీట్‌మెంట్.',
        default_why: 'మీ చర్మాన్ని ఆరోగ్యంగా ఉంచడానికి మరియు నిపుణుల సంరక్షణతో మీరు మరింత అందంగా కనిపించడానికి.',
        default_how: 'ఈ సేవ మీకు తాజా రూపును ఇస్తుంది మరియు మీరు మరింత ఆత్మవిశ్వాసంగా మరియు విశ్రాంతిగా అనిపించేలా చేస్తుంది.',
    },
    hi: {
        label_what: 'यह क्या है',
        label_why: 'यह क्यों जरूरी है',
        label_how: 'यह कैसे मदद करता है',
        default_what: 'आपकी त्वचा और बालों की जरूरतों के लिए विशेष रूप से तैयार किया गया पेशेवर ब्यूटी ट्रीटमेंट।',
        default_why: 'अपनी त्वचा को स्वस्थ रखने और विशेषज्ञ देखभाल से और भी सुंदर दिखने के लिए।',
        default_how: 'यह सेवा आपको एक ताज़ा लुक देती है और आपको अधिक आत्मविश्वासी और तनावमुक्त महसूस कराती है।',
    }
};

const LANG_FONTS = {
    te: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;700&display=swap',
    hi: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap'
};

function loadLangFont(lang) {
    const id = 'font-lang-' + lang;
    if (!document.getElementById(id) && LANG_FONTS[lang]) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = LANG_FONTS[lang];
        document.head.appendChild(link);
    }
}

function applyLang(lang) {
    if (!TRANSLATIONS[lang]) return;
    localStorage.setItem('kbLang', lang);
    loadLangFont(lang);

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Re-fetch services in the new language (DB-driven translations)
    if (typeof loadServices === 'function') {
        loadServices(lang);
    }
}

function initLang() {
    const saved = localStorage.getItem('kbLang') || 'en';
    applyLang(saved);
}
