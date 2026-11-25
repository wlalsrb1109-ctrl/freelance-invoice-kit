/*!
 * invoice.js — the invoice generator UI.
 * All state lives in this browser; nothing is sent anywhere.
 */
(function () {
  'use strict';

  var C = window.IRKCalc;
  var CFG = window.WEBTOOL_CONFIG || {};
  var KEY = 'irk.invoice.v2';
  var CKEY = 'irk.counters.v2';

  var DOC_LABEL = {
    invoice: 'INVOICE',
    quote: 'QUOTE',
    proforma: 'PRO FORMA',
    receipt: 'RECEIPT',
    credit: 'CREDIT NOTE'
  };
  var DOC_PREFIX = { invoice: 'INV', quote: 'QT', proforma: 'PRO', receipt: 'RCPT', credit: 'CN' };
  var TOTAL_LABEL = {
    invoice: 'Total due',
    quote: 'Estimated total',
    proforma: 'Total due',
    receipt: 'Total paid',
    credit: 'Total credited'
  };

  var $ = function (id) { return document.getElementById(id); };
  var state = null;
  var saveTimer = null;

  /* ---------------- helpers ---------------- */
  function todayISO(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function prettyDate(iso) {
    if (!iso) return '—';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return iso;
    try {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function money(amount) {
    return C.formatMoney(amount, state.currency);
  }

  function qtyText(q) {
    var n = C.num(q);
    if (!n) return '0';
    return Number.isInteger(n) ? String(n) : String(C.round(n, 2));
  }

  function nextNumber(docType) {
    var counters = {};
    try { counters = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { counters = {}; }
    var prefix = DOC_PREFIX[docType] || 'INV';
    var year = String(new Date().getFullYear());
    var k = prefix + '-' + year;
    var n = (Number(counters[k]) || 0) + 1;
    counters[k] = n;
    try { localStorage.setItem(CKEY, JSON.stringify(counters)); } catch (e) { /* private mode */ }
    return k + '-' + String(n).padStart(3, '0');
  }

  function defaultState() {
    return {
      docType: 'invoice',
      logo: '',
      template: 'studio',
      paper: 'a4',
      biz: { name: '', email: '', address: '', taxId: '' },
      client: { name: '', email: '', address: '', taxId: '' },
      meta: { number: nextNumber('invoice'), issue: todayISO(0), due: todayISO(14) },
      currency: CFG.defaultCurrency || 'USD',
      items: [{ desc: '', qty: 1, price: '' }],
      discountType: 'none',
      discountValue: 0,
      taxLabel: CFG.defaultTaxLabel || 'VAT',
      taxRate: CFG.defaultTaxRate || 0,
      reverseCharge: false,
      paid: 0,
      payment: '',
      notes: '',
      termsText: ''
    };
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      var base = defaultState();
      // shallow-merge to survive schema tweaks
      var merged = Object.assign({}, base, s);
      merged.biz = Object.assign({}, base.biz, s.biz || {});
      merged.client = Object.assign({}, base.client, s.client || {});
      merged.meta = Object.assign({}, base.meta, s.meta || {});
      if (!Array.isArray(merged.items) || !merged.items.length) merged.items = base.items;
      if (merged.meta.number) counters_seed(merged.meta.number);
      return merged;
    } catch (e) {
      return null;
    }
  }

  /* keep the auto-number from re-using a number already in a restored draft */
  function counters_seed(number) {
    var m = /^(.*)-(\d{3,})$/.exec(String(number));
    if (!m) return;
    var counters = {};
    try { counters = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch (e) { counters = {}; }
    var key = m[1];
    var n = Number(m[2]) || 0;
    if (!counters[key] || counters[key] < n) {
      counters[key] = n;
      try { localStorage.setItem(CKEY, JSON.stringify(counters)); } catch (e) { /* ignore */ }
    }
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] = cur[parts[i]] || {};
    cur[parts[parts.length - 1]] = value;
  }

  function getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return '';
      cur = cur[parts[i]];
    }
    return cur == null ? '' : cur;
  }

  /* ---------------- persistence ---------------- */
  function setSaveState(text) {
    var el = $('saveState');
    if (el) el.textContent = text;
  }

  function save(immediate) {
    setSaveState('Saving…');
    clearTimeout(saveTimer);
    var run = function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        var t = new Date();
        setSaveState('Saved ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'));
      } catch (e) {
        setSaveState('Not saved (storage full)');
      }
    };
    if (immediate) run();
    else saveTimer = setTimeout(run, 450);
  }

  /* ---------------- form binding ---------------- */
  function hydrateForm() {
    var els = document.querySelectorAll('[data-field]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var path = el.getAttribute('data-field');
      var val = getPath(state, path);
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val == null ? '' : val;
    }
    var term = $('termPreset');
    if (term) {
      var d1 = state.meta.issue, d2 = state.meta.due;
      var diff = null;
      if (d1 && d2) diff = Math.round((new Date(d2) - new Date(d1)) / 86400000);
      var opts = Array.prototype.slice.call(term.options);
      var match = null;
      for (var j = 0; j < opts.length; j++) if (Number(opts[j].value) === diff) match = opts[j];
      term.value = match ? match.value : 'custom';
    }
    document.querySelectorAll('[data-template]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-template') === state.template);
    });
    document.querySelectorAll('[data-paper]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-paper') === state.paper);
    });
  }

  function bindForm() {
    document.querySelectorAll('[data-field]').forEach(function (el) {
      var path = el.getAttribute('data-field');
      var handler = function () {
        var v = el.type === 'checkbox' ? el.checked : el.value;
        setPath(state, path, v);
        if (path === 'meta.number' && v) counters_seed(v);
        if (path === 'docType') {
          // keep the number prefix in step with the document type
          var m = /^([A-Z]+)-/.exec(state.meta.number || '');
          var want = DOC_PREFIX[v];
          if (m && want && m[1] !== want) {
            state.meta.number = (state.meta.number || '').replace(/^[A-Z]+-/, want + '-');
            $('invNumber').value = state.meta.number;
          }
        }
        render();
        save();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    $('termPreset').addEventListener('change', function () {
      var v = this.value;
      if (v === 'custom') return;
      state.meta.due = todayISO(Number(v));
      $('dueDate').value = state.meta.due;
      render();
      save();
    });

    document.querySelectorAll('[data-template]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.template = b.getAttribute('data-template');
        document.querySelectorAll('[data-template]').forEach(function (o) { o.classList.toggle('is-active', o === b); });
        render();
        save();
      });
    });

    document.querySelectorAll('[data-paper]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.paper = b.getAttribute('data-paper');
        document.querySelectorAll('[data-paper]').forEach(function (o) { o.classList.toggle('is-active', o === b); });
        applyPaper();
        render();
        save();
      });
    });

    $('printBtn').addEventListener('click', function () {
      window.print();
    });

    $('addItem').addEventListener('click', function () {
      state.items.push({ desc: '', qty: 1, price: '' });
      renderItems();
      render();
      save();
      var rows = document.querySelectorAll('#itemRows .item-row');
      var last = rows[rows.length - 1];
      if (last) last.querySelector('.i-desc').focus();
    });

    $('resetBtn').addEventListener('click', function () {
      if (!window.confirm('Clear every field on this invoice? Your browser draft will be replaced.')) return;
      state = defaultState();
      hydrateForm();
      renderItems();
      render();
      applyPaper();
      save(true);
      if (window.IRK && window.IRK.toast) window.IRK.toast('Fields cleared');
    });

    $('newBtn').addEventListener('click', function () {
      var keepBiz = state.biz, keepClient = state.client;
      var next = defaultState();
      next.biz = keepBiz;
      next.client = keepClient;
      next.template = state.template;
      next.paper = state.paper;
      next.currency = state.currency;
      next.taxLabel = state.taxLabel;
      next.taxRate = state.taxRate;
      next.payment = state.payment;
      next.termsText = state.termsText;
      next.logo = state.logo;
      state = next;
      hydrateForm();
      renderItems();
      render();
      save(true);
      if (window.IRK && window.IRK.toast) window.IRK.toast('New invoice ' + state.meta.number);
    });

    /* logo */
    $('logoBtn').addEventListener('click', function () { $('logoInput').click(); });
    $('logoInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        if (window.IRK) window.IRK.toast('Please choose an image file');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        shrinkImage(String(reader.result), function (dataUrl) {
          state.logo = dataUrl;
          renderLogo();
          render();
          save(true);
        });
      };
      reader.onerror = function () { if (window.IRK) window.IRK.toast('Could not read that file'); };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
    $('logoClear').addEventListener('click', function () {
      state.logo = '';
      renderLogo();
      render();
      save(true);
    });
  }

  /* Downscale a logo so it stays sharp in print but small in localStorage. */
  function shrinkImage(dataUrl, done) {
    var img = new Image();
    img.onload = function () {
      var max = 400;
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (!w || !h) { done(dataUrl); return; }
      var scale = Math.min(1, max / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      try {
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        done(canvas.toDataURL('image/png'));
      } catch (e) {
        done(dataUrl);
      }
    };
    img.onerror = function () { done(dataUrl); };
    img.src = dataUrl;
  }

  function renderLogo() {
    var box = $('logoPreview');
    if (!box) return;
    box.innerHTML = '';
    if (state.logo) {
      var im = document.createElement('img');
      im.src = state.logo;
      im.alt = '';
      box.appendChild(im);
      $('logoClear').hidden = false;
    } else {
      var s = document.createElement('span');
      s.textContent = 'Logo';
      box.appendChild(s);
      $('logoClear').hidden = true;
    }
  }

  /* ---------------- line items ---------------- */
  function renderItems() {
    var host = $('itemRows');
    if (!host) return;
    host.innerHTML = '';
    state.items.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'item-row';
      row.setAttribute('data-idx', String(idx));

      var desc = document.createElement('input');
      desc.className = 'input i-desc';
      desc.type = 'text';
      desc.placeholder = idx === 0 ? 'Website redesign — 3 concepts, 2 revision rounds' : 'Another service or product';
      desc.value = item.desc || '';
      desc.setAttribute('aria-label', 'Line ' + (idx + 1) + ' description');
      desc.addEventListener('input', function () { state.items[idx].desc = desc.value; render(); save(); });

      var qty = document.createElement('input');
      qty.className = 'input input-num i-qty';
      qty.type = 'number';
      qty.min = '0';
      qty.step = 'any';
      qty.value = item.qty === '' || item.qty == null ? '' : item.qty;
      qty.setAttribute('aria-label', 'Line ' + (idx + 1) + ' quantity');
      qty.addEventListener('input', function () { state.items[idx].qty = qty.value; render(); save(); });

      var price = document.createElement('input');
      price.className = 'input input-num i-price';
      price.type = 'number';
      price.min = '0';
      price.step = '0.01';
      price.placeholder = '0.00';
      price.value = item.price === '' || item.price == null ? '' : item.price;
      price.setAttribute('aria-label', 'Line ' + (idx + 1) + ' rate');
      price.addEventListener('input', function () { state.items[idx].price = price.value; render(); save(); });

      var amount = document.createElement('div');
      amount.className = 'amount i-amount';
      amount.setAttribute('data-amount', String(idx));
      amount.textContent = money(C.round(C.num(item.qty) * C.num(item.price), 2));

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'icon-btn i-del';
      del.setAttribute('aria-label', 'Remove line ' + (idx + 1));
      del.innerHTML = '&times;';
      del.addEventListener('click', function () {
        state.items.splice(idx, 1);
        if (!state.items.length) state.items.push({ desc: '', qty: 1, price: '' });
        renderItems();
        render();
        save();
      });

      row.appendChild(desc);
      row.appendChild(qty);
      row.appendChild(price);
      row.appendChild(amount);
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  /* ---------------- preview ---------------- */
  function setText(el, value, placeholder) {
    if (!el) return;
    var v = (value == null ? '' : String(value)).trim();
    el.textContent = v || (placeholder || '');
    el.classList.toggle('is-empty', !v);
  }

  function renderPreview() {
    var sheet = $('sheet');
    if (!sheet) return;

    var d = state;
    var totals = C.computeInvoiceTotals(d.items.map(function (it) {
      return { quantity: it.qty, unitPrice: it.price };
    }), {
      discountType: d.discountType,
      discountValue: d.discountValue,
      taxRate: d.reverseCharge ? 0 : d.taxRate,
      taxInclusive: false
    });

    // document chrome
    setText($('pvDocType'), DOC_LABEL[d.docType] || 'INVOICE');
    setText($('pvNumber'), d.meta.number, 'INV-0001');
    setText($('pvIssued'), prettyDate(d.meta.issue));
    setText($('pvDue'), prettyDate(d.meta.due));

    // parties
    setText($('pvBizName'), d.biz.name, 'Your business name');
    var bizLines = [d.biz.address, d.biz.email].filter(Boolean).join('\n');
    setText($('pvBizLines'), bizLines, 'Your address and email');
    setText($('pvClientName'), d.client.name, 'Client name');
    var clientLines = [d.client.address, d.client.email].filter(Boolean).join('\n');
    setText($('pvClientLines'), clientLines, 'Client address and email');
    setText($('pvFromName'), d.biz.name, 'Your business');
    setText($('pvFromLines'), bizLines, '');

    // logo / monogram
    var logoEl = $('pvLogo');
    logoEl.innerHTML = '';
    if (d.logo) {
      var im = document.createElement('img');
      im.src = d.logo;
      im.alt = '';
      logoEl.classList.add('has-img');
      logoEl.appendChild(im);
    } else {
      logoEl.classList.remove('has-img');
      var initials = (d.biz.name || 'IK').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
      logoEl.textContent = initials || 'IK';
    }

    // items
    var tbody = $('pvItems');
    tbody.innerHTML = '';
    d.items.forEach(function (item, i) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      td1.className = 'desc';
      td1.textContent = (item.desc || '').trim() || (i === 0 ? 'Describe the work you delivered' : '');
      var td2 = document.createElement('td');
      td2.className = 'num';
      td2.textContent = qtyText(item.qty);
      var td3 = document.createElement('td');
      td3.className = 'num';
      td3.textContent = money(C.num(item.price));
      var td4 = document.createElement('td');
      td4.className = 'num';
      td4.textContent = money(totals.lineAmounts[i]);
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3); tr.appendChild(td4);
      tbody.appendChild(tr);
    });

    // totals
    setText($('pvSubtotal'), money(totals.subtotal));
    var discRow = $('pvDiscountRow');
    if (totals.discount > 0) {
      discRow.hidden = false;
      $('pvDiscountLabel').textContent = d.discountType === 'percent'
        ? 'Discount (' + C.num(d.discountValue) + '%)'
        : 'Discount';
      setText($('pvDiscount'), '−' + money(totals.discount));
    } else {
      discRow.hidden = true;
    }

    var taxRow = $('pvTaxRow');
    var label = d.taxLabel === 'None' ? '' : (d.taxLabel || 'Tax');
    if (d.reverseCharge) {
      taxRow.hidden = false;
      $('pvTaxLabel').textContent = label ? label + ' 0% — reverse charge' : 'Reverse charge';
      setText($('pvTax'), money(0));
    } else if (label && C.num(d.taxRate) > 0) {
      taxRow.hidden = false;
      $('pvTaxLabel').textContent = label + ' ' + C.num(d.taxRate) + '%';
      setText($('pvTax'), money(totals.tax));
    } else {
      taxRow.hidden = false;
      $('pvTaxLabel').textContent = label ? label + ' 0%' : 'Tax';
      setText($('pvTax'), money(0));
    }

    $('pvTotalLabel').textContent = TOTAL_LABEL[d.docType] || 'Total due';
    setText($('pvTotal'), money(totals.total));

    var paid = Math.max(0, C.num(d.paid));
    var balance = C.round(totals.total - paid, 2);
    $('pvPaidRow').hidden = !(paid > 0);
    $('pvDueRow').hidden = !(paid > 0);
    if (paid > 0) {
      setText($('pvPaid'), '−' + money(paid));
      setText($('pvDueAmount'), money(balance));
    }

    // notes
    var payWrap = $('pvPaymentWrap');
    var hasPay = !!(d.payment || '').trim();
    payWrap.hidden = !hasPay;
    setText($('pvPayment'), d.payment, '');
    var notesWrap = $('pvNotesWrap');
    var hasNotes = !!(d.notes || '').trim();
    notesWrap.hidden = !hasNotes;
    setText($('pvNotes'), d.notes, '');

    // footer: terms + reverse charge + tax ids
    var terms = (d.termsText || '').trim();
    if (d.reverseCharge) {
      var rc = 'Reverse charge: ' + (label || 'VAT') + ' not charged — customer accounts for the tax.';
      terms = terms ? terms + ' ' + rc : rc;
    }
    setText($('pvTerms'), terms, '');
    var ids = [];
    if ((d.biz.taxId || '').trim()) ids.push('VAT/Tax ID: ' + d.biz.taxId.trim());
    if ((d.client.taxId || '').trim()) ids.push('Client VAT/Tax ID: ' + d.client.taxId.trim());
    setText($('pvTaxIds'), ids.join('  ·  '), '');

    // template + paper chrome
    sheet.className = 'sheet tpl-' + (d.template || 'studio') + ' paper-' + (d.paper || 'a4');
  }

  function applyPaper() {
    var rule = $('pageRule');
    if (rule) rule.textContent = state.paper === 'letter'
      ? '@media print{@page{size:letter;margin:12mm}}'
      : '@media print{@page{size:A4;margin:12mm}}';
    var sheet = $('sheet');
    if (sheet) {
      sheet.style.width = state.paper === 'letter' ? '816px' : '794px';
      sheet.style.minHeight = state.paper === 'letter' ? '1056px' : '1040px';
    }
  }

  /* ---------------- scale the A4 sheet to its column ---------------- */
  function fitPreview() {
    var scaler = $('sheetScaler');
    var sheet = $('sheet');
    if (!scaler || !sheet) return;
    var baseW = state.paper === 'letter' ? 816 : 794;
    var avail = scaler.clientWidth;
    if (!avail) return;
    var scale = Math.min(1, avail / baseW);
    sheet.style.transform = 'scale(' + scale + ')';
    scaler.style.height = Math.ceil(sheet.offsetHeight * scale) + 'px';
  }

  var fitTimer = null;
  function queueFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitPreview, 60);
  }

  function render() {
    renderPreview();
    queueFit();
  }

  /* ---------------- boot ---------------- */
  function init() {
    if (!$('invoiceForm')) return;
    state = load() || defaultState();
    hydrateForm();
    renderItems();
    renderLogo();
    applyPaper();
    bindForm();
    render();
    renderLogo();
    setSaveState('');
    window.addEventListener('resize', queueFit);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(queueFit).catch(function () {});
    }
    window.addEventListener('beforeprint', fitPreview);
    window.addEventListener('afterprint', queueFit);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // exposed for the automated test harness
  window.IRKInvoice = { getState: function () { return state; }, setState: function (s) { state = s; } };
})();
