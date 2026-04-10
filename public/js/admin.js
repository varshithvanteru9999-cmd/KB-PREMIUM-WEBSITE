/**
 * KB Beauty Salons — Admin Dashboard JS
 */

/* ── Auth helpers ─────────────────────────────────────────── */
const token = () => localStorage.getItem('adminToken');

/* ── Admin date/time picker helpers ──────────────────────── */
let _fpNewAppt  = null;
let _fpEditAppt = null;

function _fmtTime12(t) {
    if (!t) return t;
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
}

function _fmtDateDDMMYYYY(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        // Fallback for simple YYYY-MM-DD strings
        const parts = String(dateStr).slice(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function toggleAdminTimeDrop(prefix) {
    const trigger  = document.getElementById(`${prefix}-time-trigger`);
    const dropdown = document.getElementById(`${prefix}-time-dropdown`);
    if (!dropdown || !dropdown.children.length) return;
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    trigger.classList.toggle('open', !isOpen);
}

function pickAdminTime(prefix, value) {
    document.getElementById(`${prefix}-time-val`) && (document.getElementById(`${prefix}-time-val`).value = value);
    // edit-appt-drawer uses id "edit-appt-time" as the hidden field
    if (prefix === 'edit-appt') document.getElementById('edit-appt-time').value = value;
    const label = document.getElementById(`${prefix}-time-label`);
    const trigger = document.getElementById(`${prefix}-time-trigger`);
    const dropdown = document.getElementById(`${prefix}-time-dropdown`);
    if (label) label.textContent = _fmtTime12(value);
    if (trigger) { trigger.classList.add('has-value'); trigger.classList.remove('open'); }
    if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.admin-time-option').forEach(o => o.classList.toggle('selected', o.dataset.value === value));
    }
}

async function _populateAdminTimeSlots(prefix, date) {
    const trigger  = document.getElementById(`${prefix}-time-trigger`);
    const label    = document.getElementById(`${prefix}-time-label`);
    const dropdown = document.getElementById(`${prefix}-time-dropdown`);
    if (!dropdown) return;

    label.textContent = 'Loading…';
    trigger.classList.remove('has-value', 'open');
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';

    // Clear the hidden value
    const hiddenId = prefix === 'edit-appt' ? 'edit-appt-time' : `${prefix}-time-val`;
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = '';

    try {
        const data = await apiFetch(`/api/availability?date=${date}&admin=1`);
        const slots = Array.isArray(data) ? data : (data?.slots || []);
        if (!slots.length) {
            label.textContent = 'No slots available';
            dropdown.innerHTML = '<div style="padding:0.8rem 1.1rem;color:rgba(140,100,50,0.5);font-size:0.82rem;">No available slots for this date</div>';
            return;
        }
        label.textContent = 'Select time';
        dropdown.innerHTML = slots.map(s => {
            const val   = typeof s === 'string' ? s : s.time;
            const avail = typeof s === 'object' ? s.available !== false : true;
            return `<div class="admin-time-option${avail ? '' : ' unavailable'}" data-value="${val}"
                         onclick="pickAdminTime('${prefix}','${val}')">${_fmtTime12(val)}</div>`;
        }).join('');
    } catch (err) {
        label.textContent = 'Could not load slots';
        console.error('[_populateAdminTimeSlots]', err);
    }
}

// Close time dropdowns, service dropdowns, and category filter on outside click
document.addEventListener('click', e => {
    // Category filter dropdown
    const catWrap = document.getElementById('svc-cat-wrap');
    if (catWrap && !catWrap.contains(e.target)) {
        document.getElementById('svc-cat-dropdown')?.classList.remove('open');
        document.getElementById('svc-cat-trigger')?.classList.remove('open');
    }

    ['new-appt', 'edit-appt'].forEach(prefix => {
        const timeWrap = document.getElementById(`${prefix}-time-wrap`);
        if (timeWrap && !timeWrap.contains(e.target)) {
            document.getElementById(`${prefix}-time-dropdown`)?.classList.remove('open');
            document.getElementById(`${prefix}-time-trigger`)?.classList.remove('open');
        }
        const svcWrap = document.getElementById(`${prefix}-svc-wrap`);
        if (svcWrap && !svcWrap.contains(e.target)) {
            document.getElementById(`${prefix}-svc-dropdown`)?.classList.remove('open');
            document.getElementById(`${prefix}-svc-trigger`)?.classList.remove('open');
        }
    });
});

/* ── Service searchable dropdown helpers ─────────────────── */
let _svcAllItems = {}; // cache per prefix

function _buildSvcList(prefix, svcs) {
    _svcAllItems[prefix] = svcs;
    _renderSvcItems(prefix, svcs);
}

function _renderSvcItems(prefix, items) {
    const list    = document.getElementById(`${prefix}-svc-list`);
    const hidden  = document.getElementById(`${prefix}-add-svc`);
    const current = hidden?.value ? parseInt(hidden.value) : null;
    if (!list) return;
    if (!items.length) {
        list.innerHTML = '<div class="svc-no-results">No matching services</div>';
        return;
    }
    list.innerHTML = items.map(s => `
        <div class="svc-search-item${current === s.service_id ? ' selected' : ''}"
             data-id="${s.service_id}" data-name="${(s.name||'').replace(/"/g,'&quot;')}" data-price="${s.price||0}"
             onclick="selectSvcItem('${prefix}',${s.service_id},'${(s.name||'').replace(/'/g,"\\'")}',${s.price||0})">
            <span class="svc-item-name">${s.name}</span>
            <span class="svc-item-price">₹${parseFloat(s.price||0).toLocaleString('en-IN')}</span>
        </div>`).join('');
}

function filterSvcDrop(prefix, q) {
    const all = _svcAllItems[prefix] || [];
    const filtered = q.trim()
        ? all.filter(s => s.name.toLowerCase().includes(q.trim().toLowerCase()))
        : all;
    _renderSvcItems(prefix, filtered);
}

function toggleSvcDrop(prefix) {
    const trigger  = document.getElementById(`${prefix}-svc-trigger`);
    const dropdown = document.getElementById(`${prefix}-svc-dropdown`);
    const isOpen   = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    trigger.classList.toggle('open', !isOpen);
    if (!isOpen) {
        const input = document.getElementById(`${prefix}-svc-search`);
        if (input) { input.value = ''; filterSvcDrop(prefix, ''); setTimeout(() => input.focus(), 60); }
    }
}

function selectSvcItem(prefix, id, name, price) {
    const hidden  = document.getElementById(`${prefix}-add-svc`);
    const trigger = document.getElementById(`${prefix}-svc-trigger`);
    const label   = document.getElementById(`${prefix}-svc-label`);
    if (hidden) hidden.value = id;
    if (label)  label.textContent = `${name}  —  ₹${parseFloat(price).toLocaleString('en-IN')}`;
    if (trigger) { trigger.classList.add('has-value'); trigger.classList.remove('open'); }
    document.getElementById(`${prefix}-svc-dropdown`)?.classList.remove('open');
    // Store data attrs for later use
    if (hidden) { hidden.dataset.name = name; hidden.dataset.price = price; }
}

async function _loadSvcDropdown(prefix) {
    const trigger = document.getElementById(`${prefix}-svc-trigger`);
    const label   = document.getElementById(`${prefix}-svc-label`);
    if (label) label.textContent = 'Loading services…';
    const allSvcs = await apiFetch('/api/admin/services');
    if (label) label.textContent = 'Search & select a service…';
    if (trigger) trigger.classList.remove('has-value');
    const hidden = document.getElementById(`${prefix}-add-svc`);
    if (hidden) hidden.value = '';
    if (allSvcs?.length) {
        _buildSvcList(prefix, allSvcs);
    }
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token(),
            ...options.headers
        }
    });
    if (res.status === 401 || res.status === 403) {
        logout();
        return null;
    }
    return res.json();
}

/* ── Toast system (custom CSS) ────────────────────────────── */
function toast(message, type = 'info') {
    const icons = {
        success: 'bi-check',
        error:   'bi-x',
        warning: 'bi-exclamation',
        info:    'bi-info'
    };
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
        <div class="toast-icon"><i class="bi ${icons[type] || 'bi-info'}"></i></div>
        <span class="toast-msg">${message}</span>
        <button class="toast-dismiss" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('toast-out');
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3800);
}

function renderStatusBadge(status) {
    const map = {
        'Pending':   'badge-warning',
        'Confirmed': 'badge-success',
        'Completed': 'badge-success',
        'Cancelled': 'badge-danger',
        'No-Show':   'badge-danger',
    };
    return `<span class="badge ${map[status] || 'badge-warning'}">${status}</span>`;
}

