/**
 * KB Beauty — Global Cart Module
 * Persists to localStorage. FAB navigates to /cart.html (full page).
 */

const CART_KEY = 'kb_cart';

/* ── Core CRUD ── */
function cartGet()  { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
function cartSave(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); _updateCartUI(); }

function cartAdd(service) {
    const sid = Number(service.id); // Always normalize to Number
    const c = cartGet(), idx = c.findIndex(i => Number(i.id) === sid);
    if (idx > -1) c[idx].qty++;
    else c.push({ id: sid, name: service.name, price: parseFloat(service.price), qty: 1 });
    cartSave(c);
}
function cartRemove(id)       { cartSave(cartGet().filter(i => Number(i.id) !== Number(id))); }
function cartSetQty(id, qty)  {
    const sid = Number(id);
    const c = cartGet(), idx = c.findIndex(i => Number(i.id) === sid);
    if (idx === -1) return;
    if (qty < 1) c.splice(idx, 1); else c[idx].qty = qty;
    cartSave(c);
    _syncPageControl(sid, qty < 1 ? 0 : qty);
}
function cartGetQty(id) { return cartGet().find(i => Number(i.id) === Number(id))?.qty || 0; }
function cartCount()    { return cartGet().reduce((s,i) => s + i.qty, 0); }
function cartTotal()    { return cartGet().reduce((s,i) => s + i.price * i.qty, 0); }
function cartClear()    { localStorage.removeItem(CART_KEY); _updateCartUI(); }

/* ── Card-level helpers (category page / modal) ── */
function cartAddFromCard(id, name, price) {
    cartAdd({ id, name, price });
    _syncPageControl(Number(id), cartGetQty(id));
    _bumpFab(); // Only call once here (removed from cartAdd to avoid double-bump)
}
function cartStepFromCard(id, name, price, delta) {
    const newQty = cartGetQty(id) + delta;
    if (newQty < 1) { cartRemove(id); _syncPageControl(Number(id), 0); }
    else            { cartSetQty(id, newQty); _syncPageControl(Number(id), newQty); }
}

function _syncPageControl(id, qty) {
    const numId   = Number(id);
    const addBtn  = document.getElementById(`cart-add-${numId}`);
    const stepper = document.getElementById(`cart-step-${numId}`);
    const qtyNum  = document.getElementById(`cart-qty-${numId}`);
    if (!addBtn || !stepper) return;
    if (qty > 0) { addBtn.style.display = 'none'; stepper.style.display = 'flex'; if (qtyNum) qtyNum.textContent = qty; }
    else         { addBtn.style.display = '';      stepper.style.display = 'none'; }
}
function cartRestorePageControls() { cartGet().forEach(i => _syncPageControl(Number(i.id), i.qty)); }

/* ── Navigate to cart page ── */
function openCartPage() { location.href = '/cart.html'; }

/* ── Badge + FAB update ── */
function _updateCartUI() {
    const count = cartCount();
    // Update ALL elements with [data-cart-count], including nav badge and FAB badge
    document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent   = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
    const fab = document.getElementById('kb-cart-fab');
    if (fab) fab.classList.toggle('has-items', count > 0);
}
function _bumpFab() {
    const fab = document.getElementById('kb-cart-fab');
    if (!fab) return;
    fab.classList.remove('bump');
    void fab.offsetWidth; // Force reflow
    fab.classList.add('bump');
}

/* ── Inject FAB only (no drawer) — skip on dashboard/admin/cart pages ── */
function _injectFab() {
    const path = location.pathname;
    if (['/admin.html', '/cart.html'].some(p => path.endsWith(p))) return;
    if (document.getElementById('kb-cart-fab')) return;
    document.body.insertAdjacentHTML('beforeend', `
        <button class="kb-cart-fab" id="kb-cart-fab" onclick="openCartPage()" aria-label="View cart">
            <i class="bi bi-bag"></i>
            <span class="kb-cart-fab-badge" data-cart-count style="display:none;"></span>
        </button>
    `);
}

document.addEventListener('DOMContentLoaded', () => {
    _injectFab();
    _updateCartUI();
    cartRestorePageControls();
});

// ── Sync cart badge when localStorage changes from another page ──
window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) {
        _updateCartUI();
        cartRestorePageControls();
    }
});
