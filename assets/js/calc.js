/*!
 * calc.js — pure calculation engine for Invoice & Rate Kit
 * No DOM access. Safe to unit-test in any JS engine (used by tools/test_calc.mjs).
 * Exposes window.IRKCalc (browser) / module.exports (node/quickjs).
 */
(function (root) {
  'use strict';

  var ZERO_DECIMAL = { JPY: 1, KRW: 1 };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v === null || v === undefined) return 0;
    var s = String(v).replace(/[^\d.,\-]/g, '').trim();
    if (!s) return 0;
    // "1,234.56" -> 1234.56 ; "1.234,56" (comma decimal) -> 1234.56
    if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (s.indexOf(',') > -1) {
      s = (s.split(',').length === 2 && s.split(',')[1].length === 2) ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function decimalsFor(currency) {
    return ZERO_DECIMAL[String(currency || '').toUpperCase()] ? 0 : 2;
  }

  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    var v = n * p;
    // guard against binary float drift (1.005 -> 1.01)
    var r = Math.round(Math.abs(v) + 1e-9) * (v < 0 ? -1 : 1);
    return r / p;
  }

  function formatMoney(amount, currency, locale) {
    var cur = String(currency || 'USD').toUpperCase();
    var d = decimalsFor(cur);
    var value = round(amount, d);
    try {
      return new Intl.NumberFormat(locale || 'en-US', {
        style: 'currency',
        currency: cur,
        minimumFractionDigits: d,
        maximumFractionDigits: d
      }).format(value);
    } catch (e) {
      var sign = value < 0 ? '-' : '';
      var fixed = Math.abs(value).toFixed(d);
      var parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return sign + cur + ' ' + parts.join('.');
    }
  }

  function formatNumber(value, d) {
    var v = round(value, d === undefined ? 2 : d);
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: d === undefined ? 0 : d,
        maximumFractionDigits: d === undefined ? 2 : d
      }).format(v);
    } catch (e) {
      return String(v);
    }
  }

  /* ---------------- Invoice totals ---------------- */

  /**
   * items: [{ description, quantity, unitPrice }]
   * opts:  { discountType: 'percent'|'amount', discountValue, taxRate, taxInclusive }
   */
  function computeInvoiceTotals(items, opts) {
    opts = opts || {};
    var list = items || [];
    var lineAmounts = [];
    var subtotal = 0;
    for (var i = 0; i < list.length; i++) {
      var q = num(list[i].quantity);
      var p = num(list[i].unitPrice);
      var amount = round(q * p, 2);
      lineAmounts.push(amount);
      subtotal += amount;
    }
    subtotal = round(subtotal, 2);

    var discountValue = num(opts.discountValue);
    var discount = 0;
    if (opts.discountType === 'percent') {
      discount = round(subtotal * (Math.max(0, discountValue) / 100), 2);
    } else {
      discount = round(Math.max(0, discountValue), 2);
    }
    if (discount > subtotal) discount = subtotal;

    var base = round(subtotal - discount, 2);
    var taxRate = Math.max(0, num(opts.taxRate));
    var tax;
    if (opts.taxInclusive) {
      // prices already include tax
      tax = round(base - base / (1 + taxRate / 100), 2);
      base = round(base - tax, 2);
    } else {
      tax = round(base * (taxRate / 100), 2);
    }
    var total = round(base + tax, 2);

    return {
      lineAmounts: lineAmounts,
      subtotal: subtotal,
      discount: discount,
      taxableBase: base,
      tax: tax,
      total: total
    };
  }

  /* ---------------- Freelance rate & tax ---------------- */

  /**
   * inp: {
   *   netIncome: desired annual take-home pay,
   *   expenses: annual business expenses (deductible),
   *   taxRate: % of profit paid in income/sales tax,
   *   bufferPct: extra margin for slow months,
   *   daysPerWeek, hoursPerDay, weeksPerYear: billable capacity
   * }
   */
  function computeRequiredRate(inp) {
    inp = inp || {};
    var netIncome = Math.max(0, num(inp.netIncome));
    var expenses = Math.max(0, num(inp.expenses));
    var taxRate = Math.min(0.95, Math.max(0, num(inp.taxRate) / 100));
    var bufferPct = Math.max(0, num(inp.bufferPct));
    var daysPerWeek = Math.max(0, num(inp.daysPerWeek));
    var hoursPerDay = Math.max(0, num(inp.hoursPerDay));
    var weeksPerYear = Math.max(0, num(inp.weeksPerYear));
    var hoursPerYear = round(daysPerWeek * hoursPerDay * weeksPerYear, 2);

    var profitNeeded = taxRate < 1 ? netIncome / (1 - taxRate) : 0;
    var baseRevenue = profitNeeded + expenses;
    var bufferAmount = baseRevenue * (bufferPct / 100);
    var grossRevenue = baseRevenue + bufferAmount;

    var taxableProfit = Math.max(0, grossRevenue - expenses);
    var taxAmount = taxableProfit * taxRate;
    var netWithBuffer = taxableProfit - taxAmount;
    var hourly = hoursPerYear > 0 ? grossRevenue / hoursPerYear : 0;
    var hoursPerWeek = daysPerWeek * hoursPerDay;

    return {
      hoursPerYear: hoursPerYear,
      hoursPerWeek: round(hoursPerWeek, 2),
      targetNet: round(netIncome, 2),
      profitNeeded: round(profitNeeded, 2),
      expenses: round(expenses, 2),
      bufferAmount: round(bufferAmount, 2),
      grossRevenue: round(grossRevenue, 2),
      taxableProfit: round(taxableProfit, 2),
      taxAmount: round(taxAmount, 2),
      netIncome: round(netIncome, 2),
      netWithBuffer: round(netWithBuffer, 2),
      hourlyRate: round(hourly, 2),
      dayRate: round(hourly * hoursPerDay, 2),
      weekRate: round(hourly * hoursPerWeek, 2),
      monthlyRevenue: round(grossRevenue / 12, 2),
      monthlyRetainer: round(grossRevenue / 12, 2),
      effectiveTaxPct: grossRevenue > 0 ? round((taxAmount / grossRevenue) * 100, 2) : 0
    };
  }

  /**
   * Reverse view: given an hourly rate, what does the year look like?
   * inp: { hourlyRate, hoursPerYear, expenses, taxRate }
   */
  function computeEarningsFromRate(inp) {
    inp = inp || {};
    var hourly = Math.max(0, num(inp.hourlyRate));
    var hours = Math.max(0, num(inp.hoursPerYear));
    var expenses = Math.max(0, num(inp.expenses));
    var taxRate = Math.min(0.95, Math.max(0, num(inp.taxRate) / 100));

    var revenue = round(hourly * hours, 2);
    var profit = Math.max(0, revenue - expenses);
    var tax = round(profit * taxRate, 2);
    var net = round(profit - tax, 2);

    return {
      revenue: revenue,
      expenses: round(expenses, 2),
      taxableProfit: round(profit, 2),
      taxAmount: tax,
      netIncome: net,
      monthlyNet: round(net / 12, 2)
    };
  }

  /**
   * Project quote builder.
   * inp: { hours, hourlyRate, contingencyPct, discountPct }
   */
  function computeProjectQuote(inp) {
    inp = inp || {};
    var hours = Math.max(0, num(inp.hours));
    var rate = Math.max(0, num(inp.hourlyRate));
    var contingencyPct = Math.max(0, num(inp.contingencyPct));
    var discountPct = Math.min(100, Math.max(0, num(inp.discountPct)));

    var base = round(hours * rate, 2);
    var contingency = round(base * (contingencyPct / 100), 2);
    var subtotal = round(base + contingency, 2);
    var discount = round(subtotal * (discountPct / 100), 2);
    var total = round(subtotal - discount, 2);

    return {
      base: base,
      contingency: contingency,
      subtotal: subtotal,
      discount: discount,
      total: total,
      effectiveRate: hours > 0 ? round(total / hours, 2) : 0
    };
  }

  /** Money to set aside from a payment so the tax bill never surprises you. */
  function taxSetAside(amount, taxRate) {
    var a = Math.max(0, num(amount));
    var t = Math.min(100, Math.max(0, num(taxRate)));
    var setAside = round(a * (t / 100), 2);
    return { amount: round(a, 2), setAside: setAside, keep: round(a - setAside, 2) };
  }

  var API = {
    num: num,
    round: round,
    decimalsFor: decimalsFor,
    formatMoney: formatMoney,
    formatNumber: formatNumber,
    computeInvoiceTotals: computeInvoiceTotals,
    computeRequiredRate: computeRequiredRate,
    computeEarningsFromRate: computeEarningsFromRate,
    computeProjectQuote: computeProjectQuote,
    taxSetAside: taxSetAside
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.IRKCalc = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