async function confirmAppointment(id) {
    const ok = await confirm('Confirm Appointment?', 'This will confirm the slot and notify the customer.', 'Yes, Confirm');
    if (!ok) return;
    const res = await apiFetch(`/api/admin/appointments/${id}/confirm`, { method: 'POST' });
    if (res?.success) {
        toast('Slot confirmed.', 'success');
        loadDashboard();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function denyAppointment(id) {
    if (!window.Swal) return;
    const { value: reason, isConfirmed } = await Swal.fire({
        title: 'Deny Appointment',
        html: `<p style="color:#c8a050;font-size:0.88rem;margin-bottom:1rem;">
                   Select a reason or type a custom message for the customer.
               </p>
               <select id="deny-reason-sel" class="swal2-input" style="margin-bottom:0.5rem;">
                   <option value="Slot not available">Slot not available</option>
                   <option value="Fully booked for the day">Fully booked for the day</option>
                   <option value="Service not available on this date">Service not available on this date</option>
                   <option value="Staff unavailable">Staff unavailable</option>
                   <option value="custom">Custom message…</option>
               </select>
               <input id="deny-reason-custom" class="swal2-input" placeholder="Type custom reason…" style="display:none;">`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Deny Appointment',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        didOpen: () => {
            document.getElementById('deny-reason-sel').addEventListener('change', e => {
                const custom = document.getElementById('deny-reason-custom');
                custom.style.display = e.target.value === 'custom' ? 'block' : 'none';
            });
        },
        preConfirm: () => {
            const sel    = document.getElementById('deny-reason-sel').value;
            const custom = document.getElementById('deny-reason-custom').value.trim();
            if (sel === 'custom' && !custom) {
                Swal.showValidationMessage('Please enter a reason.');
                return false;
            }
            return sel === 'custom' ? custom : sel;
        }
    });
    if (!isConfirmed || !reason) return;

    const res = await apiFetch(`/api/admin/appointments/${id}/deny`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
    if (res?.success) {
        toast('Appointment denied.', 'info');
        loadAppointments(); loadDashboard();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function confirm(title, text, confirmBtnText = 'Confirm') {
    if (!window.Swal) return true;
    const result = await Swal.fire({
        title, text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmBtnText,
        cancelButtonText: 'Cancel',
        reverseButtons: true
    });
    return result.isConfirmed;
}

/* ── Tab switching ────────────────────────────────────────── */
const PAGE_TITLES = { dashboard: 'Dashboard', appointments: 'Appointments', services: 'Services', customers: 'Customers', discounts: 'Discounts', settings: 'Settings' };

function switchTab(tab, triggerEl) {
    localStorage.setItem('adminTab', tab);
    document.querySelectorAll('.page-content > section').forEach(s => s.style.display = 'none');
    const view = document.getElementById(tab + '-view');
    if (view) view.style.display = 'block';

    const title = document.getElementById('page-title');
    if (title) title.textContent = PAGE_TITLES[tab] || tab;

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const el = triggerEl || event?.currentTarget;
    if (el) el.classList.add('active');

    if (tab === 'dashboard')    loadDashboard();
    if (tab === 'services')     { loadServices(); loadCatImages(); }
    if (tab === 'appointments') loadAppointments();
    if (tab === 'customers')    loadCustomers();
    if (tab === 'discounts')    loadPromoCodes();
    if (tab === 'settings')     loadAdvanceSetting();
    if (tab === 'settings')     loadGalleryAdmin();
}

/* ── Form-page navigation ─────────────────────────────────── */
let _formPageParent = 'dashboard';
let _gstSettings = { cgst_rate: 0, sgst_rate: 0 }; // cached from settings

function openFormPage(pageId, parentTab) {
    _formPageParent = parentTab || 'dashboard';
    document.querySelectorAll('.page-content > section').forEach(s => s.style.display = 'none');
    const page = document.getElementById(pageId);
    if (page) { page.style.display = 'block'; page.scrollTop = 0; }
}

function closeFormPage() {
    const view = document.getElementById(_formPageParent + '-view');
    document.querySelectorAll('.page-content > section').forEach(s => s.style.display = 'none');
    if (view) view.style.display = 'block';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navLink = document.querySelector(`.nav-link[onclick*="'${_formPageParent}'"]`);
    if (navLink) navLink.classList.add('active');
    const title = document.getElementById('page-title');
    if (title) title.textContent = PAGE_TITLES[_formPageParent] || _formPageParent;
}

/* ── GST helpers ──────────────────────────────────────────── */
function _gstHtml(netAmount) {
    const cgst = _gstSettings.cgst_rate || 0;
    const sgst = _gstSettings.sgst_rate || 0;
    if (!cgst && !sgst) return '';
    const cgstAmt = +(netAmount * cgst / 100).toFixed(2);
    const sgstAmt = +(netAmount * sgst / 100).toFixed(2);
    const totalGST = cgstAmt + sgstAmt;
    const grandTotal = netAmount + totalGST;
    return `
        <div style="margin-top:0.5rem;padding:0.6rem 0.8rem;background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.15);border-radius:0.5rem;">
            <div class="view-total-row dim" style="font-size:0.8rem;"><span>Base Amount</span><span>₹${netAmount.toLocaleString('en-IN')}</span></div>
            ${cgst > 0 ? `<div class="view-total-row dim" style="font-size:0.8rem;color:#c8a050;"><span>CGST (${cgst}%)</span><span>₹${cgstAmt.toLocaleString('en-IN')}</span></div>` : ''}
            ${sgst > 0 ? `<div class="view-total-row dim" style="font-size:0.8rem;color:#c8a050;"><span>SGST (${sgst}%)</span><span>₹${sgstAmt.toLocaleString('en-IN')}</span></div>` : ''}
            <div class="view-total-row" style="font-size:0.88rem;font-weight:700;color:#d4af37;border-top:1px solid rgba(212,175,55,0.2);margin-top:0.4rem;padding-top:0.4rem;"><span>Grand Total (incl. GST)</span><span>₹${grandTotal.toLocaleString('en-IN')}</span></div>
        </div>`;
}

/* ── Sidebar toggle ───────────────────────────────────────── */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('mobile-open');
        overlay?.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        document.body.classList.toggle('sidebar-collapsed-state', isCollapsed);
        localStorage.setItem('adminSidebarCollapsed', isCollapsed ? '1' : '0');
    }
}

/* ── Sidebar state restore + JS tooltips ── */
(function initSidebar() {
    // Restore collapsed state immediately (before paint) to avoid flicker
    if (localStorage.getItem('adminSidebarCollapsed') === '1') {
        document.addEventListener('DOMContentLoaded', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
                document.body.classList.add('sidebar-collapsed-state');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Create shared tooltip element
        const tip = document.createElement('div');
        tip.id = 'sidebar-tooltip';
        document.body.appendChild(tip);

        let hideTimer = null;

        document.querySelectorAll('.sidebar .nav-link[data-tooltip]').forEach(link => {
            link.addEventListener('mouseenter', () => {
                const sidebar = document.getElementById('sidebar');
                if (!sidebar || !sidebar.classList.contains('collapsed')) return;

                clearTimeout(hideTimer);
                const rect = link.getBoundingClientRect();
                tip.textContent = link.dataset.tooltip;
                tip.style.display = 'block';
                tip.style.top  = Math.round(rect.top + rect.height / 2 - tip.offsetHeight / 2) + 'px';
                tip.style.left = Math.round(rect.right + 10) + 'px';
                // Re-measure after display:block
                requestAnimationFrame(() => {
                    tip.style.top = Math.round(rect.top + rect.height / 2 - tip.offsetHeight / 2) + 'px';
                    tip.classList.add('visible');
                });
            });

            link.addEventListener('mouseleave', () => {
                tip.classList.remove('visible');
                hideTimer = setTimeout(() => { tip.style.display = 'none'; }, 160);
            });
        });
    });
}());

/* ── Global appointment cache (for edit drawer) ───────────── */
let _allAppts         = [];
let _editApptServices = [];
let _apptDateFrom     = null; // YYYY-MM-DD
let _apptDateTo       = null; // YYYY-MM-DD
let _fpApptFrom       = null;
let _fpApptTo         = null;

/* ── Dashboard ────────────────────────────────────────────── */
async function loadDashboard() {
    const stats = await apiFetch('/api/admin/stats');
    if (!stats) return;

    if (document.getElementById('stat-bookings')) {
        document.getElementById('stat-bookings').textContent  = stats.activeBookings  ?? 0;
    }
    if (document.getElementById('stat-customers')) {
        document.getElementById('stat-customers').textContent = stats.activeCustomers ?? 0;
    }

    const appts = await apiFetch('/api/admin/appointments');
    if (!appts) return;

    _allAppts = appts;

    const tbody = document.querySelector('#recent-appointments-table tbody');
    if (!tbody) return;

    // Dashboard: show only Pending and Confirmed appointments (waiting for completion/payment)
    // Sorted by appointment_id descending to show the most recent bookings first
    const active = appts
        .filter(a => a.status === 'Pending' || a.status === 'Confirmed')
        .sort((a, b) => b.appointment_id - a.appointment_id);
    if (!active.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#9a7840;padding:2rem;font-size:0.88rem;letter-spacing:1px;"><i class="bi bi-check-circle" style="margin-right:6px;color:#6fcf8a;"></i>No pending tasks</td></tr>`;
    } else {
        tbody.innerHTML = active.map(a => renderApptRow(a)).join('');
    }
}

/* ── Shared appointment row renderer ─────────────────────── */
function renderApptRow(a) {
    const adv        = parseFloat(a.advance_paid          || 0);
    const promoDisc  = parseFloat(a.discount_amount       || 0);
    const manualDisc = parseFloat(a.manual_discount_amount || 0);
    const disc       = promoDisc + manualDisc;
    const bal        = Math.max(0, parseFloat(a.total_cost || 0) - disc - adv);
    const isConfirmed = a.status === 'Confirmed';
    return `
    <tr>
        <td>${a.customer_name}</td>
        <td>${a.customer_mobile || a.mobile_number || '—'}</td>
        <td><span class="appt-date-pill">${_fmtDateDDMMYYYY(a.appointment_date)}</span></td>
        <td>${_fmtTime12(a.appointment_time)}</td>
        <td>₹${Number(a.total_cost).toLocaleString('en-IN')}${promoDisc > 0 ? `<br><span style="font-size:0.72rem;color:#6fcf8a;"><i class="bi bi-ticket-perforated"></i> ${a.discount_code} −₹${promoDisc.toLocaleString('en-IN')}</span>` : ''}${manualDisc > 0 ? `<br><span style="font-size:0.72rem;color:#a8e6b8;"><i class="bi bi-person-check"></i> Manual ${a.manual_discount_type === 'percent' ? '(%)' : '(Fixed)'} −₹${manualDisc.toLocaleString('en-IN')}</span>` : ''}</td>
        <td style="color:${adv > 0 ? '#6fcf8a' : '#9a7840'}">₹${adv.toLocaleString('en-IN')}</td>
        <td style="color:${bal > 0 ? '#e07060' : '#6fcf8a'}">₹${bal.toLocaleString('en-IN')}</td>
        <td>${renderStatusBadge(a.status)}</td>
        <td class="action-btns">
            ${a.status === 'Pending' ? `
            <button class="act-btn act-confirm" onclick="confirmAppointment(${a.appointment_id})" title="Confirm Appointment"><i class="bi bi-check"></i></button>
            <button class="act-btn act-deny"    onclick="denyAppointment(${a.appointment_id})"    title="Deny Appointment"><i class="bi bi-x"></i></button>` : ''}
            ${isConfirmed && bal > 0 ? `
            <button class="act-btn act-collect" onclick="collectPayment(${a.appointment_id},${bal},${a.total_cost})" title="Collect Cash/UPI Payment"><i class="bi bi-cash-coin"></i></button>
            <button class="act-btn act-request-pay ${a.payment_requested ? 'active' : ''}" onclick="requestOnlinePayment(${a.appointment_id})" title="${a.payment_requested ? 'Online Payment Already Requested' : 'Request Online Payment from Customer'}"><i class="bi bi-credit-card"></i></button>` : ''}
            <button class="act-btn act-view"   onclick="openViewApptDrawer(${a.appointment_id})"  title="View"><i class="bi bi-eye"></i></button>
            <button class="act-btn act-edit"   onclick="openEditApptDrawer(${a.appointment_id})"  title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="act-btn act-invoice" onclick="downloadAdminInvoice(${a.appointment_id})" title="Download Invoice"><i class="bi bi-download"></i></button>
            <button class="act-btn act-delete" onclick="deleteAppointment(${a.appointment_id})"   title="Delete"><i class="bi bi-trash"></i></button>
        </td>
    </tr>`;
}

/* ── Payment actions ──────────────────────────────────────── */

// Shared: build the discount HTML block used in both payment modals
function _discountHtml(balance) {
    return `
        <div class="kb-swal-field" style="margin-top:1rem;border-top:1px solid rgba(212,175,55,0.15);padding-top:1rem;">
            <label class="kb-swal-label" style="letter-spacing:1px;">🏷 Discount (optional)</label>
            <div style="display:flex;gap:0.6rem;align-items:center;margin-top:0.4rem;">
                <select id="swal-disc-type" class="kb-swal-select" style="width:130px;flex-shrink:0;" onchange="recalcDiscount(${balance})">
                    <option value="none">No Discount</option>
                    <option value="fixed">Fixed ₹</option>
                    <option value="percent">Percent %</option>
                    <option value="promo">Promo Code</option>
                </select>
                <input id="swal-disc-value" type="number" min="0" step="0.01" placeholder="Amount / %"
                    class="kb-swal-input" style="display:none;" oninput="recalcDiscount(${balance})">
                <input id="swal-promo-code" type="text" placeholder="Enter code"
                    class="kb-swal-input" style="display:none;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()">
                <button id="swal-promo-apply" type="button" onclick="applyPromoInModal(${balance})"
                    style="display:none;padding:0.65rem 1rem;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.35);
                    color:#d4af37;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:700;white-space:nowrap;">
                    Apply
                </button>
            </div>
            <div id="swal-disc-preview" style="display:none;margin-top:0.8rem;padding:0.65rem 0.9rem;
                background:rgba(111,207,138,0.08);border:1px solid rgba(111,207,138,0.25);border-radius:8px;
                color:#6fcf8a;font-size:0.85rem;font-weight:700;"></div>
        </div>`;
}

// Recalc discount preview for fixed/percent types
function recalcDiscount(balance) {
    const type = document.getElementById('swal-disc-type')?.value;
    const valEl = document.getElementById('swal-disc-value');
    const promoEl = document.getElementById('swal-promo-code');
    const applyBtn = document.getElementById('swal-promo-apply');
    const preview = document.getElementById('swal-disc-preview');
    const amtEl = document.getElementById('swal-amount');

    valEl.style.display    = (type === 'fixed' || type === 'percent') ? 'block' : 'none';
    promoEl.style.display  = type === 'promo' ? 'block' : 'none';
    applyBtn.style.display = type === 'promo' ? 'block' : 'none';

    if (type === 'none') {
        preview.style.display = 'none';
        valEl.value = ''; promoEl.value = '';
        if (amtEl) amtEl.value = parseFloat(balance).toFixed(2);
        preview.dataset.discountAmount = 0;
        preview.dataset.discountType   = '';
        preview.dataset.discountCode   = '';
        return;
    }
    if (type === 'promo') return; // handled by applyPromoInModal

    const val = parseFloat(valEl.value) || 0;
    let disc = 0;
    if (type === 'fixed')   disc = Math.min(val, balance);
    if (type === 'percent') disc = Math.min(Math.round(balance * val / 100), balance);

    if (disc > 0) {
        preview.style.display = 'block';
        const typeLabel = type === 'percent' ? `${val}% off` : `Fixed ₹${val.toLocaleString('en-IN')}`;
        preview.innerHTML = `<i class="bi bi-tag-fill"></i>  ${typeLabel} → Discount: −₹${disc.toLocaleString('en-IN')}  →  Payable: ₹${Math.max(0, balance - disc).toLocaleString('en-IN')}`;
        if (amtEl) amtEl.value = Math.max(0, balance - disc).toFixed(2);
    } else {
        preview.style.display = 'none';
        if (amtEl) amtEl.value = parseFloat(balance).toFixed(2);
    }
    // Store for preConfirm
    preview.dataset.discountAmount = disc;
    preview.dataset.discountType   = type;
    preview.dataset.discountCode   = '';
}

// Apply promo code in modal (async fetch)
async function applyPromoInModal(balance) {
    const code = document.getElementById('swal-promo-code')?.value?.trim();
    const preview = document.getElementById('swal-disc-preview');
    const amtEl  = document.getElementById('swal-amount');
    if (!code) return;

    const r = await fetch('/api/promo-codes/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, order_amount: balance })
    }).then(x => x.json()).catch(() => ({ valid: false, error: 'Network error.' }));

    if (!r.valid) {
        preview.style.cssText = 'display:block;margin-top:0.8rem;padding:0.65rem 0.9rem;background:rgba(224,112,96,0.08);border:1px solid rgba(224,112,96,0.25);border-radius:8px;color:#e07060;font-size:0.85rem;font-weight:700;';
        preview.innerHTML = `<i class="bi bi-exclamation-circle"></i>  ${r.error}`;
        preview.dataset.discountAmount = 0;
        return;
    }

    const disc = Math.min(r.discount_amount, balance);
    preview.style.cssText = 'display:block;margin-top:0.8rem;padding:0.65rem 0.9rem;background:rgba(111,207,138,0.08);border:1px solid rgba(111,207,138,0.25);border-radius:8px;color:#6fcf8a;font-size:0.85rem;font-weight:700;';
    preview.innerHTML = `<i class="bi bi-check-circle-fill"></i>  "${r.code}" applied! Discount: −₹${disc.toLocaleString('en-IN')}  →  Payable: ₹${Math.max(0, balance - disc).toLocaleString('en-IN')}`;
    preview.dataset.discountAmount = disc;
    preview.dataset.discountType   = r.discount_type;
    preview.dataset.discountCode   = r.code;
    if (amtEl) amtEl.value = Math.max(0, balance - disc).toFixed(2);
}

async function collectPayment(id, balance, total) {
    const _cAppt = _allAppts.find(x => x.appointment_id === id);
    const _promoDisc  = parseFloat(_cAppt?.discount_amount        || 0);
    const _existManual = parseFloat(_cAppt?.manual_discount_amount || 0);

    const { value: formValues } = await Swal.fire({
        title: 'Collect Payment',
        width: 500,
        html: `
            <div class="kb-swal-hint">
                Total: <strong style="color:#fcf6ba;font-size:1rem;">₹${Number(total).toLocaleString('en-IN')}</strong>
                &nbsp;·&nbsp;
                Balance Due: <strong style="color:#f0c040;font-size:1rem;">₹${Number(balance).toLocaleString('en-IN')}</strong>
            </div>
            ${_promoDisc > 0 ? `<div style="margin:0.4rem 0;padding:0.45rem 0.8rem;background:rgba(111,207,138,0.08);border:1px solid rgba(111,207,138,0.25);border-radius:8px;font-size:0.82rem;color:#6fcf8a;text-align:left;">
                <i class="bi bi-ticket-perforated" style="margin-right:4px;"></i>Promo <strong>${_cAppt.discount_code}</strong>: −₹${_promoDisc.toLocaleString('en-IN')} already applied
            </div>` : ''}
            ${_existManual > 0 ? `<div style="margin:0.4rem 0;padding:0.45rem 0.8rem;background:rgba(111,207,138,0.06);border:1px solid rgba(111,207,138,0.2);border-radius:8px;font-size:0.82rem;color:#6fcf8a;text-align:left;">
                <i class="bi bi-person-check" style="margin-right:4px;"></i>Previous manual discount: −₹${_existManual.toLocaleString('en-IN')} already applied
            </div>` : ''}
            <div class="kb-swal-row">
                <div class="kb-swal-field">
                    <label class="kb-swal-label">Amount Collected (₹)</label>
                    <input id="swal-amount" type="number" min="0.01" step="0.01" value="${balance}"
                        class="kb-swal-input" placeholder="0.00">
                </div>
                <div class="kb-swal-field">
                    <label class="kb-swal-label">Payment Method</label>
                    <select id="swal-method" class="kb-swal-select">
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>
            ${_discountHtml(balance)}`,
        showCancelButton: true,
        confirmButtonText: '✓ Mark as Collected',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
            const preview = document.getElementById('swal-disc-preview');
            const additionalManual = parseFloat(preview?.dataset.discountAmount || 0) || 0;
            return {
                amount:                  parseFloat(document.getElementById('swal-amount').value),
                method:                  document.getElementById('swal-method').value,
                manual_discount_amount:  _existManual + additionalManual,
                manual_discount_type:    preview?.dataset.discountType || _cAppt?.manual_discount_type || null,
            };
        },
        didOpen: () => {
            const amtEl  = document.getElementById('swal-amount');
            const typeEl = document.getElementById('swal-disc-type');
            const valEl  = document.getElementById('swal-disc-value');
            if (amtEl)  { amtEl.focus(); amtEl.select(); }
            if (typeEl) typeEl.addEventListener('change', () => recalcDiscount(balance));
            if (valEl)  valEl.addEventListener('input',  () => recalcDiscount(balance));
        }
    });
    if (!formValues) return;
    if (isNaN(formValues.amount) || formValues.amount <= 0) { toast('Enter a valid amount.', 'error'); return; }

    const res = await apiFetch(`/api/admin/appointments/${id}/collect-payment`, {
        method: 'POST',
        body: JSON.stringify(formValues)
    });
    if (res?.success) {
        const totalDisc = _promoDisc + formValues.manual_discount_amount;
        const discNote = totalDisc > 0 ? ` | Total discount: ₹${totalDisc.toLocaleString('en-IN')}` : '';
        toast(`₹${formValues.amount.toLocaleString('en-IN')} collected via ${formValues.method}.${discNote} ${res.new_status === 'Completed' ? 'Appointment Completed! Moving to Appointments.' : ''}`, 'success');
        
        // Switch to Appointments tab so admin sees the updated status
        const apptNavLink = document.querySelector(`.nav-link[onclick*="'appointments'"]`);
        switchTab('appointments', apptNavLink);
        loadDashboard();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function requestOnlinePayment(id) {
    const appt = _allAppts.find(a => a.appointment_id === id);
    const promoDisc   = parseFloat(appt?.discount_amount        || 0);
    const existManual = parseFloat(appt?.manual_discount_amount || 0);
    const balance = appt ? Math.max(0, parseFloat(appt.total_cost||0) - promoDisc - existManual - parseFloat(appt.advance_paid||0)) : 0;

    const { value: formValues } = await Swal.fire({
        title: 'Request Online Payment',
        width: 480,
        html: `
            <div class="kb-swal-hint" style="text-align:left;">
                Send a <strong style="color:#fcf6ba;">Pay Now</strong> button to the customer's dashboard.
                ${balance > 0 ? `Balance due: <strong style="color:#f0c040;">₹${balance.toLocaleString('en-IN')}</strong>` : ''}
            </div>
            ${promoDisc > 0 ? `<div style="margin:0.4rem 0;padding:0.45rem 0.8rem;background:rgba(111,207,138,0.08);border:1px solid rgba(111,207,138,0.25);border-radius:8px;font-size:0.82rem;color:#6fcf8a;text-align:left;">
                <i class="bi bi-ticket-perforated" style="margin-right:4px;"></i>Promo <strong>${appt.discount_code}</strong>: −₹${promoDisc.toLocaleString('en-IN')} already applied
            </div>` : ''}
            ${existManual > 0 ? `<div style="margin:0.4rem 0;padding:0.45rem 0.8rem;background:rgba(111,207,138,0.06);border:1px solid rgba(111,207,138,0.2);border-radius:8px;font-size:0.82rem;color:#6fcf8a;text-align:left;">
                <i class="bi bi-person-check" style="margin-right:4px;"></i>Manual discount: −₹${existManual.toLocaleString('en-IN')} already applied
            </div>` : ''}
            ${_discountHtml(balance)}`,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send"></i> Send Request',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
            const preview = document.getElementById('swal-disc-preview');
            const additionalManual = parseFloat(preview?.dataset.discountAmount || 0) || 0;
            return {
                manual_discount_amount: existManual + additionalManual,
                manual_discount_type:   preview?.dataset.discountType || appt?.manual_discount_type || null,
            };
        },
        didOpen: () => {
            const typeEl = document.getElementById('swal-disc-type');
            const valEl  = document.getElementById('swal-disc-value');
            if (typeEl) typeEl.addEventListener('change', () => recalcDiscount(balance));
            if (valEl)  valEl.addEventListener('input',  () => recalcDiscount(balance));
        }
    });
    if (!formValues) return;

    const res = await apiFetch(`/api/admin/appointments/${id}/request-payment`, {
        method: 'POST',
        body: JSON.stringify(formValues)
    });
    if (res?.success) {
        const discNote = formValues.manual_discount_amount > 0 ? ` with manual discount ₹${formValues.manual_discount_amount.toLocaleString('en-IN')}` : '';
        toast(`Payment request sent${discNote}. Customer will see it on their dashboard.`, 'success');
        loadDashboard(); loadAppointments();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

/* ── Services ─────────────────────────────────────────────── */
/* ── Services filter state ────────────────────────────────── */
let _allServices     = [];
let _svcFilterGender = 'all';
let _svcFilterCat    = 'all';
let _svcFilterSearch = '';

async function loadServices() {
    const services = await apiFetch('/api/admin/services');
    if (!services) return;

    _allServices = services;

    // Populate custom category dropdown
    const catDrop = document.getElementById('svc-cat-dropdown');
    if (catDrop) {
        const cats = [...new Map(services.map(s => [s.category_id, { id: s.category_id, name: s.category_name }])).values()];
        catDrop.innerHTML =
            `<div class="admin-time-option${_svcFilterCat === 'all' ? ' selected' : ''}"
                  onclick="selectCatFilter('all','All Categories')">All Categories</div>` +
            cats.map(c =>
                `<div class="admin-time-option${String(c.id) === String(_svcFilterCat) ? ' selected' : ''}"
                      onclick="selectCatFilter('${c.id}','${c.name.replace(/'/g,"\\'")}')">
                    ${c.name}
                 </div>`
            ).join('');
    }

    _renderServicesTable();
}

function _renderServicesTable() {
    const tbody = document.querySelector('#services-manage-table tbody');
    if (!tbody) return;

    const q = _svcFilterSearch.toLowerCase();
    const filtered = _allServices.filter(s => {
        const sGender    = s.gender || 'men'; // fallback for legacy rows without gender
        const genderOk   = _svcFilterGender === 'all' || sGender === _svcFilterGender;
        const catOk      = _svcFilterCat    === 'all' || String(s.category_id) === String(_svcFilterCat);
        const searchOk   = !q || s.name.toLowerCase().includes(q) || s.category_name.toLowerCase().includes(q);
        return genderOk && catOk && searchOk;
    });

    const badge = document.getElementById('svc-count-badge');
    if (badge) badge.textContent = `${filtered.length} service${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9a7840;padding:2rem;letter-spacing:1px;font-size:0.85rem;">No services match the current filters.</td></tr>`;
        return;
    }

    // Disabled services go to the end
    const sorted = [...filtered].sort((a, b) => {
        if (a.is_enabled === b.is_enabled) return 0;
        return a.is_enabled ? -1 : 1;
    });

    const genderIcon = g => g === 'women'
        ? '<i class="bi bi-person-fill-up" style="font-size:0.72rem;margin-right:3px;"></i>'
        : '<i class="bi bi-person-fill" style="font-size:0.72rem;margin-right:3px;"></i>';

    tbody.innerHTML = sorted.map(s => {
        const sg = s.gender || 'men';
        const canDelete = parseInt(s.billing_count) === 0;
        const disabledRow = s.is_enabled ? '' : 'style="opacity:0.55;"';
        return `
        <tr ${disabledRow}>
            <td>${s.name}</td>
            <td>${s.category_name}</td>
            <td><span class="gender-badge ${sg}">${genderIcon(sg)}${sg === 'women' ? 'Women' : 'Men'}</span></td>
            <td>₹${s.price}</td>
            <td><span class="badge ${s.is_enabled ? 'badge-success' : 'badge-danger'}">${s.is_enabled ? 'Active' : 'Disabled'}</span></td>
            <td>
                <button class="btn-action" onclick="editService(${s.service_id},${s.price},${s.is_enabled ? 1 : 0},'${s.name.replace(/'/g, "\\'")}')" title="Edit service">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-action" onclick="toggleServiceEnabled(${s.service_id},${s.is_enabled ? 1 : 0},'${s.name.replace(/'/g, "\\'")}')"
                    title="${s.is_enabled ? 'Disable service' : 'Enable service'}"
                    style="color:${s.is_enabled ? '#c0503a' : '#4caf50'};">
                    <i class="bi ${s.is_enabled ? 'bi-toggle-on' : 'bi-toggle-off'}"></i>
                </button>
                <button class="btn-action" onclick="editTranslations(${s.service_id},'${s.name.replace(/'/g, "\\'")}')" title="Manage translations" style="font-size:0.7rem;padding:6px 8px;">
                    <i class="bi bi-translate"></i>
                </button>
                ${canDelete ? `
                <button class="btn-action" onclick="deleteService(${s.service_id},'${s.name.replace(/'/g, "\\'")}')" title="Delete service" style="color:#c0503a;">
                    <i class="bi bi-trash3"></i>
                </button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

/* ── Category filter custom dropdown ─────────────────────── */
function toggleCatFilterDrop() {
    const trigger  = document.getElementById('svc-cat-trigger');
    const dropdown = document.getElementById('svc-cat-dropdown');
    if (!trigger || !dropdown) return;
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    trigger.classList.toggle('open', !isOpen);
}

function selectCatFilter(value, label) {
    _svcFilterCat = value;
    const trigger  = document.getElementById('svc-cat-trigger');
    const dropdown = document.getElementById('svc-cat-dropdown');
    const labelEl  = document.getElementById('svc-cat-label');
    if (labelEl)  labelEl.textContent = label;
    if (trigger)  { trigger.classList.remove('open'); trigger.classList.toggle('has-value', value !== 'all'); }
    if (dropdown) {
        dropdown.classList.remove('open');
        dropdown.querySelectorAll('.admin-time-option').forEach(o =>
            o.classList.toggle('selected', o.textContent.trim() === label));
    }
    _renderServicesTable();
}

function filterServices(type, value, tabEl) {
    if (type === 'gender') {
        _svcFilterGender = value;
        document.querySelectorAll('#svc-gender-tabs .svc-filter-tab').forEach(b => b.classList.remove('active'));
        if (tabEl) tabEl.classList.add('active');
    } else if (type === 'category') {
        _svcFilterCat = value;
    } else if (type === 'search') {
        _svcFilterSearch = value;
    }
    _renderServicesTable();
}

/* ── Add Service Page ─────────────────────────────────────── */
function openAddServiceDrawer() {
    document.getElementById('svc-name').value  = '';
    document.getElementById('svc-price').value = '';
    document.getElementById('svc-enabled').checked = true;

    const sel = document.getElementById('svc-category');
    sel.innerHTML = '<option value="">Loading…</option>';
    apiFetch('/api/admin/categories').then(cats => {
        if (!cats || !cats.length) {
            sel.innerHTML = '<option value="">No categories found</option>';
            return;
        }
        const men   = cats.filter(c => c.gender === 'men');
        const women = cats.filter(c => c.gender === 'women');
        let html = '';
        if (men.length) {
            html += `<optgroup label="── Men ──">` + men.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('') + `</optgroup>`;
        }
        if (women.length) {
            html += `<optgroup label="── Women ──">` + women.map(c => `<option value="${c.category_id}">${c.name}</option>`).join('') + `</optgroup>`;
        }
        sel.innerHTML = html || '<option value="">No categories found</option>';
    });

    openFormPage('add-service-page', 'services');
    setTimeout(() => document.getElementById('svc-name').focus(), 80);
}

function closeAddServiceDrawer() {
    closeFormPage();
}

async function submitAddService() {
    const name    = document.getElementById('svc-name').value.trim();
    const priceStr = document.getElementById('svc-price').value;
    const cat_id  = document.getElementById('svc-category').value;
    const enabled = document.getElementById('svc-enabled').checked;

    if (!name)   { toast('Please enter a service name.', 'error'); return; }
    if (!cat_id) { toast('Please select a category.', 'error'); return; }
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) { toast('Enter a valid price.', 'error'); return; }

    const btn = document.getElementById('add-svc-btn');
    btn.classList.add('btn-loading');

    const result = await apiFetch('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({ category_id: cat_id, name, price, is_enabled: enabled })
    });

    btn.classList.remove('btn-loading');

    if (result?.success) {
        toast('Service added successfully!', 'success');
        closeAddServiceDrawer();
        loadServices();
    } else {
        toast('Failed to add service. ' + (result?.error || ''), 'error');
    }
}

/* ── Add Category Page ────────────────────────────────────── */
function openAddCategoryDrawer() {
    document.getElementById('cat-name').value = '';
    const genderSel = document.getElementById('cat-gender');
    if (genderSel) genderSel.value = 'men';
    openFormPage('add-category-page', 'services');
    setTimeout(() => document.getElementById('cat-name').focus(), 80);
}

function closeAddCategoryDrawer() {
    closeFormPage();
}

async function submitAddCategory() {
    const name   = document.getElementById('cat-name').value.trim();
    const gender = document.getElementById('cat-gender')?.value || 'men';
    if (!name) { toast('Please enter a category name.', 'error'); return; }

    const btn = document.getElementById('add-cat-btn');
    btn.classList.add('btn-loading');

    const result = await apiFetch('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name, gender })
    });

    btn.classList.remove('btn-loading');

    if (result?.success) {
        toast('Category created!', 'success');
        closeAddCategoryDrawer();
        loadCatImages();
        loadServices();
    } else {
        toast('Failed to create category. ' + (result?.error || ''), 'error');
    }
}

/* ── Edit Service Page ────────────────────────────────────── */
function editService(id, price, enabledInt, name) {
    document.getElementById('edit-svc-id').value           = id;
    document.getElementById('edit-svc-name-display').value = name || '';
    document.getElementById('edit-svc-price').value        = price;
    document.getElementById('edit-svc-enabled').checked    = !!enabledInt;

    openFormPage('edit-service-page', 'services');
    setTimeout(() => document.getElementById('edit-svc-price').focus(), 80);
}

function closeEditServiceDrawer() {
    closeFormPage();
}

async function submitEditService() {
    const id      = document.getElementById('edit-svc-id').value;
    const price   = parseFloat(document.getElementById('edit-svc-price').value);
    const enabled = document.getElementById('edit-svc-enabled').checked;

    if (isNaN(price) || price < 0) { toast('Enter a valid price.', 'error'); return; }

    const btn = document.getElementById('edit-svc-btn');
    btn.classList.add('btn-loading');

    await apiFetch('/api/admin/services/' + id, {
        method: 'PUT',
        body: JSON.stringify({ price, is_enabled: enabled })
    });

    btn.classList.remove('btn-loading');
    toast('Service updated!', 'success');
    closeEditServiceDrawer();
    loadServices();
}

/* ── Quick toggle enabled/disabled ───────────────────────── */
async function toggleServiceEnabled(id, currentlyEnabled, name) {
    const newState = !currentlyEnabled;
    const label = newState ? 'enable' : 'disable';
    const ok = await confirm(
        `${newState ? 'Enable' : 'Disable'} Service?`,
        `This will ${label} "${name}" and ${newState ? 'make it bookable' : 'hide it from bookings'}.`,
        newState ? 'Yes, Enable' : 'Yes, Disable'
    );
    if (!ok) return;

    const result = await apiFetch(`/api/admin/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: newState })
    });
    if (result?.success) {
        toast(`Service ${newState ? 'enabled' : 'disabled'}.`, 'success');
        loadServices();
    } else {
        toast('Failed: ' + (result?.error || 'Unknown error'), 'error');
    }
}

/* ── Delete Service ───────────────────────────────────────── */
async function deleteService(id, name) {
    const ok = await confirm(
        'Delete Service?',
        `This will permanently delete "${name}". This cannot be undone.`,
        'Yes, Delete'
    );
    if (!ok) return;

    const result = await apiFetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    if (result?.success) {
        toast('Service deleted.', 'success');
        loadServices();
    } else {
        toast('Cannot delete: ' + (result?.error || 'Unknown error'), 'error');
    }
}

/* ── Service Translations Modal ───────────────────────────── */
async function editTranslations(serviceId, serviceName) {
    document.getElementById('trans-svc-id').value       = serviceId;
    document.getElementById('trans-svc-subtitle').textContent = `"${serviceName}"`;

    // Clear fields
    ['te-what','te-why','te-how','hi-what','hi-why','hi-how'].forEach(id => {
        document.getElementById(id).value = '';
    });

    // Reset to first tab
    switchLangTab('te', document.querySelector('.lang-tab'));

    // Open immediately — load data in background
    document.getElementById('trans-modal-backdrop').classList.add('open');

    const existing = await apiFetch(`/api/admin/services/${serviceId}/translations`);
    if (existing) {
        existing.forEach(r => {
            const p = r.lang_code;
            if (document.getElementById(`${p}-what`)) document.getElementById(`${p}-what`).value = r.description_what || '';
            if (document.getElementById(`${p}-why`))  document.getElementById(`${p}-why`).value  = r.description_why  || '';
            if (document.getElementById(`${p}-how`))  document.getElementById(`${p}-how`).value  = r.description_how  || '';
        });
    }
}

function closeTranslationsModal() {
    document.getElementById('trans-modal-backdrop').classList.remove('open');
}

function switchLangTab(code, el) {
    document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.lang-panel').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');
    const panel = document.getElementById('lang-panel-' + code);
    if (panel) panel.classList.add('active');
}

async function submitTranslations() {
    const serviceId = document.getElementById('trans-svc-id').value;
    const langs = [
        { code: 'te', what: document.getElementById('te-what').value, why: document.getElementById('te-why').value, how: document.getElementById('te-how').value },
        { code: 'hi', what: document.getElementById('hi-what').value, why: document.getElementById('hi-why').value, how: document.getElementById('hi-how').value }
    ];

    const btn = document.getElementById('trans-save-btn');
    btn.classList.add('btn-loading');

    let allOk = true;
    for (const { code, what, why, how } of langs) {
        const result = await apiFetch(`/api/admin/services/${serviceId}/translations`, {
            method: 'PUT',
            body: JSON.stringify({ lang_code: code, description_what: what, description_why: why, description_how: how })
        });
        if (!result?.success) allOk = false;
    }

    btn.classList.remove('btn-loading');

    if (allOk) {
        toast('Translations saved!', 'success');
        closeTranslationsModal();
    } else {
        toast('Some translations failed to save.', 'error');
    }
}

/* ── Appointments ─────────────────────────────────────────── */
async function loadAppointments() {
    let statsUrl = '/api/admin/stats';
    if (_apptDateFrom || _apptDateTo) {
        statsUrl += `?from=${_apptDateFrom || ''}&to=${_apptDateTo || ''}`;
    }
    const stats = await apiFetch(statsUrl);
    if (stats) {
        if (document.getElementById('appt-stat-bookings'))  document.getElementById('appt-stat-bookings').textContent  = stats.globalBookings ?? 0;
        if (document.getElementById('appt-stat-revenue'))   document.getElementById('appt-stat-revenue').textContent   = '₹' + (stats.totalRevenue ?? 0).toLocaleString('en-IN');
        if (document.getElementById('appt-stat-customers')) document.getElementById('appt-stat-customers').textContent = stats.globalCustomers ?? 0;
    }

    const appts = await apiFetch('/api/admin/appointments');
    if (!appts) return;

    _allAppts = appts;
    const tbody = document.querySelector('#all-appointments-table tbody');
    if (!tbody) return;

    // Filter out Pending appointments AND Confirmed appointments with a balance
    const visible = appts.filter(a => {
        if (a.status === 'Pending') return false;
        
        const adv        = parseFloat(a.advance_paid          || 0);
        const promoDisc  = parseFloat(a.discount_amount       || 0);
        const manualDisc = parseFloat(a.manual_discount_amount || 0);
        const disc       = promoDisc + manualDisc;
        const bal        = Math.max(0, parseFloat(a.total_cost || 0) - disc - adv);
        
        // If it's Confirmed but still has a balance, it's still being processed on dashboard
        if (a.status === 'Confirmed' && bal > 0) return false;
        
        // Date Range Filter
        if (_apptDateFrom || _apptDateTo) {
            const rowDate = String(a.appointment_date).slice(0, 10);
            if (_apptDateFrom && rowDate < _apptDateFrom) return false;
            if (_apptDateTo   && rowDate > _apptDateTo)   return false;
        }

        return true;
    }).sort((a, b) => b.appointment_id - a.appointment_id);
    tbody.innerHTML = visible.map(a => renderApptRow(a)).join('');

    // Toggle Clear button visibility
    const clearBtn = document.getElementById('appt-filter-clear');
    if (clearBtn) clearBtn.style.display = (_apptDateFrom || _apptDateTo) ? 'flex' : 'none';
}

function clearApptDateFilter() {
    _apptDateFrom = null;
    _apptDateTo   = null;
    if (_fpApptFrom) _fpApptFrom.clear();
    if (_fpApptTo)   _fpApptTo.clear();
    loadAppointments();
}

async function downloadAdminInvoice(id) {
    const token = localStorage.getItem('adminToken');
    if (!token) { toast('Not authenticated.', 'error'); return; }

    const btn = document.querySelector(`[onclick="downloadAdminInvoice(${id})"]`);
    if (btn) { btn.classList.add('btn-loading'); btn.disabled = true; }

    try {
        const response = await fetch(`/api/admin/appointments/${id}/invoice`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) { toast('Failed to generate invoice.', 'error'); return; }

        const blob = await response.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `KB_Invoice_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('Invoice downloaded.', 'success');
    } catch (err) {
        toast('Download failed: ' + err.message, 'error');
    } finally {
        if (btn) { btn.classList.remove('btn-loading'); btn.disabled = false; }
    }
}

async function deleteAppointment(id) {
    const ok = await confirm(
        'Delete Appointment?',
        'This will permanently remove the appointment and all its records. This cannot be undone.',
        'Yes, Delete'
    );
    if (!ok) return;

    const res = await apiFetch(`/api/admin/appointments/${id}`, { method: 'DELETE' });
    if (res?.success) {
        toast('Appointment deleted.', 'success');
        loadAppointments();
        loadDashboard();
    } else {
        toast('Failed to delete: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function updateStatus(id, status) {
    const ok = await confirm(
        'Mark as Completed?',
        'This will update the appointment status to Completed.',
        'Yes, Mark Done'
    );
    if (!ok) return;

    await apiFetch('/api/admin/appointments/' + id, {
        method: 'PUT',
        body: JSON.stringify({ status })
    });
    toast('Appointment marked as ' + status + '.', 'success');
    loadAppointments();
    loadDashboard();
}

/* ── View Appointment Page ────────────────────────────────── */
function openViewApptDrawer(id) {
    const a = _allAppts.find(x => x.appointment_id === id);
    if (!a) { toast('Appointment not found. Refresh and try again.', 'error'); return; }

    const statusClass = a.status === 'Completed' ? 'success' : a.status === 'Cancelled' ? 'error' : 'warning';
    const statusColors = { Completed: '#6fcf8a', Cancelled: '#e07060', Confirmed: '#d4af37', Pending: '#bf953f' };
    const statusColor  = statusColors[a.status] || '#d4af37';

    const dateStr = String(a.appointment_date).slice(0, 10);
    const [y,m,d] = dateStr.split('-');
    const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate = `${d} ${months[parseInt(m)-1]} ${y}`;

    const services    = Array.isArray(a.services) ? a.services : [];
    const total       = parseFloat(a.total_cost            || 0);
    const promoDisc   = parseFloat(a.discount_amount       || 0);
    const manualDisc  = parseFloat(a.manual_discount_amount || 0);
    const disc        = promoDisc + manualDisc;
    const advPaid     = parseFloat(a.advance_paid || 0);
    const balDue      = Math.max(0, total - disc - advPaid);

    // If all service prices are 0 but total_cost is set, distribute total_cost equally
    const svcPriceSum = services.reduce((s, x) => s + parseFloat(x.price || 0) * (x.quantity || 1), 0);
    const useFallback = svcPriceSum === 0 && total > 0 && services.length > 0;
    const fallbackPer = useFallback ? total / services.length : 0;

    document.getElementById('view-appt-content').innerHTML = `
        <div class="view-appt-header">
            <div class="view-appt-id">#${a.appointment_id}</div>
            <span class="view-appt-status" style="color:${statusColor};border-color:${statusColor}33;background:${statusColor}11;">${a.status}</span>
        </div>

        <div class="view-section">
            <div class="view-section-label"><i class="bi bi-person"></i> Customer</div>
            <div class="view-info-grid">
                <div class="view-info-row"><span class="view-info-key">Name</span><span class="view-info-val">${a.customer_name}</span></div>
                <div class="view-info-row"><span class="view-info-key">Mobile</span><span class="view-info-val">${a.customer_mobile || a.mobile_number || '—'}</span></div>
                ${a.customer_email ? `<div class="view-info-row"><span class="view-info-key">Email</span><span class="view-info-val">${a.customer_email}</span></div>` : ''}
            </div>
        </div>

        <div class="view-section">
            <div class="view-section-label"><i class="bi bi-calendar3"></i> Schedule</div>
            <div class="view-info-grid">
                <div class="view-info-row"><span class="view-info-key">Date</span><span class="view-info-val">${fmtDate}</span></div>
                <div class="view-info-row"><span class="view-info-key">Time</span><span class="view-info-val">${_fmtTime12(a.appointment_time)}</span></div>
            </div>
        </div>

        <div class="view-section">
            <div class="view-section-label"><i class="bi bi-scissors"></i> Services</div>
            ${services.length ? services.map(s => {
                const unitPrice = parseFloat(s.price || 0) || fallbackPer;
                const lineTotal = unitPrice * (s.quantity || 1);
                return `<div class="view-service-row">
                    <span class="view-svc-name">${s.service_name}</span>
                    <span class="view-svc-qty">×${s.quantity || 1}</span>
                    <span class="view-svc-price">₹${lineTotal.toLocaleString('en-IN')}</span>
                </div>`;
            }).join('') : '<p style="color:var(--text-muted);font-size:0.83rem;">No services recorded.</p>'}
        </div>

        <div class="view-section view-totals">
            <div class="view-total-row"><span>Service Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>
            ${promoDisc > 0 ? `<div class="view-total-row dim" style="color:#6fcf8a;">
                <span><i class="bi bi-ticket-perforated" style="margin-right:4px;font-size:0.78rem;"></i>Promo Code &nbsp;<span style="font-size:0.72rem;background:rgba(111,207,138,0.12);border:1px solid rgba(111,207,138,0.3);padding:1px 7px;border-radius:4px;font-weight:700;">${a.discount_code}</span></span>
                <span>−₹${promoDisc.toLocaleString('en-IN')}</span>
            </div>` : ''}
            ${manualDisc > 0 ? `<div class="view-total-row dim" style="color:#a8e6b8;">
                <span><i class="bi bi-person-check" style="margin-right:4px;font-size:0.78rem;"></i>${a.manual_discount_type === 'percent' ? 'Manual Discount (%)' : 'Manual Discount (Fixed)'}</span>
                <span>−₹${manualDisc.toLocaleString('en-IN')}</span>
            </div>` : ''}
            ${disc > 0 ? `<div class="view-total-row dim"><span>Net Amount</span><span>₹${(total - disc).toLocaleString('en-IN')}</span></div>` : ''}
            ${_gstHtml(total - disc)}
            <div class="view-total-row dim"><span>${balDue === 0 ? 'Total Paid' : 'Amount Paid'}</span><span style="color:${advPaid > 0 ? '#6fcf8a' : 'inherit'}">₹${advPaid.toLocaleString('en-IN')}</span></div>
            <div class="view-total-row balance"><span>Remaining Balance</span><span style="color:${balDue > 0 ? '#e07060' : '#6fcf8a'}">₹${balDue.toLocaleString('en-IN')}</span></div>
        </div>`;

    document.getElementById('view-appt-edit-btn').onclick = () => openEditApptDrawer(id);

    openFormPage('view-appt-page', 'appointments');
}

function closeViewApptDrawer() {
    closeFormPage();
}

/* ── Edit Appointment Drawer ──────────────────────────────── */
async function openEditApptDrawer(id) {
    const a = _allAppts.find(x => x.appointment_id === id);
    if (!a) { toast('Appointment not found. Refresh and try again.', 'error'); return; }

    document.getElementById('edit-appt-id').value       = a.appointment_id;
    document.getElementById('edit-appt-customer').value = a.customer_name;
    document.getElementById('edit-appt-mobile').value   = a.customer_mobile || a.mobile_number || '';

    const dateStr = typeof a.appointment_date === 'string'
        ? a.appointment_date.slice(0, 10)
        : new Date(a.appointment_date).toISOString().slice(0, 10);
    const timeStr = (a.appointment_time || '').slice(0, 5);
    document.getElementById('edit-appt-status').value = a.status;

    // Init flatpickr for date
    if (_fpEditAppt) _fpEditAppt.destroy();
    _fpEditAppt = flatpickr('#edit-appt-date', {
        dateFormat: 'Y-m-d',
        disableMobile: true,
        locale: { firstDayOfWeek: 1 },
        defaultDate: dateStr,
        onChange: (_, ds) => { if (ds) _populateAdminTimeSlots('edit-appt', ds); }
    });

    // Populate time slots and pre-select existing time
    await _populateAdminTimeSlots('edit-appt', dateStr);
    if (timeStr) {
        document.getElementById('edit-appt-time').value = timeStr;
        const label = document.getElementById('edit-appt-time-label');
        const trigger = document.getElementById('edit-appt-time-trigger');
        if (label) label.textContent = _fmtTime12(timeStr);
        if (trigger) trigger.classList.add('has-value');
        // Mark selected option
        document.querySelectorAll('#edit-appt-time-dropdown .admin-time-option').forEach(o =>
            o.classList.toggle('selected', o.dataset.value === timeStr)
        );
    }

    // Clone current services
    _editApptServices = (Array.isArray(a.services) ? a.services : []).map(s => ({
        service_id:   s.service_id,
        service_name: s.service_name,
        quantity:     s.quantity || 1,
        price:        s.price || 0
    }));
    _renderApptServicesList();

    _loadSvcDropdown('edit-appt');

    openFormPage('edit-appt-page', 'appointments');
}

function _renderApptServicesList() {
    const list = document.getElementById('edit-appt-services-list');
    const totEl = document.getElementById('edit-appt-total');
    if (!list) return;

    if (_editApptServices.length === 0) {
        list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-dim);margin:0 0 0.4rem;">No services — add at least one.</p>';
        if (totEl) totEl.textContent = '';
        return;
    }

    list.innerHTML = _editApptServices.map((s, i) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;
                    background:rgba(30,20,5,0.55);border:1px solid rgba(212,175,55,0.15);
                    border-radius:0.5rem;margin-bottom:0.35rem;">
            <span style="flex:1;font-size:0.83rem;color:#e8d5a0;">${s.service_name}</span>
            <label style="font-size:0.72rem;color:#9a7840;white-space:nowrap;">Qty</label>
            <input type="number" min="1" max="20" value="${s.quantity}"
                   style="width:48px;padding:0.2rem 0.35rem;background:rgba(13,10,2,0.85);
                          border:1px solid rgba(212,175,55,0.25);border-radius:0.3rem;
                          color:#e8d5a0;font-size:0.8rem;text-align:center;"
                   onchange="_editApptServices[${i}].quantity=Math.max(1,parseInt(this.value)||1)">
            <button onclick="_removeApptService(${i})"
                    style="background:none;border:none;color:#c0503a;cursor:pointer;padding:0.2rem 0.4rem;font-size:0.88rem;"
                    title="Remove service"><i class="bi bi-trash"></i></button>
        </div>`).join('');
}

function addApptService() {
    const hidden = document.getElementById('edit-appt-add-svc');
    const svcId  = parseInt(hidden?.value);
    if (!svcId) { toast('Select a service first.', 'warning'); return; }
    if (_editApptServices.find(s => s.service_id === svcId)) {
        toast('Already added — adjust the quantity instead.', 'warning'); return;
    }
    _editApptServices.push({
        service_id:   svcId,
        service_name: hidden.dataset.name || '',
        quantity:     1,
        price:        parseFloat(hidden.dataset.price) || 0
    });
    _renderApptServicesList();
    // Reset picker
    hidden.value = '';
    const label   = document.getElementById('edit-appt-svc-label');
    const trigger = document.getElementById('edit-appt-svc-trigger');
    if (label)   label.textContent = 'Search & select a service…';
    if (trigger) trigger.classList.remove('has-value');
    _renderSvcItems('edit-appt', _svcAllItems['edit-appt'] || []);
}

function _removeApptService(idx) {
    _editApptServices.splice(idx, 1);
    _renderApptServicesList();
}

async function submitEditAppt() {
    const id     = document.getElementById('edit-appt-id').value;
    const date   = document.getElementById('edit-appt-date').value;
    const time   = document.getElementById('edit-appt-time').value;
    const status = document.getElementById('edit-appt-status').value;

    if (!date || !time) { toast('Date and time are required.', 'error'); return; }
    if (_editApptServices.length === 0) { toast('At least one service is required.', 'error'); return; }

    const btn = document.getElementById('edit-appt-btn');
    if (btn) btn.classList.add('btn-loading');

    // Step 1: update date / time / status
    const patch = await apiFetch(`/api/admin/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ appointment_date: date, appointment_time: time, status })
    });

    // Step 2: replace service list
    const svcUpd = await apiFetch(`/api/appointments/${id}/services`, {
        method: 'PUT',
        body: JSON.stringify({
            services: _editApptServices.map(s => ({ service_id: s.service_id, quantity: s.quantity }))
        })
    });

    if (btn) btn.classList.remove('btn-loading');

    if (patch?.success && svcUpd?.success) {
        closeEditApptDrawer();
        await Promise.all([loadAppointments(), loadDashboard()]);
        toast('Appointment updated successfully.', 'success');
    } else {
        toast('Save failed: ' + (patch?.error || svcUpd?.error || 'Unknown error'), 'error');
    }
}

