/**
 * KB Beauty Salons & Tattoos — Main Public JS
 * Handles: header scroll, reveal animations, categories, booking modal (cart-based)
 */

/* ── Category image fallback ───────────────────────────────── */
const CATEGORY_IMG_FALLBACK = '/images/hero section pic.png';

/* ── Header scroll effect ──────────────────────────────────── */
window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 50);
});

/* ── Reveal animations via IntersectionObserver ────────────── */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.08 });

function observeRevealElements() {
    document.querySelectorAll('.reveal:not(.active)').forEach(el => revealObserver.observe(el));
}

/* ── Active section (men / women), persisted in localStorage ── */
let _activeSection = localStorage.getItem('kbSection') || 'men';

function switchSection(gender) {
    _activeSection = gender;
    localStorage.setItem('kbSection', gender);

    document.querySelectorAll('.gender-tab').forEach(btn => {
        btn.classList.toggle('active', btn.id === 'tab-' + gender);
    });

    fetchCategories();
}

/* ── Fetch & render categories ─────────────────────────────── */
async function fetchCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    // Sync tab UI to current section
    document.querySelectorAll('.gender-tab').forEach(btn => {
        btn.classList.toggle('active', btn.id === 'tab-' + _activeSection);
    });

    try {
        const res = await fetch(`/api/categories?gender=${_activeSection}&t=` + Date.now());
        if (!res.ok) throw new Error('Server returned ' + res.status);

        const categories = await res.json();

        if (!categories.length) {
            container.innerHTML = `
                <p style="color:#9a7840;text-align:center;grid-column:1/-1;
                           padding:3rem 0;letter-spacing:2px;text-transform:uppercase;font-size:0.85rem;">
                    No services available at the moment.
                </p>`;
            return;
        }

        container.innerHTML = categories.map((c, i) => {
            const img = c.has_image
                ? `/api/images/category/${c.category_id}?t=${Date.now()}`
                : CATEGORY_IMG_FALLBACK;
            return `
                <a href="/category.html?id=${c.category_id}&name=${encodeURIComponent(c.name)}&gender=${_activeSection}"
                   class="category-card"
                   style="--bg-img:url('${img}');
                          opacity:0;
                          animation:revealUp 0.55s cubic-bezier(0.23,1,0.32,1) forwards;
                          animation-delay:${i * 0.07}s;
                          text-decoration:none;">
                    <div class="category-img"></div>
                    <div class="category-label">
                        <span class="category-label-text">${c.name}</span>
                    </div>
                    <div class="category-cta">
                        <span class="cta-text">Explore Services</span>
                    </div>
                </a>`;
        }).join('');

    } catch (err) {
        console.error('[fetchCategories]', err);
        if (container) {
            container.innerHTML = `
                <p style="color:#9a7840;text-align:center;grid-column:1/-1;
                           padding:3rem 0;letter-spacing:2px;text-transform:uppercase;font-size:0.85rem;">
                    Unable to load services — please refresh the page.
                </p>`;
        }
    }
}

/* ── Booking modal ─────────────────────────────────────────── */
function openBooking() {
    showServiceSelection();
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'flex';
        requestAnimationFrame(() => modal.classList.add('active'));
    }
}

function closeBooking() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
}

function showServiceSelection() {
    const sel   = document.getElementById('service-selection-view');
    const form  = document.getElementById('booking-form-view');
    const dot1  = document.getElementById('dot-1');
    const dot2  = document.getElementById('dot-2');
    const title = document.getElementById('modal-title');

    if (sel)  sel.style.display  = 'block';
    if (form) form.style.display = 'none';
    if (dot1) dot1.classList.add('active');
    if (dot2) dot2.classList.remove('active');
    if (title) title.textContent = 'Select Services';

    loadServicesIntoModal();
}

function backToServices() {
    showServiceSelection();
}

