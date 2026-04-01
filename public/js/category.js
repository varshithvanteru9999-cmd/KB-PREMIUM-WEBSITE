/**
 * KB Beauty — Category Page JS
 * Handles: URL params, hero title, service card rendering, DB-driven i18n
 */

const urlParams = new URLSearchParams(window.location.search);
const catId = urlParams.get('id');
const catNameParam = urlParams.get('name');

if (catNameParam) {
    document.getElementById('cat-name').innerText = catNameParam;
}

function renderServices(services) {
    const lang = localStorage.getItem('kbLang') || 'en';
    const t = TRANSLATIONS[lang];
    const container = document.getElementById('services-container');

    container.innerHTML = services.map(s => {
        const safeName = s.name.replace(/'/g, "\\'");
        return `
        <div class="service-story-card reveal active">
            <div class="story-header">
                <div>
                    <h2 class="luxury-font" style="font-size: 2rem; margin-bottom: 0.5rem;">${s.name}</h2>
                    <span style="color: #fcf6ba; font-weight: 900; font-size: 1.2rem; text-shadow: 0 0 12px rgba(252,246,186,0.3);">&#8377;${parseFloat(s.price).toFixed(0)}</span>
                </div>
                <div class="svc-cart-wrap">
                    <!-- Add to Cart button -->
                    <button class="btn-add-cart" id="cart-add-${s.service_id}"
                            onclick="cartAddFromCard(${s.service_id},'${safeName}',${s.price})">
                        <i class="bi bi-bag-plus"></i> Add to Cart
                    </button>
                    <!-- Qty stepper (shown after adding) -->
                    <div class="svc-qty-stepper" id="cart-step-${s.service_id}">
                        <button class="svc-qty-step-btn"
                                onclick="cartStepFromCard(${s.service_id},'${safeName}',${s.price},-1)">−</button>
                        <span class="svc-qty-count" id="cart-qty-${s.service_id}">1</span>
                        <button class="svc-qty-step-btn"
                                onclick="cartStepFromCard(${s.service_id},'${safeName}',${s.price},+1)">+</button>
                    </div>
                </div>
            </div>
            <div class="story-grid">
                <div class="story-item">
                    <h4>${t.label_what}</h4>
                    <p>${s.description_what || t.default_what}</p>
                </div>
                <div class="story-item">
                    <h4>${t.label_why}</h4>
                    <p>${s.description_why || t.default_why}</p>
                </div>
                <div class="story-item">
                    <h4>${t.label_how}</h4>
                    <p>${s.description_how || t.default_how}</p>
                </div>
            </div>
        </div>`;
    }).join('');

    // Restore cart state for any services already in cart
    if (typeof cartRestorePageControls === 'function') cartRestorePageControls();
}

async function loadServices(lang) {
    if (!catId) return;
    const activeLang = lang || localStorage.getItem('kbLang') || 'en';
    try {
        const res = await fetch(`/api/services?categoryId=${catId}&lang=${activeLang}&t=${Date.now()}`);
        const services = await res.json();
        window.__loadedServices = services;
        renderServices(services);
    } catch (err) {
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLang(); // sets active lang button + calls loadServices
});