function closeEditApptDrawer() {
    if (_fpEditAppt) { _fpEditAppt.destroy(); _fpEditAppt = null; }
    closeFormPage();
}

/* ── Admin New Appointment ────────────────────────────────── */
let _newApptServices = [];
let _newApptSearchTimer = null;

async function openNewApptDrawer(el) {
    if (el) {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        el.classList.add('active');
    }
    // Reset form
    _newApptServices = [];
    document.getElementById('new-appt-cust-search').value = '';
    document.getElementById('new-appt-cust-name').value   = '';
    document.getElementById('new-appt-cust-mobile').value = '';
    document.getElementById('new-appt-cust-email').value  = '';
    document.getElementById('new-appt-cust-badge').style.display = 'none';
    document.getElementById('new-appt-cust-dropdown').style.display = 'none';
    document.getElementById('new-appt-status').value = 'Confirmed';
    document.getElementById('new-appt-note').value   = '';
    document.getElementById('new-appt-time-val').value = '';
    document.getElementById('new-appt-time-label').textContent = 'Pick a date first';
    document.getElementById('new-appt-time-trigger').classList.remove('has-value');
    document.getElementById('new-appt-time-dropdown').innerHTML = '';
    _renderNewApptServices();

    // Init flatpickr for date
    if (_fpNewAppt) _fpNewAppt.destroy();
    _fpNewAppt = flatpickr('#new-appt-date', {
        minDate: 'today',
        dateFormat: 'Y-m-d',
        disableMobile: true,
        locale: { firstDayOfWeek: 1 },
        onChange: (_, dateStr) => { if (dateStr) _populateAdminTimeSlots('new-appt', dateStr); }
    });

    const currentTab = localStorage.getItem('adminTab') || 'dashboard';
    openFormPage('new-appt-page', currentTab);
    _loadSvcDropdown('new-appt');
    setTimeout(() => document.getElementById('new-appt-cust-search').focus(), 80);
}