function modalViewCart() {
    const cart   = cartGet();
    if (!cart.length) return;

    const review = document.getElementById('modal-cart-review');
    if (review) {
        const total = cartTotal();
        review.innerHTML = cart.map(item => `
            <div class="modal-cart-item-row">
                <span class="modal-cart-item-name">${item.name}${item.qty > 1 ? ' <span style="color:#9a7840;font-size:0.8em;">×' + item.qty + '</span>' : ''}</span>
                <span class="modal-cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</span>
            </div>`).join('') + `
            <div class="modal-cart-total">
                <span>Total</span>
                <span>₹${total.toLocaleString('en-IN')}</span>
            </div>`;
    }

    const sel   = document.getElementById('service-selection-view');
    const form  = document.getElementById('booking-form-view');
    const dot1  = document.getElementById('dot-1');
    const dot2  = document.getElementById('dot-2');
    const title = document.getElementById('modal-title');

    if (sel)  sel.style.display  = 'none';
    if (form) form.style.display = 'block';
    if (dot1) dot1.classList.remove('active');
    if (dot2) dot2.classList.add('active');
    if (title) title.textContent = 'Review & Book';
}

/* Update the cart bar inside the modal */
function _updateModalCartBar() {
    const bar   = document.getElementById('modal-cart-bar');
    const count = document.getElementById('modal-cart-count');
    const total = document.getElementById('modal-cart-total');
    if (!bar) return;
    const c = cartCount();
    if (c > 0) {
        bar.style.display = 'block';
        if (count) count.textContent = c;
        if (total) total.textContent = '₹' + cartTotal().toLocaleString('en-IN');
    } else {
        bar.style.display = 'none';
    }
}

