/*!
 * pro.js — checkout wiring for the Pro bundle.
 * While config.proCheckoutUrl is empty the buttons explain the launch state
 * instead of sending anyone to a dead link.
 */
(function () {
  'use strict';

  function init() {
    var CFG = window.WEBTOOL_CONFIG || {};
    var note = document.getElementById('checkoutNote');
    var buttons = document.querySelectorAll('[data-checkout]');
    if (!buttons.length) return;

    if (CFG.proCheckoutUrl) {
      buttons.forEach(function (b) {
        b.addEventListener('click', function () {
          window.open(CFG.proCheckoutUrl, '_blank', 'noopener');
        });
      });
      return;
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        if (note) note.hidden = false;
        if (window.IRK && window.IRK.toast) {
          window.IRK.toast('Checkout opens with the launch — the sample is free');
        }
        var sample = document.querySelector('a[href$="Pricing-Cheat-Sheet.pdf"]');
        if (sample) sample.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