function closeNewApptDrawer() {
    document.getElementById('new-appt-cust-dropdown').style.display = 'none';
    if (_fpNewAppt) { _fpNewAppt.destroy(); _fpNewAppt = null; }
    closeFormPage();
}

function searchNewApptCustomer(q) {
    clearTimeout(_newApptSearchTimer);
    const dd = document.getElementById('new-appt-cust-dropdown');
    if (!q.trim()) { dd.style.display = 'none'; return; }
    _newApptSearchTimer = setTimeout(async () => {
        const results = await apiFetch(`/api/admin/customers/search?q=${encodeURIComponent(q)}`);
        if (!results?.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = results.map(c => `
            <div onclick="selectNewApptCustomer(${c.customer_id},'${(c.name||'').replace(/'/g,"\\'")}','${c.mobile_number}','${c.email||''}')"
                 style="padding:0.6rem 1rem;cursor:pointer;border-bottom:1px solid rgba(212,175,55,0.1);
                        font-size:0.83rem;color:#e8d5a0;"
                 onmouseover="this.style.background='rgba(212,175,55,0.08)'"
                 onmouseout="this.style.background=''">
                <strong>${c.name}</strong>
                <span style="color:var(--text-muted);margin-left:8px;">${c.mobile_number}</span>
                ${c.email ? `<span style="color:var(--text-dim);margin-left:6px;font-size:0.76rem;">${c.email}</span>` : ''}
            </div>`).join('');
        dd.style.display = 'block';
    }, 280);
}

function selectNewApptCustomer(_id, name, mobile, email) {
    document.getElementById('new-appt-cust-search').value = name + ' — ' + mobile;
    document.getElementById('new-appt-cust-name').value   = name;
    document.getElementById('new-appt-cust-mobile').value = mobile;
    document.getElementById('new-appt-cust-email').value  = email || '';
    document.getElementById('new-appt-cust-dropdown').style.display = 'none';
    const badge = document.getElementById('new-appt-cust-badge');
    badge.textContent = '✓ Existing customer selected — details pre-filled';
    badge.style.display = 'block';
}


function _renderNewApptServices() {
    const list  = document.getElementById('new-appt-services-list');
    const totEl = document.getElementById('new-appt-total');
    if (!list) return;
    if (!_newApptServices.length) {
        list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-dim);margin:0 0 0.4rem;">No services — add at least one.</p>';
        if (totEl) totEl.textContent = '';
        return;
    }
    list.innerHTML = _newApptServices.map((s, i) => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.7rem;
                    background:rgba(30,20,5,0.55);border:1px solid rgba(212,175,55,0.15);
                    border-radius:0.5rem;margin-bottom:0.35rem;">
            <span style="flex:1;font-size:0.83rem;color:#e8d5a0;">${s.service_name}</span>
            <label style="font-size:0.72rem;color:#9a7840;white-space:nowrap;">Qty</label>
            <input type="number" min="1" max="20" value="${s.quantity}"
                   style="width:48px;padding:0.2rem 0.35rem;background:rgba(13,10,2,0.85);
                          border:1px solid rgba(212,175,55,0.25);border-radius:0.3rem;
                          color:#e8d5a0;font-size:0.8rem;text-align:center;"
                   onchange="_newApptServices[${i}].quantity=Math.max(1,parseInt(this.value)||1);_renderNewApptServices()">
            <button onclick="_newApptServices.splice(${i},1);_renderNewApptServices()"
                    style="background:none;border:none;color:#c0503a;cursor:pointer;padding:0.2rem 0.4rem;font-size:0.88rem;"
                    title="Remove"><i class="bi bi-trash"></i></button>
        </div>`).join('');
    const total = _newApptServices.reduce((sum, s) => sum + parseFloat(s.price||0) * (s.quantity||1), 0);
    if (totEl) totEl.textContent = `Total: ₹${total.toLocaleString('en-IN')}`;
}

function addNewApptService() {
    const hidden = document.getElementById('new-appt-add-svc');
    const svcId  = parseInt(hidden?.value);
    if (!svcId) { toast('Select a service first.', 'warning'); return; }
    if (_newApptServices.find(s => s.service_id === svcId)) {
        toast('Already added — adjust the quantity instead.', 'warning'); return;
    }
    _newApptServices.push({
        service_id:   svcId,
        service_name: hidden.dataset.name || '',
        quantity:     1,
        price:        parseFloat(hidden.dataset.price) || 0
    });
    _renderNewApptServices();
    // Reset the picker
    hidden.value = '';
    const label   = document.getElementById('new-appt-svc-label');
    const trigger = document.getElementById('new-appt-svc-trigger');
    if (label)   label.textContent = 'Search & select a service…';
    if (trigger) trigger.classList.remove('has-value');
    _renderSvcItems('new-appt', _svcAllItems['new-appt'] || []);
}

async function submitNewAppt() {
    const name   = document.getElementById('new-appt-cust-name').value.trim();
    const mobile = document.getElementById('new-appt-cust-mobile').value.trim();
    const email  = document.getElementById('new-appt-cust-email').value.trim();
    const date   = document.getElementById('new-appt-date').value;
    const time   = document.getElementById('new-appt-time-val').value;
    const status = document.getElementById('new-appt-status').value;
    const note   = document.getElementById('new-appt-note').value.trim();

    if (!name)   { toast('Customer name is required.', 'error'); return; }
    if (!mobile) { toast('Mobile number is required.', 'error'); return; }
    if (!date)   { toast('Date is required.', 'error'); return; }
    if (!time)   { toast('Time is required.', 'error'); return; }
    if (!_newApptServices.length) { toast('Add at least one service.', 'error'); return; }

    const totalCost = _newApptServices.reduce((s, sv) => s + parseFloat(sv.price||0) * (sv.quantity||1), 0);

    const btn = document.getElementById('new-appt-btn');
    btn.classList.add('btn-loading');

    const res = await apiFetch('/api/admin/appointments/create', {
        method: 'POST',
        body: JSON.stringify({
            customerInfo: { name, mobile_number: mobile, email: email || null },
            appointmentDate: date,
            appointmentTime: time,
            services: _newApptServices.map(s => ({ service_id: s.service_id, quantity: s.quantity })),
            totalCost,
            status,
            adminNote: note
        })
    });

    btn.classList.remove('btn-loading');

    if (res?.success) {
        toast(`Appointment #${res.appointmentId} created! Opening payment...`, 'success');
        closeNewApptDrawer();
        // Wait for list to sync so collectPayment can find the new ID in _allAppts
        await loadAppointments();
        // Trigger the payment popup immediately
        collectPayment(res.appointmentId, totalCost, totalCost);
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

/* ── Customers ────────────────────────────────────────────── */
async function loadCustomers() {
    const customers = await apiFetch('/api/admin/customers');
    if (!customers) return;

    const tbody = document.querySelector('#customers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = customers.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.mobile_number}</td>
            <td>${c.email || '—'}</td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td class="action-btns">
                <button class="act-btn act-view"   onclick="openViewCustomer(${c.customer_id})"   title="View"><i class="bi bi-eye"></i></button>
                <button class="act-btn act-edit"   onclick="openEditCustomer(${c.customer_id},'${(c.name||'').replace(/'/g,"\\'")}','${c.mobile_number}','${c.email||''}')" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="act-btn act-delete" onclick="deleteCustomer(${c.customer_id},'${(c.name||'').replace(/'/g,"\\'")}')" title="Delete"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`).join('');
}

async function openViewCustomer(id) {
    const data = await apiFetch(`/api/admin/customers/${id}`);
    if (!data) return;

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate = d => {
        const s = String(d).slice(0, 10).split('-');
        return `${s[2]} ${months[parseInt(s[1])-1]} ${s[0]}`;
    };
    const statusColor = { Completed:'#6fcf8a', Cancelled:'#e07060', Confirmed:'#d4af37', Pending:'#bf953f' };

    document.getElementById('view-cust-content').innerHTML = `
        <div class="view-appt-header">
            <div class="view-appt-id">${data.name}</div>
        </div>

        <div class="view-section">
            <div class="view-section-label"><i class="bi bi-person-vcard"></i> Contact</div>
            <div class="view-info-grid">
                <div class="view-info-row"><span class="view-info-key">Mobile</span><span class="view-info-val">${data.mobile_number}</span></div>
                <div class="view-info-row"><span class="view-info-key">Email</span><span class="view-info-val">${data.email || '—'}</span></div>
                <div class="view-info-row"><span class="view-info-key">Since</span><span class="view-info-val">${new Date(data.created_at).toLocaleDateString()}</span></div>
            </div>
        </div>

        <div class="view-section">
            <div class="view-section-label"><i class="bi bi-calendar-check"></i> Appointments (${data.appointments.length})</div>
            ${data.appointments.length ? data.appointments.map(a => `
                <div class="view-service-row" style="flex-wrap:wrap;gap:0.35rem 0.7rem;">
                    <span class="view-svc-name">${fmtDate(a.appointment_date)} ${(a.appointment_time||'').slice(0,5)}</span>
                    <span class="view-svc-qty" style="color:${statusColor[a.status]||'#d4af37'};">${a.status}</span>
                    <span class="view-svc-price">₹${Number(a.total_cost).toLocaleString('en-IN')}</span>
                </div>`).join('') : '<p style="color:var(--text-muted);font-size:0.83rem;">No appointments yet.</p>'}
        </div>`;

    document.getElementById('view-cust-edit-btn').onclick = () =>
        openEditCustomer(data.customer_id, data.name, data.mobile_number, data.email || '');

    openFormPage('view-customer-page', 'customers');
}

function closeViewCustomer() {
    closeFormPage();
}

function openEditCustomer(id, name, mobile, email) {
    document.getElementById('edit-cust-id').value     = id;
    document.getElementById('edit-cust-name').value   = name || '';
    document.getElementById('edit-cust-mobile').value = mobile || '';
    document.getElementById('edit-cust-email').value  = email || '';
    openFormPage('edit-customer-page', 'customers');
    setTimeout(() => document.getElementById('edit-cust-name').focus(), 80);
}

function closeEditCustomer() {
    closeFormPage();
}

async function submitEditCustomer() {
    const id     = document.getElementById('edit-cust-id').value;
    const name   = document.getElementById('edit-cust-name').value.trim();
    const mobile = document.getElementById('edit-cust-mobile').value.trim();
    const email  = document.getElementById('edit-cust-email').value.trim();

    if (!name || !mobile) { toast('Name and mobile are required.', 'error'); return; }

    const btn = document.getElementById('edit-cust-btn');
    btn.classList.add('btn-loading');

    const res = await apiFetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, mobile_number: mobile, email: email || null })
    });

    btn.classList.remove('btn-loading');

    if (res?.success) {
        toast('Customer updated.', 'success');
        closeEditCustomer();
        loadCustomers();
    } else {
        toast('Update failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function deleteCustomer(id, name) {
    const ok = await confirm(
        'Delete Customer?',
        `This will permanently delete "${name}" and all their appointments. This cannot be undone.`,
        'Yes, Delete'
    );
    if (!ok) return;

    const res = await apiFetch(`/api/admin/customers/${id}`, { method: 'DELETE' });
    if (res?.success) {
        toast('Customer deleted.', 'success');
        loadCustomers();
        loadDashboard();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}


/* ── Settings ─────────────────────────────────────────────── */
async function loadAdvanceSetting() {
    const data = await apiFetch('/api/settings');
    if (!data) return;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('setting-working-start', data.working_start || '09:00');
    setVal('setting-working-end',   data.working_end   || '23:00');
    setVal('setting-slot-duration', data.slot_duration || 30);
    setVal('setting-max-concurrent', data.max_concurrent || 1);

    const activeDays = data.working_days || [1,2,3,4,5,6];
    document.querySelectorAll('#working-days-wrap .day-toggle').forEach(el => {
        const day = parseInt(el.dataset.day);
        el.classList.toggle('active', activeDays.includes(day));
        el.onclick = () => el.classList.toggle('active');
    });

    setVal('setting-advance-type',  data.advance_type  || 'fixed');
    setVal('setting-advance-value', data.advance_value ?? 1);
    const lblEl = document.getElementById('setting-value-label');
    if (lblEl) lblEl.textContent = data.advance_type === 'percent' ? 'Advance Percentage' : 'Advance Amount (₹)';
    document.getElementById('setting-advance-type')?.addEventListener('change', e => {
        if (lblEl) lblEl.textContent = e.target.value === 'percent' ? 'Advance Percentage' : 'Advance Amount (₹)';
    });

    setVal('setting-cgst-rate', data.cgst_rate ?? 0);
    setVal('setting-sgst-rate', data.sgst_rate ?? 0);
    _gstSettings = { cgst_rate: data.cgst_rate ?? 0, sgst_rate: data.sgst_rate ?? 0 };

    setVal('setting-social-instagram', data.social_instagram || '');
    setVal('setting-social-facebook',  data.social_facebook  || '');
    setVal('setting-social-youtube',   data.social_youtube   || '');
    setVal('setting-social-twitter',   data.social_twitter   || '');
    setVal('setting-social-whatsapp',  data.social_whatsapp  || '');
    setVal('setting-social-tiktok',    data.social_tiktok    || '');
    setVal('setting-maps-url',         data.maps_url         || '');
}

async function saveAdvanceSetting() {
    const proprietor_name = document.getElementById('setting-proprietor-name').value.trim();
    const service_mobile  = document.getElementById('setting-service-mobile').value.trim();
    const service_whatsapp = document.getElementById('setting-service-whatsapp').value.trim();
    const advance_type   = document.getElementById('setting-advance-type').value;
    const advance_value  = parseFloat(document.getElementById('setting-advance-value').value);
    const working_start  = document.getElementById('setting-working-start').value;
    const working_end    = document.getElementById('setting-working-end').value;
    const slot_duration  = parseInt(document.getElementById('setting-slot-duration').value);
    const max_concurrent = parseInt(document.getElementById('setting-max-concurrent').value);
    const cgst_rate      = parseFloat(document.getElementById('setting-cgst-rate')?.value || 0) || 0;
    const sgst_rate      = parseFloat(document.getElementById('setting-sgst-rate')?.value || 0) || 0;

    const activeDayEls = document.querySelectorAll('#working-days-wrap .day-toggle.active');
    const working_days = Array.from(activeDayEls).map(el => parseInt(el.dataset.day));

    if (isNaN(advance_value) || advance_value < 0) { toast('Enter a valid advance amount.', 'error'); return; }
    if (!working_start || !working_end)             { toast('Set valid working hours.', 'error'); return; }
    if (working_days.length === 0)                  { toast('Select at least one working day.', 'error'); return; }

    const btn = document.querySelector('#settings-view .btn-action.primary-action');
    if (btn) btn.classList.add('btn-loading');

    const social_instagram = document.getElementById('setting-social-instagram')?.value.trim() || '';
    const social_facebook  = document.getElementById('setting-social-facebook')?.value.trim()  || '';
    const social_youtube   = document.getElementById('setting-social-youtube')?.value.trim()   || '';
    const social_twitter   = document.getElementById('setting-social-twitter')?.value.trim()   || '';
    const social_whatsapp  = document.getElementById('setting-social-whatsapp')?.value.trim()  || '';
    const social_tiktok    = document.getElementById('setting-social-tiktok')?.value.trim()    || '';
    const maps_url         = document.getElementById('setting-maps-url')?.value.trim()         || '';

    const result = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ advance_type, advance_value, working_start, working_end, slot_duration, working_days, max_concurrent, cgst_rate, sgst_rate,
                               social_instagram, social_facebook, social_youtube, social_twitter, social_whatsapp, social_tiktok, maps_url })
    });

    if (btn) btn.classList.remove('btn-loading');

    if (result?.success) {
        _gstSettings = { cgst_rate, sgst_rate };
        toast('Settings saved! Changes take effect for new bookings.', 'success');
    } else {
        toast('Failed: ' + (result?.error || 'Unknown error'), 'error');
    }
}

