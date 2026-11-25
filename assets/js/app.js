/*!
 * app.js — shared UI helpers: nav state, year, ads, Pro links, toasts.
 */
(function () {
  'use strict';

  var CFG = window.WEBTOOL_CONFIG || {};

  /* --- current page in the nav --- */
  function markNav() {
    var path = location.pathname.split('/').pop() || 'index.html';
    if (path === '') path = 'index.html';
    var links = document.querySelectorAll('.nav a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href === path) links[i].setAttribute('aria-current', 'page');
    }
  }

  /* --- footer year --- */
  function setYear() {
    var els = document.querySelectorAll('[data-year]');
    for (var i = 0; i < els.length; i++) els[i].textContent = String(new Date().getFullYear());
  }

  /* --- AdSense: only rendered when a publisher ID is configured --- */
  function initAds() {
    if (!CFG.adsenseClient) return;
    document.documentElement.setAttribute('data-ads', 'on');
    var slots = document.querySelectorAll('.ad-slot[data-ad-slot]');
    for (var i = 0; i < slots.length; i++) {
      var key = slots[i].getAttribute('data-ad-slot');
      var id = (CFG.adSlots && CFG.adSlots[key]) || '';
      if (!id) { slots[i].style.display = 'none'; continue; }
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', CFG.adsenseClient);
      ins.setAttribute('data-ad-slot', id);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slots[i].appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* blocked */ }
    }
  }

  /* --- Pro CTA: checkout when configured, sales page otherwise --- */
  function initProLinks() {
    var links = document.querySelectorAll('[data-pro-link]');
    for (var i = 0; i < links.length; i++) {
      if (CFG.proCheckoutUrl) {
        links[i].setAttribute('href', CFG.proCheckoutUrl);
        links[i].setAttribute('target', '_blank');
        links[i].setAttribute('rel', 'noopener');
      } else if (!links[i].getAttribute('href') || links[i].getAttribute('href') === '#') {
        links[i].setAttribute('href', 'pro.html');
      }
    }
    var priceEls = document.querySelectorAll('[data-pro-price]');
    for (var j = 0; j < priceEls.length; j++) {
      if (CFG.proPrice) priceEls[j].textContent = CFG.proPrice;
    }
  }

  /* --- toast --- */
  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    markNav();
    setYear();
    initAds();
    initProLinks();
  });

  window.IRK = window.IRK || {};
  window.IRK.toast = toast;
})();