async function loadServicesIntoModal() {
    const list = document.getElementById('services-list');
    if (!list) return;
    list.innerHTML = '<p style="color:#9a7840;text-align:center;padding:2rem 0;letter-spacing:1px;">Loading services…</p>';

    try {
        const res = await fetch(`/api/categories?gender=${_activeSection}&t=` + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const categories = await res.json();

        if (!categories.length) {
            list.innerHTML = '<p style="color:#9a7840;text-align:center;padding:2rem 0;">No services found.</p>';
            return;
        }

        let html = '';
        for (const cat of categories) {
            const sRes    = await fetch(`/api/services?categoryId=${cat.category_id}`);
            const services = await sRes.json();
            if (!services.length) continue;

            html += `<p style="color:#d4af37;font-size:0.7rem;text-transform:uppercase;letter-spacing:3px;font-weight:800;margin:1.5rem 0 0.7rem;">${cat.name}</p>`;
            services.forEach(s => {
                const safeName = s.name.replace(/'/g, "\\'");
                html += `
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:0.8rem 1rem;margin-bottom:0.45rem;
                            background:rgba(237,227,212,0.06);border:1px solid rgba(180,130,40,0.15);
                            border-radius:10px;gap:0.8rem;">
                    <div>
                        <span style="color:#e8d5a0;font-weight:600;font-size:0.92rem;">${s.name}</span>
                        <span style="color:#9a7840;font-size:0.8rem;margin-left:0.6rem;">₹${parseFloat(s.price).toFixed(0)}</span>
                    </div>
                    <div class="svc-cart-wrap" style="flex-shrink:0;">
                        <button class="btn-add-cart" id="cart-add-${s.service_id}"
                                style="padding:0.5rem 1rem;font-size:0.72rem;"
                                onclick="modalAddToCart(${s.service_id},'${safeName}',${s.price})">
                            <i class="bi bi-plus-lg"></i> Add
                        </button>
                        <div class="svc-qty-stepper" id="cart-step-${s.service_id}">
                            <button class="svc-qty-step-btn"
                                    onclick="modalStepCart(${s.service_id},'${safeName}',${s.price},-1)">−</button>
                            <span class="svc-qty-count" id="cart-qty-${s.service_id}">1</span>
                            <button class="svc-qty-step-btn"
                                    onclick="modalStepCart(${s.service_id},'${safeName}',${s.price},+1)">+</button>
                        </div>
                    </div>
                </div>`;
            });
        }

        list.innerHTML = html || '<p style="color:#9a7840;text-align:center;padding:2rem 0;">No services available.</p>';

        // Restore cart state for any pre-added services
        if (typeof cartRestorePageControls === 'function') cartRestorePageControls();
        _updateModalCartBar();

    } catch (err) {
        console.error('[loadServicesIntoModal]', err);
        list.innerHTML = '<p style="color:#9a7840;text-align:center;padding:2rem 0;">Failed to load services.</p>';
    }
}

function modalAddToCart(id, name, price) {
    cartAddFromCard(id, name, price);
    _updateModalCartBar();
}

function modalStepCart(id, name, price, delta) {
    cartStepFromCard(id, name, price, delta);
    _updateModalCartBar();
}

/* ── Close modal on overlay click ──────────────────────────── */
document.addEventListener('click', (e) => {
    if (e.target.id === 'booking-modal') closeBooking();
});

/* ── Fetch & render gallery from DB ────────────────────────── */
async function fetchGallery() {
    const track = document.getElementById('gallery-track');
    if (!track) return;

    try {
        const res = await fetch('/api/gallery?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const images = await res.json();

        if (!images.length) return;

        const imgHtml = images.map(img =>
            `<img src="/api/gallery/${img.image_id}/image" class="gallery-item"
                  alt="${img.caption || 'Gallery'}" loading="lazy">`
        ).join('');
        track.innerHTML = imgHtml + imgHtml; // duplicate for seamless loop
    } catch (err) {
        console.error('[fetchGallery]', err);
    }
}

/* ── Dynamic Footer Settings ─────────────────────────────── */
async function updateFooterSettings() {
    try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();

        // 1. Proprietor Name
        const propName = document.getElementById('footer-proprietor-name');
        if (propName && data.proprietor_name) {
            propName.textContent = data.proprietor_name;
        }

        // 2. Service Mobile
        const phoneLink = document.getElementById('footer-phone-link');
        const phoneText = document.getElementById('footer-phone-text');
        if (data.service_mobile) {
            const cleanMobile = data.service_mobile.replace(/\s+/g, '');
            if (phoneLink) phoneLink.href = 'tel:' + cleanMobile;
            if (phoneText) phoneText.textContent = data.service_mobile;
        }

        // 3. Service WhatsApp
        const waLink = document.getElementById('footer-whatsapp-link');
        if (waLink && data.service_whatsapp) {
            waLink.href = 'https://wa.me/' + data.service_whatsapp.replace(/\D/g, '');
        }

        // 4. Social Icons (if current page has the container)
        const socialContainer = document.getElementById('footer-social-icons');
        if (socialContainer) {
            socialContainer.innerHTML = ''; // Clear hardcoded or existing
            [
                { key: 'social_instagram', icon: 'bi-instagram', label: 'Instagram' },
                { key: 'social_facebook',  icon: 'bi-facebook',  label: 'Facebook'  },
                { key: 'social_youtube',   icon: 'bi-youtube',   label: 'YouTube'   },
                { key: 'social_twitter',   icon: 'bi-twitter-x', label: 'Twitter/X' },
                { key: 'social_whatsapp',  icon: 'bi-whatsapp',  label: 'WhatsApp'  },
                { key: 'social_tiktok',    icon: 'bi-tiktok',    label: 'TikTok'    },
            ].forEach(({ key, icon, label }) => {
                const url = data[key];
                if (url && url.trim()) {
                    const a = document.createElement('a');
                    a.href = url.trim(); a.target = '_blank'; a.rel = 'noopener noreferrer';
                    a.className = 'footer-social-link'; a.setAttribute('aria-label', label);
                    a.innerHTML = `<i class="bi ${icon}"></i>`;
                    socialContainer.appendChild(a);
                }
            });
        }

        // 5. Maps Link
        const mapBtn = document.getElementById('footer-map-btn');
        if (mapBtn && data.maps_url && data.maps_url.trim()) {
            mapBtn.href = data.maps_url.trim();
            mapBtn.style.display = 'inline-flex';
        }

    } catch (err) {
        console.error('[updateFooterSettings]', err);
    }
}

/* ── Init ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    fetchGallery();
    updateFooterSettings();
    observeRevealElements();
});