/* ── Logout ───────────────────────────────────────────────── */
function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    location.href = '/admin-login.html';
}

/* ══════════════════════════════════════════════════════════
   ── Promo Codes ──────────────────────────────────────────
   ══════════════════════════════════════════════════════════ */

async function loadPromoCodes() {
    const tbody = document.querySelector('#promo-codes-table tbody');
    if (!tbody) return;
    let codes;
    try {
        codes = await apiFetch('/api/admin/promo-codes');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#e07060;">Failed to load promo codes. Please restart the server.</td></tr>`;
        return;
    }
    if (!codes) return;
    if (codes.error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#e07060;">${codes.error}</td></tr>`;
        return;
    }
    if (!Array.isArray(codes) || !codes.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);">No promo codes yet. Create your first one!</td></tr>';
        return;
    }

    tbody.innerHTML = codes.map(p => {
        const discLabel = p.discount_type === 'percent'
            ? `${p.discount_value}%${p.max_discount_cap ? ' (max ₹' + p.max_discount_cap + ')' : ''}`
            : `₹${parseFloat(p.discount_value).toLocaleString('en-IN')}`;
        const expired = p.valid_until && new Date(p.valid_until) < new Date();
        const statusColor = (!p.is_active || expired) ? '#e07060' : '#6fcf8a';
        const statusLabel = expired ? 'Expired' : p.is_active ? 'Active' : 'Inactive';
        const toggleIcon  = p.is_active && !expired ? 'bi-pause-circle'   : 'bi-play-circle';
        const toggleLabel = p.is_active && !expired ? 'Disable'           : 'Enable';
        const toggleColor = p.is_active && !expired ? '#e07060'           : '#6fcf8a';
        return `<tr>
            <td><strong style="color:#fcf6ba;font-family:monospace;letter-spacing:1px;">${p.code}</strong>
                ${p.description ? `<br><span style="font-size:0.72rem;color:var(--text-muted);">${p.description}</span>` : ''}</td>
            <td><span style="color:#d4af37;font-weight:700;">${discLabel}</span></td>
            <td>${p.min_order_amount > 0 ? '₹' + parseFloat(p.min_order_amount).toLocaleString('en-IN') : '—'}</td>
            <td>${p.used_count}${p.max_uses ? ' / ' + p.max_uses : ' / ∞'}</td>
            <td style="font-size:0.82rem;">${p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-IN') : '—'}</td>
            <td><span style="color:${statusColor};font-weight:700;font-size:0.8rem;">${statusLabel}</span></td>
            <td class="action-btns" style="white-space:nowrap;">
                <button class="btn-action" onclick="editPromoCode(${p.promo_id})" title="Edit" style="font-size:0.72rem;padding:0.3rem 0.6rem;">
                    <i class="bi bi-pencil" style="margin-right:3px;"></i>Edit
                </button>
                <button class="btn-action" onclick="togglePromoCode(${p.promo_id}, ${!p.is_active})"
                    title="${toggleLabel}" style="font-size:0.72rem;padding:0.3rem 0.6rem;color:${toggleColor};border-color:${toggleColor}33;">
                    <i class="bi ${toggleIcon}" style="margin-right:3px;"></i>${toggleLabel}
                </button>
                <button class="btn-action act-delete" onclick="deletePromoCode(${p.promo_id})" title="Delete" style="font-size:0.72rem;padding:0.3rem 0.6rem;">
                    <i class="bi bi-trash" style="margin-right:3px;"></i>Delete
                </button>
            </td>
        </tr>`;
    }).join('');
}

