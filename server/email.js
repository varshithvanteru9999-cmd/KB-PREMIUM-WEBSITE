'use strict';

const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');
const { jsPDF }      = require('jspdf');
const { applyPlugin } = require('jspdf-autotable');
applyPlugin(jsPDF);   // patches jsPDF.prototype.autoTable for Node.js

// ─── Transporter ──────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'venu.vallepu.engineer@gmail.com',
        pass: process.env.SMTP_PASS || 'jtjm fwar wzzq lxhj',
    },
});

const LOGO_PATH = path.join(__dirname, '../public/images/kb logo.png');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    // If already YYYY-MM-DD, parse without timezone shift
    const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return new Date(d);
}

function fmtDate(d) {
    const dt = parseDate(d);
    if (!dt || isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
}

function fmtDateLong(d) {
    const dt = parseDate(d);
    if (!dt || isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(hhmm) {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function inrStr(num) {
    return parseFloat(num || 0).toLocaleString('en-IN');
}

// ─── PDF Invoice Generator ────────────────────────────────────────────────────
// Uses jsPDF (same library as dashboard) — exact copy of downloadInvoice logic.

function buildInvoicePdf(data, invoiceNoOverride) {
    const {
        appointmentId,
        customerName,
        customerEmail  = '',
        customerMobile = '',
        appointmentDate,
        appointmentTime,
        services        = [],
        totalCost,
        advancePaid     = 0,
        discountAmount       = 0,
        discountCode         = null,
        manualDiscountAmount = 0,
        manualDiscountType   = null,
        status               = 'Confirmed',
    } = data;

    // ── jsPDF in mm — identical to dashboard ──
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 18;

    // ── Load KB logo as base64 data URI (server-side) ──
    let logoData = null;
    if (fs.existsSync(LOGO_PATH)) {
        try {
            const buf = fs.readFileSync(LOGO_PATH);
            logoData = 'data:image/png;base64,' + buf.toString('base64');
        } catch (_) {}
    }

    // ── White background ──
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, 297, 'F');

    // ── Top double-gold rule ──
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1.2);
    doc.line(M, 10, W - M, 10);
    doc.setLineWidth(0.3);
    doc.line(M, 12.5, W - M, 12.5);

    // ── Logo (left) + brand text ──
    if (logoData) {
        doc.addImage(logoData, 'PNG', M, 16, 26, 17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 118, 55);
        doc.text('PREMIUM SALONS & TATTOOS', M + 29, 22);
        doc.text('kbbeauty.shop', M + 29, 28);
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(19);
        doc.setTextColor(180, 140, 40);
        doc.text('KB BEAUTY SALONS', M, 25);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 118, 55);
        doc.text('PREMIUM SALONS & TATTOOS  |  kbbeauty.shop', M, 31);
    }

    // ── "INVOICE" title (right) ──
    const invoiceNo = invoiceNoOverride || `KB-${parseDate(appointmentDate)?.getFullYear() || new Date().getFullYear()}-${appointmentId}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(212, 175, 55);
    doc.text('INVOICE', W - M, 24, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 85, 30);
    doc.text(`No:  ${invoiceNo}`, W - M, 31, { align: 'right' });
    doc.text(`Date: ${fmtDate(appointmentDate)}`, W - M, 37, { align: 'right' });

    // ── Divider below header ──
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.3);
    doc.line(M, 43, W - M, 43);
    doc.setLineWidth(1.0);
    doc.line(M, 45, W - M, 45);

    // ── Billed To (left) ──
    let y = 55;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 140, 50);
    doc.text('BILLED TO', M, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 22, 5);
    doc.text((customerName || 'Customer').toUpperCase(), M, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 68, 22);
    let infoY = y + 14;
    if (customerMobile) { doc.text('Mobile: ' + customerMobile, M, infoY); infoY += 6; }
    if (customerEmail)  { doc.text('Email: '  + customerEmail,  M, infoY); infoY += 6; }

    // ── Appointment box (right) ──
    const bx = 122, bw = 70, by = y - 4;
    doc.setFillColor(253, 249, 236);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.roundedRect(bx, by, bw, 30, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 140, 50);
    doc.text('APPOINTMENT DETAILS', bx + 5, by + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 38, 10);
    doc.text('Date: ' + fmtDate(appointmentDate), bx + 5, by + 16);
    doc.text('Time: ' + fmtTime(appointmentTime),  bx + 5, by + 23);

    // ── Thin line before table ──
    const sepY = Math.max(infoY + 5, by + 36);
    doc.setDrawColor(220, 200, 140);
    doc.setLineWidth(0.25);
    doc.line(M, sepY, W - M, sepY);

    // ── Services table (autoTable — identical to dashboard) ──
    const tableBody = services.map(s => [
        s.service_name,
        String(s.quantity || 1),
        'Rs. ' + parseFloat(s.price || 0).toLocaleString('en-IN'),
        'Rs. ' + (parseFloat(s.price || 0) * parseInt(s.quantity || 1)).toLocaleString('en-IN'),
    ]);

    doc.autoTable({
        startY: sepY + 5,
        head: [['Service', 'Qty', 'Unit Price', 'Amount']],
        body: tableBody,
        theme: 'plain',
        headStyles: {
            fillColor: [248, 241, 215],
            textColor: [100, 75, 15],
            fontSize: 8.5,
            fontStyle: 'bold',
            lineWidth: 0,
            cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [40, 30, 5],
            lineWidth: 0,
            cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        },
        alternateRowStyles: { fillColor: [252, 249, 242] },
        columnStyles: {
            0: { cellWidth: 86 },
            1: { halign: 'center', cellWidth: 18 },
            2: { halign: 'right',  cellWidth: 40 },
            3: { halign: 'right',  cellWidth: 30 },
        },
        margin: { left: M, right: M },
    });

    const fy = doc.lastAutoTable.finalY;

    // ── Line under table ──
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.25);
    doc.line(M, fy + 3, W - M, fy + 3);

    // ── Totals block ──
    const totalCostNum  = parseFloat(totalCost              || 0);
    const promoDiscE    = Math.max(0, parseFloat(discountAmount       || 0));
    const manualDiscE   = Math.max(0, parseFloat(manualDiscountAmount || 0));
    const discAmt       = promoDiscE + manualDiscE;
    const advPaidNum    = parseFloat(advancePaid || 0);
    const netADE        = totalCostNum - discAmt;
    const balance       = Math.max(0, netADE - advPaidNum);
    const tbRows        = (promoDiscE > 0 ? 1 : 0) + (manualDiscE > 0 ? 1 : 0) + (discAmt > 0 ? 1 : 0) + (balance > 0 ? 3 : 2);
    const tbH           = 8 + tbRows * 10;
    const tbX = W - M - 82, tbW = 82;

    doc.setFillColor(252, 248, 235);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.4);
    doc.roundedRect(tbX, fy + 8, tbW, tbH, 2.5, 2.5, 'FD');

    const lx = tbX + 6, rx = tbX + tbW - 5;
    let ty2 = fy + 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 78, 25);
    doc.text('Total Price', lx, ty2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(35, 25, 5);
    doc.text('Rs. ' + totalCostNum.toLocaleString('en-IN'), rx, ty2, { align: 'right' });

    if (promoDiscE > 0) {
        ty2 += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 78, 25);
        doc.text('Promo: ' + (discountCode || 'Code'), lx, ty2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(25, 130, 55);
        doc.text('-Rs. ' + promoDiscE.toLocaleString('en-IN'), rx, ty2, { align: 'right' });
    }
    if (manualDiscE > 0) {
        ty2 += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 78, 25);
        doc.text(manualDiscountType === 'percent' ? 'Special Discount (%)' : 'Special Discount (Fixed)', lx, ty2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(25, 130, 55);
        doc.text('-Rs. ' + manualDiscE.toLocaleString('en-IN'), rx, ty2, { align: 'right' });
    }
    if (discAmt > 0) {
        ty2 += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 78, 25);
        doc.text('After Discount', lx, ty2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(35, 25, 5);
        doc.text('Rs. ' + netADE.toLocaleString('en-IN'), rx, ty2, { align: 'right' });
    }

    ty2 += 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 78, 25);
    doc.text(balance === 0 ? 'Total Paid' : 'Advance Paid', lx, ty2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 130, 55);
    doc.text('Rs. ' + advPaidNum.toLocaleString('en-IN'), rx, ty2, { align: 'right' });

    if (balance > 0) {
        ty2 += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 78, 25);
        doc.text('Remaining Balance', lx, ty2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(195, 75, 20);
        doc.text('Rs. ' + balance.toLocaleString('en-IN'), rx, ty2, { align: 'right' });
    }

    // ── Status stamp ──
    const stampColors = { Completed:[20,140,60], Confirmed:[180,140,30], Pending:[195,120,20], Cancelled:[180,50,50] };
    const sc = stampColors[status] || [120, 100, 60];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...sc);
    const stampLabel = (status || 'CONFIRMED').toUpperCase();
    const stW = doc.getTextWidth(stampLabel) + 10;
    doc.setDrawColor(...sc);
    doc.setLineWidth(1.0);
    doc.roundedRect(M, fy + 10, stW, 14, 2, 2);
    doc.text(stampLabel, M + 5, fy + 20);

    // ── Bottom double-gold rule ──
    const pgH = doc.internal.pageSize.height;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1.0);
    doc.line(M, pgH - 22, W - M, pgH - 22);
    doc.setLineWidth(0.3);
    doc.line(M, pgH - 19.5, W - M, pgH - 19.5);

    // ── Footer ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 110, 50);
    doc.text('Thank you for choosing KB Beauty Salons & Tattoos. We look forward to seeing you again!', W / 2, pgH - 14, { align: 'center' });
    doc.setFontSize(7);
    doc.setTextColor(170, 140, 75);
    doc.text('kbbeauty.shop  \u2022  This is a computer-generated invoice', W / 2, pgH - 9, { align: 'center' });

    // Return Buffer (instead of doc.save() used in browser)
    return Promise.resolve(Buffer.from(doc.output('arraybuffer')));
}

// ─── Email Body Template ──────────────────────────────────────────────────────

function buildEmailBody(data, invoiceNoOverride) {
    const {
        appointmentId,
        customerName,
        appointmentDate,
        appointmentTime,
        services             = [],
        advancePaid          = 0,
        totalCost,
        discountAmount       = 0,
        discountCode         = null,
        manualDiscountAmount = 0,
        manualDiscountType   = null,
        status               = 'Confirmed',
        baseUrl              = 'https://kbbeauty.shop',
    } = data;

    const totalCostNum  = parseFloat(totalCost || services.reduce((s, r) => s + parseFloat(r.price||0) * (parseInt(r.quantity)||1), 0));
    const advPaidNum    = parseFloat(advancePaid || 0);
    const promoDiscB    = Math.max(0, parseFloat(discountAmount       || 0));
    const manualDiscB   = Math.max(0, parseFloat(manualDiscountAmount || 0));
    const discAmt       = promoDiscB + manualDiscB;
    const afterDisc     = Math.max(0, totalCostNum - discAmt);
    const balance       = Math.max(0, afterDisc - advPaidNum);
    const invoiceNo     = invoiceNoOverride || `KB-${parseDate(appointmentDate)?.getFullYear() || new Date().getFullYear()}-${appointmentId}`;
    const isCompleted   = status === 'Completed';

    // ── Service rows ──────────────────────────────────────────
    const servicesRows = services.map((s, i) => {
        const qty   = parseInt(s.quantity) || 1;
        const price = parseFloat(s.price || 0);
        const isOdd = i % 2 === 0;
        return `
        <tr style="background:${isOdd ? '#ffffff' : '#fdfaf3'};">
          <td style="padding:13px 18px;font-size:13.5px;color:#2a1e06;border-bottom:1px solid #f0e8d0;">
            ${s.service_name}${qty > 1 ? `<span style="font-size:11px;color:#8a6520;margin-left:6px;">&times;&thinsp;${qty}</span>` : ''}
          </td>
          <td style="padding:13px 18px;font-size:13.5px;color:#1a1000;font-weight:700;text-align:right;border-bottom:1px solid #f0e8d0;white-space:nowrap;">
            &#8377;&thinsp;${(price * qty).toLocaleString('en-IN')}
          </td>
        </tr>`;
    }).join('');

    // ── Discount rows inside payment summary ──────────────────
    const discountRows = (promoDiscB > 0 ? `
        <tr>
          <td style="padding:10px 18px 6px;font-size:12px;color:#7a6030;">
            <span style="display:inline-block;background:#f0faf4;border:1px solid #aadcba;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;color:#196637;margin-right:6px;">PROMO</span>
            ${discountCode}
          </td>
          <td style="padding:10px 18px 6px;font-size:13px;font-weight:700;color:#196637;text-align:right;white-space:nowrap;">
            &minus;&thinsp;&#8377;&thinsp;${inrStr(promoDiscB)}
          </td>
        </tr>` : '') +
        (manualDiscB > 0 ? `
        <tr>
          <td style="padding:6px 18px;font-size:12px;color:#7a6030;">Special Discount${manualDiscountType === 'percent' ? ' (%)' : ' (Fixed)'}</td>
          <td style="padding:6px 18px;font-size:13px;font-weight:700;color:#196637;text-align:right;white-space:nowrap;">
            &minus;&thinsp;&#8377;&thinsp;${inrStr(manualDiscB)}
          </td>
        </tr>` : '') +
        (discAmt > 0 ? `
        <tr>
          <td style="padding:6px 18px 12px;font-size:12px;color:#5a4010;font-weight:600;">After Discount</td>
          <td style="padding:6px 18px 12px;font-size:13px;font-weight:700;color:#1a1000;text-align:right;white-space:nowrap;">
            &#8377;&thinsp;${inrStr(afterDisc)}
          </td>
        </tr>` : '');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Invoice | KB Beauty Salons &amp; Tattoos</title>
</head>
<body style="margin:0;padding:0;background:#f0ece2;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ece2;padding:40px 16px 56px;">
<tr><td align="center">

  <table width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;
                box-shadow:0 10px 50px rgba(50,32,5,0.18);">

    <!-- ════════════════════════════════
         HEADER — Dark Luxury Gold
         ════════════════════════════════ -->
    <tr>
      <td style="background:linear-gradient(155deg,#080500 0%,#140e00 30%,#221800 60%,#2e2000 80%,#3a2a00 100%);
                 padding:38px 44px 32px;text-align:center;">
        <!-- Brand name -->
        <div style="font-size:26px;font-weight:900;letter-spacing:7px;color:#f5d97a;
                    font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;margin-bottom:5px;">
          KB BEAUTY
        </div>
        <div style="font-size:9px;color:#b89030;letter-spacing:4.5px;text-transform:uppercase;
                    margin-bottom:22px;">PREMIUM SALONS &amp; TATTOOS</div>
        <!-- Shimmer divider -->
        <div style="height:1px;margin:0 auto;width:180px;
                    background:linear-gradient(90deg,transparent,#6a4f10,#d4af37,#f5e17a,#d4af37,#6a4f10,transparent);">
        </div>
      </td>
    </tr>

    <!-- ════════════════════════════════
         HERO — Confirmation Banner
         ════════════════════════════════ -->
    <tr>
      <td style="background:linear-gradient(180deg,#fffef8 0%,#fffcef 100%);
                 padding:34px 44px 28px;text-align:center;border-bottom:2px solid #ecd87a;">
        <!-- Status circle -->
        <div style="display:inline-block;width:64px;height:64px;border-radius:50%;
                    background:linear-gradient(135deg,#1a8c3a 0%,#27ae60 100%);
                    text-align:center;line-height:64px;font-size:30px;color:#ffffff;
                    margin-bottom:20px;box-shadow:0 6px 24px rgba(26,140,58,0.3);">&#10003;</div>
        <div style="font-size:27px;font-weight:900;color:#0d0800;letter-spacing:0.5px;
                    margin-bottom:10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          ${isCompleted ? 'Payment Complete!' : 'Payment Received!'}
        </div>
        <div style="font-size:15px;color:#5a4010;line-height:1.85;max-width:400px;margin:0 auto;">
          Dear <strong style="color:#0d0800;">${customerName}</strong>,<br>
          ${isCompleted
            ? 'Your payment is complete and your appointment is all set. We can\'t wait to see you!'
            : 'We\'ve received your payment successfully. Your updated invoice is attached below.'
          }
        </div>
      </td>
    </tr>

    <!-- ════════════════════════════════
         APPOINTMENT CARD
         ════════════════════════════════ -->
    <tr>
      <td style="padding:28px 44px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(135deg,#fdf8e8,#fffcf2);
                      border:1px solid #ddc95a;border-radius:12px;overflow:hidden;">
          <!-- Invoice no row -->
          <tr>
            <td style="padding:16px 20px 14px;border-bottom:1px solid #ecd87a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:9px;font-weight:700;color:#b89030;letter-spacing:2.5px;
                                text-transform:uppercase;margin-bottom:5px;">Invoice Number</div>
                    <div style="font-size:20px;font-weight:900;color:#0d0800;">${invoiceNo}</div>
                  </td>
                  <td style="text-align:right;vertical-align:middle;">
                    <div style="display:inline-block;padding:6px 14px;border-radius:20px;
                                background:${isCompleted ? 'linear-gradient(135deg,#1a8c3a,#27ae60)' : 'linear-gradient(135deg,#b89030,#d4af37)'};
                                font-size:10px;font-weight:900;letter-spacing:1.5px;
                                color:#ffffff;text-transform:uppercase;">
                      ${status}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Date + Time row -->
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 20px;width:50%;border-right:1px solid #ecd87a;vertical-align:top;">
                    <div style="font-size:9px;font-weight:700;color:#b89030;letter-spacing:2px;
                                text-transform:uppercase;margin-bottom:6px;">Appointment Date</div>
                    <div style="font-size:14px;font-weight:700;color:#0d0800;line-height:1.4;">
                      ${fmtDateLong(appointmentDate)}
                    </div>
                  </td>
                  <td style="padding:16px 20px;width:50%;vertical-align:top;">
                    <div style="font-size:9px;font-weight:700;color:#b89030;letter-spacing:2px;
                                text-transform:uppercase;margin-bottom:6px;">Appointment Time</div>
                    <div style="font-size:14px;font-weight:700;color:#0d0800;">${fmtTime(appointmentTime)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ════════════════════════════════
         SERVICES TABLE
         ════════════════════════════════ -->
    <tr>
      <td style="padding:24px 44px 0;">
        <div style="font-size:9px;font-weight:700;color:#b89030;letter-spacing:2.5px;
                    text-transform:uppercase;margin-bottom:12px;">Services Booked</div>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e8d48a;border-radius:10px;overflow:hidden;">
          <tr style="background:#fdf6e3;">
            <td style="padding:11px 18px;font-size:9.5px;font-weight:700;color:#8a6520;
                       letter-spacing:1.5px;text-transform:uppercase;">SERVICE</td>
            <td style="padding:11px 18px;font-size:9.5px;font-weight:700;color:#8a6520;
                       letter-spacing:1.5px;text-transform:uppercase;text-align:right;">AMOUNT</td>
          </tr>
          ${servicesRows}
        </table>
      </td>
    </tr>

    <!-- ════════════════════════════════
         PAYMENT SUMMARY
         ════════════════════════════════ -->
    <tr>
      <td style="padding:16px 44px 0;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e8d48a;border-radius:10px;overflow:hidden;">
          <!-- Section label -->
          <tr style="background:#fdf6e3;">
            <td colspan="2" style="padding:12px 18px;font-size:9.5px;font-weight:700;color:#8a6520;
                                   letter-spacing:1.5px;text-transform:uppercase;border-bottom:1px solid #e8d48a;">
              Payment Summary
            </td>
          </tr>
          <!-- Subtotal -->
          <tr>
            <td style="padding:13px 18px 10px;font-size:13px;color:#5a4010;border-bottom:1px solid #f5edd8;">
              Subtotal
            </td>
            <td style="padding:13px 18px 10px;font-size:14px;font-weight:700;color:#0d0800;
                       text-align:right;border-bottom:1px solid #f5edd8;white-space:nowrap;">
              &#8377;&thinsp;${inrStr(totalCostNum)}
            </td>
          </tr>
          ${discountRows}
          <!-- Paid row -->
          <tr style="background:${isCompleted ? 'linear-gradient(135deg,#f0faf4,#eaf7f0)' : '#fdfbf5'};">
            <td style="padding:13px 18px;font-size:13px;font-weight:700;
                       color:${isCompleted ? '#196637' : '#5a4010'};">
              ${balance === 0 ? 'Total Paid ✓' : 'Advance Paid'}
            </td>
            <td style="padding:13px 18px;font-size:16px;font-weight:900;color:#196637;
                       text-align:right;white-space:nowrap;">
              &#8377;&thinsp;${inrStr(advPaidNum)}
            </td>
          </tr>
          ${balance > 0 ? `
          <tr style="background:#fff8f3;">
            <td style="padding:13px 18px;font-size:13px;font-weight:700;color:#8a3010;
                       border-top:1px solid #f5ddd0;">Balance Due</td>
            <td style="padding:13px 18px;font-size:16px;font-weight:900;color:#c34b14;
                       text-align:right;border-top:1px solid #f5ddd0;white-space:nowrap;">
              &#8377;&thinsp;${inrStr(balance)}
            </td>
          </tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- ════════════════════════════════
         THANK YOU MESSAGE
         ════════════════════════════════ -->
    <tr>
      <td style="padding:32px 44px 24px;">
        <!-- Section divider -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af37,#f5e17a,#d4af37,transparent);
                    margin-bottom:30px;"></div>

        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(160deg,#0d0800 0%,#180f00 40%,#261a00 75%,#332300 100%);
                      border-radius:14px;overflow:hidden;">
          <tr>
            <td style="padding:34px 36px 30px;text-align:center;">
              <!-- Top shimmer line -->
              <div style="height:2px;background:linear-gradient(90deg,transparent,#6a4f10,#d4af37,#f5e17a,#d4af37,#6a4f10,transparent);
                          margin-bottom:26px;border-radius:2px;"></div>

              <!-- Heading -->
              <div style="font-size:21px;font-weight:900;color:#f5d97a;letter-spacing:1.5px;
                          margin-bottom:16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                Thank You for Trusting KB Beauty
              </div>

              <!-- Body copy -->
              <div style="font-size:14px;color:#c9a55a;line-height:1.95;margin-bottom:18px;
                          max-width:420px;margin-left:auto;margin-right:auto;">
                We are truly honoured to have you as our guest.
                At <strong style="color:#f5d97a;">KB Beauty Salons &amp; Tattoos</strong>, we believe that great
                styling is more than a service — it's a craft we practise with care, skill, and passion every
                single day.
              </div>

              <div style="font-size:13px;color:#e8c95a;line-height:1.85;margin-bottom:22px;font-style:italic;
                          max-width:380px;margin-left:auto;margin-right:auto;">
                "Your confidence is our canvas — and we give it everything we've got."
              </div>

              <!-- Bottom shimmer -->
              <div style="height:1px;background:linear-gradient(90deg,transparent,#6a4f10,#b89030,#6a4f10,transparent);
                          margin-bottom:26px;"></div>

              <!-- Visit again message -->
              <div style="font-size:13px;color:#c9a84c;margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">
                We'd love to see you again — soon!
              </div>
              <div style="font-size:12px;color:#c9a55a;margin-bottom:22px;line-height:1.7;">
                Whether it's a fresh cut, a new style, or something bold — we're always ready for you.
              </div>

              <!-- Book Again CTA -->
              <a href="${baseUrl}/"
                 style="display:inline-block;padding:15px 44px;
                        background:linear-gradient(135deg,#9a7420,#d4af37,#f5e17a,#d4af37,#9a7420);
                        background-size:200% auto;color:#0d0800;font-size:11px;font-weight:900;
                        letter-spacing:2.5px;text-transform:uppercase;text-decoration:none;
                        border-radius:8px;box-shadow:0 6px 24px rgba(184,144,48,0.45);">
                &#x2728;&ensp;Book Your Next Visit
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ════════════════════════════════
         DASHBOARD CTA
         ════════════════════════════════ -->
    <tr>
      <td style="padding:0 44px 28px;text-align:center;">
        <div style="font-size:12px;color:#8a7040;margin-bottom:14px;line-height:1.6;">
          View your bookings, download invoices, and track your appointment status anytime.
        </div>
        <a href="${baseUrl}/dashboard.html"
           style="display:inline-block;padding:13px 36px;
                  border:2px solid #c9a84c;border-radius:8px;
                  color:#8a6520;font-size:11px;font-weight:700;letter-spacing:2px;
                  text-transform:uppercase;text-decoration:none;">
          My Dashboard &nbsp;&rarr;
        </a>
      </td>
    </tr>

    <!-- ════════════════════════════════
         FOOTER
         ════════════════════════════════ -->
    <tr>
      <td style="background:linear-gradient(160deg,#080500,#140e00,#221800,#2e2000);
                 padding:26px 44px 28px;text-align:center;border-radius:0 0 18px 18px;">
        <!-- Top shimmer line -->
        <div style="height:1px;background:linear-gradient(90deg,transparent,#6a4f10,#d4af37,#6a4f10,transparent);
                    margin-bottom:18px;"></div>

        <div style="font-size:12px;font-weight:700;color:#c9a84c;letter-spacing:3px;
                    text-transform:uppercase;margin-bottom:8px;">
          KB Beauty Salons &amp; Tattoos
        </div>
        <div style="font-size:11px;color:#b89030;line-height:1.8;margin-bottom:14px;">
          3RD FLOOR, VKB RESIDENCY, Kurnool Rd, Ongole, AP 523001<br>
          +91 96404 01112 &nbsp;&bull;&nbsp; kbbeauty.shop
        </div>

        <div style="height:1px;background:rgba(212,175,55,0.15);margin:0 auto 14px;width:100px;"></div>

        <div style="font-size:9.5px;color:#9a7840;line-height:1.8;">
          Invoice attached as PDF &nbsp;&bull;&nbsp; This is an automated email, please do not reply<br>
          &copy; ${new Date().getFullYear()} KB Beauty Salons &amp; Tattoos. All rights reserved.
        </div>
      </td>
    </tr>

  </table>

</td></tr>
</table>

</body>
</html>`;
}

// ─── Send Invoice Email ────────────────────────────────────────────────────────

async function sendInvoiceEmail(toEmail, data) {
    if (!toEmail || !toEmail.includes('@')) {
        console.log('[Email] No valid email — skipping.');
        return;
    }

    const invoiceNo = `KB-${parseDate(data.appointmentDate)?.getFullYear() || new Date().getFullYear()}-${data.appointmentId}`;

    const [pdfBuffer, htmlBody] = await Promise.all([
        buildInvoicePdf(data, invoiceNo),
        Promise.resolve(buildEmailBody(data, invoiceNo)),
    ]);

    const isCompleted = data.status === 'Completed';
    const subjectLine = isCompleted
        ? `Payment Complete — Invoice ${invoiceNo} | KB Beauty Salons & Tattoos`
        : `Payment Received — Invoice ${invoiceNo} | KB Beauty Salons & Tattoos`;

    await transporter.sendMail({
        from:    `"KB Beauty Salons & Tattoos" <${process.env.SMTP_USER || 'venu.vallepu.engineer@gmail.com'}>`,
        to:      toEmail,
        subject: subjectLine,
        html:    htmlBody,
        text: [
            `Booking Confirmed — KB Beauty Salons & Tattoos`,
            `Invoice ${invoiceNo}`,
            `Hi ${data.customerName}, your appointment is confirmed.`,
            `Date: ${data.appointmentDate}  Time: ${data.appointmentTime}`,
            `Invoice attached.`,
            `Dashboard: ${(data.baseUrl || 'https://kbbeauty.shop')}/dashboard.html`,
        ].join('\n'),
        attachments: [{
            filename:    `KB_Invoice_${invoiceNo}.pdf`,
            content:     pdfBuffer,
            contentType: 'application/pdf',
        }],
    });

    console.log(`[Email] Invoice ${invoiceNo} sent to ${toEmail} with PDF`);
}

// ─── Slot Confirmation Email ───────────────────────────────────────────────────

function buildConfirmationBody(data) {
    const {
        customerName,
        appointmentDate,
        appointmentTime,
        services = [],
        baseUrl = 'https://kbbeauty.shop',
    } = data;

    const servicesHtml = services.map(s => `
        <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(212,175,55,0.1);color:#e8d5a0;font-size:0.9rem;">
          <strong style="color:#fcf6ba;">${s.service_name}</strong>
          ${s.quantity > 1 ? `<span style="color:#9a7840;margin-left:8px;">&times; ${s.quantity}</span>` : ''}
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Appointment Confirmed | KB Beauty Salons</title>
</head>
<body style="margin:0;padding:0;background:#050300;font-family:'Segoe UI',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#050300;padding:40px 16px;">
<tr><td align="center">

  <div style="max-width:500px;margin:auto;background:#0e0a02;border:1px solid rgba(212,175,55,0.3);border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
    
    <!-- Header: Gold Gradient -->
    <div style="background:linear-gradient(135deg,#2a1f00,#7a5c10,#d4af37);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#1a1000;font-size:1.6rem;letter-spacing:4px;font-weight:900;text-transform:uppercase;">KB BEAUTY</h1>
      <p style="margin:6px 0 0;color:#3a2800;font-size:0.75rem;letter-spacing:2px;font-weight:700;text-transform:uppercase;">Premium Salons &amp; Tattoos</p>
    </div>

    <!-- Body Content -->
    <div style="padding:40px 32px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="display:inline-block;width:60px;height:60px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.4);border-radius:50%;text-align:center;line-height:60px;font-size:28px;color:#fcf6ba;margin-bottom:16px;">✓</div>
        <h2 style="color:#fcf6ba;font-size:1.5rem;margin:0;letter-spacing:0.5px;">Slot Confirmed!</h2>
        <p style="color:#9a7840;font-size:0.95rem;margin:8px 0 0;">Your appointment has been approved by the admin.</p>
      </div>

      <p style="color:#e8d5a0;font-size:1rem;margin:0 0 24px;">Hi <strong>${customerName}</strong>,</p>
      
      <!-- Appointment Details Card -->
      <div style="background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:24px;margin-bottom:32px;">
        <div style="margin-bottom:16px;">
          <span style="color:#9a7840;font-size:0.75rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Date &amp; Time</span>
          <div style="color:#fcf6ba;font-size:1.1rem;font-weight:700;margin-top:4px;">
            ${fmtDateLong(appointmentDate)}<br>
            @ ${fmtTime(appointmentTime)}
          </div>
        </div>
        <div>
          <span style="color:#9a7840;font-size:0.75rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Services Booked</span>
          <div style="margin-top:12px;">
            ${servicesHtml}
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:32px;">
        <a href="${baseUrl}/dashboard.html" 
           style="display:inline-block;background:linear-gradient(135deg,#9a7420,#d4af37);color:#1a1000;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:900;font-size:0.85rem;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 10px 20px rgba(212,175,55,0.2);">
          Manage Appointment
        </a>
      </div>

      <p style="color:#6a5030;font-size:0.85rem;line-height:1.6;margin:0;text-align:center;">
        Looking forward to providing you with an exceptional experience. Please arrive 5 minutes early.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:24px 32px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(212,175,55,0.15);text-align:center;">
      <p style="color:#6a5030;font-size:0.7rem;margin:0;letter-spacing:0.5px;">© KB Beauty Salons &amp; Tattoos · Ongole, AP</p>
      <p style="color:#4a3820;font-size:0.65rem;margin:6px 0 0;">kbbeauty.shop · +91 96404 01112</p>
    </div>

  </div>

</td></tr>
</table>

</body>
</html>`;
}

async function sendSlotConfirmationEmail(toEmail, data) {
    if (!toEmail || !toEmail.includes('@')) return;

    const htmlBody = buildConfirmationBody(data);

    await transporter.sendMail({
        from:    `"KB Beauty Salons & Tattoos" <${process.env.SMTP_USER || 'venu.vallepu.engineer@gmail.com'}>`,
        to:      toEmail,
        subject: `Appointment Confirmed! — KB Beauty Salons`,
        html:    htmlBody,
        text: [
            `Appointment Confirmed — KB Beauty Salons & Tattoos`,
            `Hi ${data.customerName}, your appointment has been confirmed for ${data.appointmentDate} at ${data.appointmentTime}.`,
            `Manage your booking: ${(data.baseUrl || 'https://kbbeauty.shop')}/dashboard.html`,
        ].join('\n'),
    });

    console.log(`[Email] Slot Confirmation sent to ${toEmail}`);
}

module.exports = { sendInvoiceEmail, sendSlotConfirmationEmail, buildInvoicePdf };

