/*!
 * rate.js — freelance rate & tax calculator UI.
 */
(function () {
  'use strict';

  var C = window.IRKCalc;
  var KEY = 'irk.rate.v1';
  var $ = function (id) { return document.getElementById(id); };
  var projTouched = false;
  var currency = 'USD';

  function num(id) {
    var el = $(id);
    return el ? C.num(el.value) : 0;
  }

  function money(n) { return C.formatMoney(n, currency); }

  var state = {
    netIncome: 60000,
    expenses: 6000,
    taxRate: 25,
    bufferPct: 10,
    daysPerWeek: 5,
    hoursPerDay: 5,
    weeksPerYear: 46
  };

  function readInputs() {
    state.netIncome = num('netIncome');
    state.expenses = num('expenses');
    state.taxRate = num('taxRate');
    state.bufferPct = num('bufferPct');
    state.daysPerWeek = num('daysPerWeek');
    state.hoursPerDay = num('hoursPerDay');
    state.weeksPerYear = num('weeksPerYear');
  }

  function applyState() {
    $('netIncome').value = state.netIncome;
    $('expenses').value = state.expenses;
    $('taxRate').value = state.taxRate;
    $('bufferPct').value = state.bufferPct;
    $('daysPerWeek').value = state.daysPerWeek;
    $('hoursPerDay').value = state.hoursPerDay;
    $('weeksPerYear').value = state.weeksPerYear;
  }

  function pct(part, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, (part / total) * 100));
  }

  function render() {
    readInputs();
    var r = C.computeRequiredRate(state);

    $('outHourly').textContent = r.hourlyRate > 0 ? money(r.hourlyRate) : '—';
    $('outSub').textContent = r.hoursPerYear > 0
      ? 'to bill ' + money(r.grossRevenue) + ' across ' + C.formatNumber(r.hoursPerYear, 0) + ' billable hours'
      : 'Enter your billable hours to see a rate.';

    $('outDay').textContent = r.dayRate > 0 ? money(r.dayRate) : '—';
    $('outDayNote').textContent = state.hoursPerDay ? 'for ' + state.hoursPerDay + ' billable h' : 'per billable day';
    $('outWeek').textContent = r.weekRate > 0 ? money(r.weekRate) : '—';
    $('outMonth').textContent = r.monthlyRetainer > 0 ? money(r.monthlyRetainer) : '—';
    $('outHours').textContent = C.formatNumber(r.hoursPerYear, 0);

    $('hoursNote').textContent = C.formatNumber(r.hoursPerYear, 0) + ' billable hours a year (' +
      C.formatNumber(r.hoursPerWeek, 0) + ' a week)';

    // stacked bar
    var total = r.grossRevenue || 1;
    $('barNet').style.width = pct(r.targetNet, total) + '%';
    $('barTax').style.width = pct(r.taxAmount, total) + '%';
    $('barExp').style.width = pct(r.expenses, total) + '%';
    $('barBuf').style.width = pct(r.bufferAmount, total) + '%';

    $('legNet').textContent = money(r.targetNet);
    $('legTax').textContent = money(r.taxAmount);
    $('legExp').textContent = money(r.expenses);
    $('legBuf').textContent = money(r.bufferAmount);

    $('rowNet').textContent = money(r.targetNet);
    $('rowProfit').textContent = money(r.profitNeeded);
    $('rowExp').textContent = money(r.expenses);
    $('rowBufLabel').textContent = 'Buffer (' + C.num(state.bufferPct) + '%)';
    $('rowBuf').textContent = money(r.bufferAmount);
    $('rowRevenue').textContent = money(r.grossRevenue);
    $('rowTax').textContent = money(r.taxAmount);

    // sensitivity
    var weekly = [15, 20, 25, 30, 35, 40];
    var tbody = $('sensitivity').querySelector('tbody');
    tbody.innerHTML = '';
    weekly.forEach(function (h) {
      var rr = C.computeRequiredRate({
        netIncome: state.netIncome,
        expenses: state.expenses,
        taxRate: state.taxRate,
        bufferPct: state.bufferPct,
        daysPerWeek: 5,
        hoursPerDay: h / 5,
        weeksPerYear: state.weeksPerYear
      });
      var tr = document.createElement('tr');
      var c1 = document.createElement('td'); c1.textContent = h + ' h';
      var c2 = document.createElement('td'); c2.textContent = C.formatNumber(rr.hoursPerYear, 0);
      var c3 = document.createElement('td'); c3.className = 'num strong'; c3.textContent = money(rr.hourlyRate);
      tr.appendChild(c1); tr.appendChild(c2); tr.appendChild(c3);
      tbody.appendChild(tr);
    });

    // project quote
    if (!projTouched && r.hourlyRate > 0) $('projRate').value = Math.round(r.hourlyRate);
    var q = C.computeProjectQuote({
      hours: num('projHours'),
      hourlyRate: num('projRate'),
      contingencyPct: num('projContingency'),
      discountPct: num('projDiscount')
    });
    $('projTotal').textContent = q.total > 0 ? money(q.total) : '—';
    $('projNote').textContent = q.total > 0
      ? 'That works out at ' + money(q.effectiveRate) + ' an hour after contingency and discount.'
      : 'Enter hours and a rate.';

    // tax set-aside
    var as = C.taxSetAside(num('payAmount'), state.taxRate);
    $('asidePct').textContent = C.num(state.taxRate);
    $('asideAmount').textContent = as.amount > 0 ? money(as.setAside) : '—';
    $('asideNote').textContent = as.amount > 0
      ? 'Keep ' + money(as.setAside) + ', spend ' + money(as.keep) + ' — the tax bill is already covered.'
      : 'Keep this much for tax, spend the rest.';

    // chips
    document.querySelectorAll('#incomePresets .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(C.num(b.getAttribute('data-net')) === state.netIncome));
    });
    var hw = Math.round(state.hoursPerDay * state.daysPerWeek);
    document.querySelectorAll('#capacityPresets .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', String(C.num(b.getAttribute('data-cap').split(',')[0]) === hw));
    });
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state, currency: currency })); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && raw.state) {
        Object.keys(state).forEach(function (k) {
          if (typeof raw.state[k] === 'number') state[k] = raw.state[k];
        });
      }
      if (raw && raw.currency) currency = raw.currency;
    } catch (e) { /* ignore */ }
  }

  function summaryText() {
    readInputs();
    var r = C.computeRequiredRate(state);
    var lines = [
      'My freelance rate (' + currency + ')',
      'Hourly: ' + money(r.hourlyRate),
      'Day (' + state.hoursPerDay + 'h): ' + money(r.dayRate),
      'Week: ' + money(r.weekRate),
      'Monthly retainer: ' + money(r.monthlyRetainer),
      'Billable hours/year: ' + C.formatNumber(r.hoursPerYear, 0),
      'Revenue to bill: ' + money(r.grossRevenue),
      'Tax set aside: ' + money(r.taxAmount),
      'Calculated with Invoice & Rate Kit'
    ];
    return lines.join('\n');
  }

  function init() {
    if (!$('rateForm')) return;
    load();
    applyState();
    $('rateCurrency').value = currency;

    document.querySelectorAll('#rate-tool input, #rate-tool select').forEach(function (el) {
      if (el.id === 'rateCurrency') return; // has its own handler below
      el.addEventListener('input', function () {
        if (el.id === 'projRate') projTouched = true;
        render();
        save();
      });
      el.addEventListener('change', function () { render(); save(); });
    });

    $('rateCurrency').addEventListener('change', function () {
      currency = this.value;
      render();
      save();
    });

    document.querySelectorAll('#incomePresets .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        $('netIncome').value = b.getAttribute('data-net');
        render();
        save();
      });
    });

    document.querySelectorAll('#capacityPresets .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.getAttribute('data-cap').split(',');
        var hoursPerWeek = C.num(parts[0]);
        $('daysPerWeek').value = 5;
        $('hoursPerDay').value = Math.round((hoursPerWeek / 5) * 10) / 10;
        $('weeksPerYear').value = parts[1];
        render();
        save();
      });
    });

    $('rateReset').addEventListener('click', function () {
      state = { netIncome: 60000, expenses: 6000, taxRate: 25, bufferPct: 10, daysPerWeek: 5, hoursPerDay: 5, weeksPerYear: 46 };
      projTouched = false;
      applyState();
      render();
      save();
      if (window.IRK && window.IRK.toast) window.IRK.toast('Reset to defaults');
    });

    $('copySummary').addEventListener('click', function () {
      var text = summaryText();
      var done = function () { if (window.IRK) window.IRK.toast('Summary copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {
          if (window.IRK) window.IRK.toast('Copy not available in this browser');
        }
        document.body.removeChild(ta);
      }
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.IRKRate = { getState: function () { return state; }, render: render };
})();