function updatePromoValueLabel() {
    const type = document.getElementById('promo-type')?.value;
    const lbl  = document.getElementById('promo-value-label');
    const capLbl = document.getElementById('promo-cap-label');
    if (lbl) lbl.textContent = type === 'percent' ? 'Discount %' : 'Discount Amount (₹)';
    if (capLbl) capLbl.style.opacity = type === 'percent' ? '1' : '0.35';
}

let _fpPromo = null;

function _initPromoFlatpickr(defaultDate) {
    if (_fpPromo) _fpPromo.destroy();
    _fpPromo = flatpickr('#promo-valid-until', {
        minDate: 'today',
        dateFormat: 'Y-m-d',
        disableMobile: true,
        locale: { firstDayOfWeek: 1 },
        defaultDate: defaultDate || null,
        allowInput: false,
    });
}

function openAddPromoDrawer() {
    document.getElementById('promo-drawer-title').textContent = 'New Promo Code';
    document.getElementById('promo-edit-id').value  = '';
    document.getElementById('promo-code').value     = '';
    document.getElementById('promo-code').disabled  = false;
    document.getElementById('promo-description').value = '';
    document.getElementById('promo-type').value     = 'percent';
    document.getElementById('promo-value').value    = '';
    document.getElementById('promo-min-order').value = '0';
    document.getElementById('promo-max-cap').value  = '';
    document.getElementById('promo-max-uses').value = '';
    document.getElementById('promo-active-row').style.display = 'none';
    updatePromoValueLabel();
    openFormPage('add-promo-page', 'discounts');
    setTimeout(() => { _initPromoFlatpickr(null); document.getElementById('promo-code').focus(); }, 100);
}

