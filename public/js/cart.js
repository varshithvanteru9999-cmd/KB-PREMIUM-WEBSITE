/**
 * KB Beauty — Global Cart Module
 * Persists to localStorage. FAB navigates to /cart.html (full page).
 */

const CART_KEY = 'kb_cart';

/* ── Core CRUD ── */
function cartGet()  { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
function cartSave(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); _updateCartUI(); }

function cartAdd(service) {
    const c = cartGet(), idx = c.findIndex(i => i.id === service.id);
    if (idx > -1) c[idx].qty++;
    else c.push({ id: service.id, name: service.name, price: parseFloat(service.price), qty: 1 });
    cartSave(c);
    _bumpFab();
}
function cartRemove(id)       { cartSave(cartGet().filter(i => i.id !== id)); }
function cartSetQty(id, qty)  {
    const c = cartGet(), idx = c.findIndex(i => i.id === id);
    if (idx === -1) return;
    if (qty < 1) c.splice(idx, 1); else c[idx].qty = qty;
    cartSave(c);
    _syncPageControl(id, qty < 1 ? 0 : qty);
}
function cartGetQty(id) { return cartGet().find(i => i.id === id)?.qty || 0; }
function cartCount()    { return cartGet().reduce((s,i) => s + i.qty, 0); }
function cartTotal()    { return cartGet().reduce((s,i) => s + i.price * i.qty, 0); }
function cartClear()    { localStorage.removeItem(CART_KEY); _updateCartUI(); }

/* ── Card-level helpers (category page / modal) ── */
function cartAddFromCard(id, name, price) {
    cartAdd({ id, name, price });
    _syncPageControl(id, cartGetQty(id));
    _bumpFab();
}
function cartStepFromCard(id, name, price, delta) {
    const newQty = cartGetQty(id) + delta;
    if (newQty < 1) { cartRemove(id); _syncPageControl(id, 0); }
    else            { cartSetQty(id, newQty); _syncPageControl(id, newQty); }
}

function _syncPageControl(id, qty) {
    const addBtn  = document.getElementById(`cart-add-${id}`);
    const stepper = document.getElementById(`cart-step-${id}`);
    const qtyNum  = document.getElementById(`cart-qty-${id}`);
    if (!addBtn || !stepper) return;
    if (qty > 0) { addBtn.style.display = 'none'; stepper.style.display = 'flex'; if (qtyNum) qtyNum.textContent = qty; }
    else         { addBtn.style.display = '';      stepper.style.display = 'none'; }
}
function cartRestorePageControls() { cartGet().forEach(i => _syncPageControl(i.id, i.qty)); }

/* ── Navigate to cart page ── */
function openCartPage() { location.href = '/cart.html'; }

/* ── Badge + FAB update ── */
function _updateCartUI() {
    const count = cartCount();
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
    void fab.offsetWidth;
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