async function editPromoCode(id) {
    const codes = await apiFetch('/api/admin/promo-codes');
    const p = codes?.find(c => c.promo_id === id);
    if (!p) return;
    document.getElementById('promo-drawer-title').textContent = 'Edit Promo Code';
    document.getElementById('promo-edit-id').value  = id;
    document.getElementById('promo-code').value     = p.code;
    document.getElementById('promo-code').disabled  = true;
    document.getElementById('promo-description').value = p.description || '';
    document.getElementById('promo-type').value     = p.discount_type;
    document.getElementById('promo-value').value    = p.discount_value;
    document.getElementById('promo-min-order').value = p.min_order_amount || 0;
    document.getElementById('promo-max-cap').value  = p.max_discount_cap || '';
    document.getElementById('promo-max-uses').value = p.max_uses || '';
    document.getElementById('promo-active-row').style.display = 'flex';
    document.getElementById('promo-is-active').checked = p.is_active;
    updatePromoValueLabel();
    openFormPage('add-promo-page', 'discounts');
    setTimeout(() => _initPromoFlatpickr(p.valid_until ? p.valid_until.slice(0,10) : null), 100);
}

function closeAddPromoDrawer() {
    if (_fpPromo) { _fpPromo.destroy(); _fpPromo = null; }
    closeFormPage();
}

async function submitPromoCode() {
    const editId = document.getElementById('promo-edit-id').value;
    const code   = document.getElementById('promo-code').value.trim().toUpperCase();
    const val    = parseFloat(document.getElementById('promo-value').value);
    const type   = document.getElementById('promo-type').value;

    if (!code)       { toast('Enter a promo code.', 'error'); return; }
    if (isNaN(val) || val <= 0) { toast('Enter a valid discount value.', 'error'); return; }
    if (type === 'percent' && val > 100) { toast('Percentage cannot exceed 100%.', 'error'); return; }

    const payload = {
        code,
        description:      document.getElementById('promo-description').value.trim() || null,
        discount_type:    type,
        discount_value:   val,
        min_order_amount: parseFloat(document.getElementById('promo-min-order').value) || 0,
        max_discount_cap: document.getElementById('promo-max-cap').value ? parseFloat(document.getElementById('promo-max-cap').value) : null,
        max_uses:         document.getElementById('promo-max-uses').value ? parseInt(document.getElementById('promo-max-uses').value) : null,
        valid_until:      document.getElementById('promo-valid-until').value || null,
        is_active:        editId ? document.getElementById('promo-is-active').checked : true,
    };

    const btn = document.getElementById('promo-save-btn');
    btn.classList.add('btn-loading');
    const res = editId
        ? await apiFetch(`/api/admin/promo-codes/${editId}`, { method: 'PUT',  body: JSON.stringify(payload) })
        : await apiFetch('/api/admin/promo-codes',           { method: 'POST', body: JSON.stringify(payload) });
    btn.classList.remove('btn-loading');

    if (res?.success) {
        toast(editId ? 'Promo code updated!' : `Promo code "${code}" created!`, 'success');
        closeAddPromoDrawer();
        loadPromoCodes();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function togglePromoCode(id, newState) {
    const res = await apiFetch(`/api/admin/promo-codes/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: newState })
    });
    if (res?.success) {
        toast(newState ? 'Promo code enabled.' : 'Promo code disabled.', 'success');
        loadPromoCodes();
    } else {
        toast('Failed: ' + (res?.error || 'Unknown error'), 'error');
    }
}

async function deletePromoCode(id) {
    const ok = await confirm('Delete Promo Code?', 'This cannot be undone.', 'Yes, Delete');
    if (!ok) return;
    await apiFetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
    toast('Promo code deleted.', 'success');
    loadPromoCodes();
}

/* ── Category Images Management ──────────────────────────── */

let _allCatImages    = [];
let _catImgFilter    = 'all';

async function loadCatImages() {
    const grid = document.getElementById('catimages-grid');
    if (!grid) return;

    const cats = await apiFetch('/api/admin/categories');
    if (!cats) return;

    _allCatImages = cats;
    _renderCatImages();
}

function filterCatImages(gender, tabEl) {
    _catImgFilter = gender;
    document.querySelectorAll('#catimg-gender-tabs .svc-filter-tab').forEach(b => b.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');
    _renderCatImages();
}

function _renderCatImages() {
    const grid = document.getElementById('catimages-grid');
    if (!grid) return;

    const cats = _catImgFilter === 'all'
        ? _allCatImages
        : _allCatImages.filter(c => c.gender === _catImgFilter);

    if (!cats.length) {
        grid.innerHTML = `<p style="color:#9a7840;grid-column:1/-1;text-align:center;padding:2rem;font-size:0.85rem;letter-spacing:1px;">No categories in this section.</p>`;
        return;
    }

    const ts = Date.now();
    const fallback = '/images/hero section pic.png';
    const genderIcon = g => g === 'women'
        ? '<i class="bi bi-person-fill-up" style="font-size:0.65rem;margin-right:2px;"></i>'
        : '<i class="bi bi-person-fill" style="font-size:0.65rem;margin-right:2px;"></i>';

    grid.innerHTML = cats.map(c => {
        const imgUrl = c.has_image ? `/api/images/category/${c.category_id}?t=${ts}` : fallback;
        return `
        <div class="cat-preview-wrap" id="catimg-card-${c.category_id}">

            <!-- ── Preview card — identical look to homepage ── -->
            <div class="cat-preview-card" style="--cpbg:url('${imgUrl}')">
                <!-- blurred ambient bg layer -->
                <div class="cat-preview-blur"></div>
                <!-- sharp centered image -->
                <div class="cat-preview-img"></div>
                <!-- gender chip top-left -->
                <div class="cat-gender-chip ${c.gender}">${genderIcon(c.gender)}${c.gender === 'women' ? 'Women' : 'Men'}</div>
                <!-- gold label at bottom (same as user page) -->
                <div class="cat-preview-label">
                    <span class="cat-preview-label-text" id="catname-text-${c.category_id}">${c.name}</span>
                </div>
                <!-- admin action buttons — always visible top-right -->
                <div class="cat-preview-actions">
                    <label class="cat-act-btn upload" title="${c.has_image ? 'Replace image' : 'Upload image'}">
                        <i class="bi bi-${c.has_image ? 'arrow-repeat' : 'camera-fill'}"></i>
                        <input type="file" accept="image/*" style="display:none;"
                               onchange="uploadCatImage(${c.category_id}, this)">
                    </label>
                    ${c.has_image
                        ? `<button class="cat-act-btn remove" onclick="deleteCatImage(${c.category_id})" title="Remove image">
                               <i class="bi bi-trash-fill"></i>
                           </button>`
                        : ''}
                </div>
            </div>

            <!-- ── Admin footer: name + rename + delete ── -->
            <div class="cat-preview-footer">
                <div class="cat-name-row" id="catname-view-${c.category_id}">
                    <span class="cat-name-label" id="catname-display-${c.category_id}">${c.name}</span>
                    <div style="display:flex;gap:0.4rem;align-items:center;">
                        <button class="cat-rename-btn" onclick="startRenameCategory(${c.category_id})" title="Rename">
                            <i class="bi bi-pencil-fill"></i> Rename
                        </button>
                        <button class="cat-rename-btn" onclick="deleteCategory(${c.category_id})" title="Delete category"
                            style="color:#e07060;border-color:rgba(220,80,60,0.35);background:rgba(220,60,60,0.08);">
                            <i class="bi bi-trash3-fill"></i> Delete
                        </button>
                    </div>
                </div>
                <div class="cat-name-edit" id="catname-edit-${c.category_id}" style="display:none;">
                    <input class="cat-name-input" id="catname-input-${c.category_id}"
                           value="${c.name.replace(/"/g,'&quot;')}"
                           placeholder="Category label…"
                           onkeydown="if(event.key==='Enter')saveCategoryName(${c.category_id});if(event.key==='Escape')cancelRenameCategory(${c.category_id})">
                    <button class="cat-edit-btn save" onclick="saveCategoryName(${c.category_id})" title="Save">
                        <i class="bi bi-check-lg"></i>
                    </button>
                    <button class="cat-edit-btn cancel" onclick="cancelRenameCategory(${c.category_id})" title="Cancel">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function uploadCatImage(categoryId, input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please select an image file.', 'error'); return; }
    if (file.size > 8 * 1024 * 1024)    { toast('Image must be under 8 MB.', 'error'); return; }

    toast('Uploading…', 'info');
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res  = await fetch(`/api/admin/categories/${categoryId}/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) { toast('Category image updated!', 'success'); loadCatImages(); }
        else toast('Upload failed: ' + (data.error || ''), 'error');
    } catch (err) {
        console.error('[uploadCatImage]', err);
        toast('Upload failed.', 'error');
    }
}

async function deleteCatImage(categoryId) {
    const ok = await confirm('Remove Image?', 'The category card will show a placeholder until a new image is uploaded.', 'Yes, Remove');
    if (!ok) return;
    const res = await apiFetch(`/api/admin/categories/${categoryId}/image`, { method: 'DELETE' });
    if (res?.success) { toast('Image removed.', 'success'); loadCatImages(); }
    else toast('Failed to remove image.', 'error');
}

async function deleteCategory(categoryId) {
    const name = document.getElementById(`catname-display-${categoryId}`)?.textContent || 'this category';
    const ok = await confirm('Delete Category?', `"${name}" will be permanently deleted. This cannot be undone.`, 'Yes, Delete');
    if (!ok) return;
    const res = await apiFetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
    if (res?.success) { toast('Category deleted.', 'success'); loadCatImages(); loadServices(); }
    else toast(res?.error || 'Failed to delete category.', 'error');
}

function startRenameCategory(categoryId) {
    document.getElementById(`catname-view-${categoryId}`).style.display = 'none';
    const editEl = document.getElementById(`catname-edit-${categoryId}`);
    editEl.style.display = 'flex';
    const input = document.getElementById(`catname-input-${categoryId}`);
    input.focus();
    input.select();
}

function cancelRenameCategory(categoryId) {
    document.getElementById(`catname-edit-${categoryId}`).style.display = 'none';
    document.getElementById(`catname-view-${categoryId}`).style.display = 'flex';
}

async function saveCategoryName(categoryId) {
    const input   = document.getElementById(`catname-input-${categoryId}`);
    const newName = input.value.trim();
    if (!newName) { toast('Name cannot be empty.', 'error'); return; }

    const res = await apiFetch(`/api/admin/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName })
    });
    if (res?.success) {
        // Update both the preview label and the footer display
        const previewLabel = document.getElementById(`catname-text-${categoryId}`);
        const footerLabel  = document.getElementById(`catname-display-${categoryId}`);
        if (previewLabel) previewLabel.textContent = newName;
        if (footerLabel)  footerLabel.textContent  = newName;
        // Sync the input too so cancel after save shows correct value
        input.value = newName;
        cancelRenameCategory(categoryId);
        toast('Label renamed!', 'success');
    } else {
        toast('Failed to rename: ' + (res?.error || ''), 'error');
    }
}

/* ── Gallery Management ────────────────────────────────────── */

async function loadGalleryAdmin() {
    const grid = document.getElementById('gallery-admin-grid');
    if (!grid) return;

    const images = await apiFetch('/api/admin/gallery');
    if (!images) return;

    if (!images.length) {
        grid.innerHTML = `<p style="color:var(--text-muted);font-size:0.82rem;grid-column:1/-1;padding:1.5rem 0;">
            No gallery images yet — click <strong style="color:var(--gold-standard);">Upload Photo</strong> above to add the first one.
        </p>`;
        return;
    }

    const ts = Date.now();
    grid.innerHTML = images.map(img => `
        <div class="gallery-mgmt-card ${img.is_active ? '' : 'inactive'}" id="gal-card-${img.image_id}">
            <img class="gallery-mgmt-thumb"
                 src="/api/gallery/${img.image_id}/image?t=${ts}"
                 alt="Gallery photo"
                 onerror="this.style.opacity='0.15'">
            <span class="gallery-status-pill ${img.is_active ? 'active' : 'hidden'}">
                ${img.is_active ? 'LIVE' : 'HIDDEN'}
            </span>
            <div class="gallery-mgmt-body">
                <div class="gallery-mgmt-actions">
                    <label class="gal-replace-btn" title="Replace with a new photo">
                        <i class="bi bi-arrow-repeat"></i> Replace
                        <input type="file" accept="image/*" style="display:none;"
                               onchange="replaceGalleryImage(${img.image_id}, this)">
                    </label>
                    <button onclick="toggleGalleryActive(${img.image_id},${img.is_active})" title="${img.is_active ? 'Hide from homepage' : 'Show on homepage'}">
                        <i class="bi bi-eye${img.is_active ? '-slash' : ''}"></i> ${img.is_active ? 'Hide' : 'Show'}
                    </button>
                    <button class="del-btn" onclick="deleteGalleryImage(${img.image_id})" title="Delete permanently">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function openGalleryUpload() {
    const panel = document.getElementById('gallery-upload-panel');
    panel.style.display = 'flex';
    document.getElementById('gallery-upload-file').value = '';
    document.getElementById('gallery-upload-caption').value = '';
    document.getElementById('gallery-upload-sort').value = '0';
    document.getElementById('gallery-upload-preview').style.display = 'none';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeGalleryUpload() {
    document.getElementById('gallery-upload-panel').style.display = 'none';
}

function clearGalleryPreview() {
    document.getElementById('gallery-upload-file').value = '';
    document.getElementById('gallery-upload-preview').style.display = 'none';
}

function previewGalleryUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('gallery-preview-img').src = e.target.result;
        document.getElementById('gallery-upload-preview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function handleGalleryDrop(event) {
    event.preventDefault();
    document.getElementById('gallery-dropzone').classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { toast('Only image files are supported.', 'error'); return; }
    const dt   = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('gallery-upload-file');
    input.files  = dt.files;
    previewGalleryUpload(input);
}

async function submitGalleryUpload() {
    const fileInput = document.getElementById('gallery-upload-file');
    const file      = fileInput.files[0];
    if (!file) { toast('Please select or drop an image file.', 'error'); return; }
    if (!file.type.startsWith('image/'))   { toast('Only image files are allowed.', 'error'); return; }
    if (file.size > 8 * 1024 * 1024)       { toast('Image must be under 8 MB.', 'error'); return; }

    const caption    = document.getElementById('gallery-upload-caption').value.trim();
    const sort_order = document.getElementById('gallery-upload-sort').value;
    const btn = document.getElementById('gallery-upload-btn');
    btn.classList.add('btn-loading');

    const formData = new FormData();
    formData.append('image',      file);
    formData.append('caption',    caption);
    formData.append('sort_order', sort_order);

    try {
        const res  = await fetch('/api/admin/gallery', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            toast('Photo uploaded to gallery!', 'success');
            closeGalleryUpload();
            loadGalleryAdmin();
        } else {
            toast('Upload failed: ' + (data.error || ''), 'error');
        }
    } catch (err) {
        console.error('[submitGalleryUpload]', err);
        toast('Upload failed. Check your connection.', 'error');
    } finally {
        btn.classList.remove('btn-loading');
    }
}

async function replaceGalleryImage(id, input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Only image files are allowed.', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { toast('Image must be under 8 MB.', 'error'); return; }
    toast('Replacing image…', 'info');
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await fetch(`/api/admin/gallery/${id}/replace`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` },
            body: formData
        });
        const data = await res.json();
        if (data.success) { toast('Photo replaced!', 'success'); loadGalleryAdmin(); }
        else toast('Replace failed: ' + (data.error || ''), 'error');
    } catch (err) {
        console.error('[replaceGalleryImage]', err);
        toast('Replace failed. Check your connection.', 'error');
    }
}

async function toggleGalleryActive(id, currentlyActive) {
    const res = await apiFetch(`/api/admin/gallery/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !currentlyActive })
    });
    if (res?.success) {
        toast(currentlyActive ? 'Photo hidden from homepage.' : 'Photo is now live on homepage.', 'success');
        loadGalleryAdmin();
    } else toast('Failed.', 'error');
}

async function deleteGalleryImage(id) {
    const ok = await confirm('Delete Gallery Photo?', 'This permanently removes it from the homepage gallery.', 'Yes, Delete');
    if (!ok) return;
    const res = await apiFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    if (res?.success) { toast('Photo deleted.', 'success'); loadGalleryAdmin(); }
    else toast('Failed to delete.', 'error');
}

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    if (!token()) {
        document.body.style.display = 'none';
        location.href = '/admin-login.html';
        return;
    }

    const user = JSON.parse(localStorage.getItem('adminUser') || '{}');
    if (user.role !== 'admin') {
        document.body.style.display = 'none';
        location.href = '/admin-login.html';
        return;
    }
    const name = user.name || 'Admin';
    const el = (id) => document.getElementById(id);
    if (el('admin-name'))    el('admin-name').textContent    = name;
    if (el('user-name-pill'))el('user-name-pill').textContent = name;
    if (el('user-initials')) el('user-initials').textContent = name.substring(0, 2).toUpperCase();

    // Escape key closes only the translations modal (form pages use back button)
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeTranslationsModal();
    });

    // Restore last active tab (persists across refreshes)
    const savedTab = localStorage.getItem('adminTab') || 'dashboard';
    const savedNavLink = document.querySelector(`.nav-link[onclick*="'${savedTab}'"]`);
    switchTab(savedTab, savedNavLink);

    // Init All Appointments Date Range Filters (Flatpickr)
    const _commonPickerConfig = (targetVarName, instanceName) => ({
        dateFormat: 'd-m-Y',
        allowInput: true,
        onReady: (selectedDates, dateStr, instance) => {
            instance.input.removeAttribute('readonly');
            instance.input.addEventListener('blur', (e) => {
                const val = e.target.value;
                if (!val) {
                    window[targetVarName] = null;
                    loadAppointments();
                } else {
                    const d = instance.parseDate(val, 'd-m-Y');
                    if (d) {
                        window[targetVarName] = instance.formatDate(d, 'Y-m-d');
                        loadAppointments();
                    }
                }
            });
        },
        onChange: (selectedDates, dateStr, instance) => {
            window[targetVarName] = selectedDates.length > 0 ? instance.formatDate(selectedDates[0], 'Y-m-d') : null;
            loadAppointments();
        }
    });

    // Helper to allow updating global variables from within the config closure
    // Since these are defined with 'let' and not 'window.var', I'll just write them out explicitly instead of using window[prop] to be safe with closure scoping.
    
    _fpApptFrom = flatpickr('#appt-date-from', {
        dateFormat: 'd-m-Y',
        allowInput: true,
        onReady: (selectedDates, dateStr, instance) => {
            instance.input.removeAttribute('readonly');
            instance.input.addEventListener('blur', (e) => {
                const val = e.target.value.trim();
                if (!val) { _apptDateFrom = null; loadAppointments(); } 
                else {
                    // Normalize separators for better manual typing support
                    const normalized = val.replace(/[\/\.]/g, '-');
                    const d = instance.parseDate(normalized, 'd-m-Y');
                    if (d) { 
                        _apptDateFrom = instance.formatDate(d, 'Y-m-d'); 
                        instance.setDate(d, false); // Sync picker without triggering onChange
                        loadAppointments(); 
                    }
                }
            });
        },
        onChange: (selectedDates, dateStr, instance) => {
            _apptDateFrom = selectedDates.length > 0 ? instance.formatDate(selectedDates[0], 'Y-m-d') : null;
            loadAppointments();
        }
    });

    _fpApptTo = flatpickr('#appt-date-to', {
        dateFormat: 'd-m-Y',
        allowInput: true,
        onReady: (selectedDates, dateStr, instance) => {
            instance.input.removeAttribute('readonly');
            instance.input.addEventListener('blur', (e) => {
                const val = e.target.value.trim();
                if (!val) { _apptDateTo = null; loadAppointments(); }
                else {
                    const normalized = val.replace(/[\/\.]/g, '-');
                    const d = instance.parseDate(normalized, 'd-m-Y');
                    if (d) { 
                        _apptDateTo = instance.formatDate(d, 'Y-m-d'); 
                        instance.setDate(d, false);
                        loadAppointments(); 
                    }
                }
            });
        },
        onChange: (selectedDates, dateStr, instance) => {
            _apptDateTo = selectedDates.length > 0 ? instance.formatDate(selectedDates[0], 'Y-m-d') : null;
            loadAppointments();
        }
    });
});
