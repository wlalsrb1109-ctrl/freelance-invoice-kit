/*!
 * config.js — the only file you edit to switch on monetization.
 * Everything is optional; the site works with these empty.
 */
window.WEBTOOL_CONFIG = {
  siteName: 'Invoice & Rate Kit',

  /* Your live URL (used for canonical + sitemap checks). */
  baseUrl: 'https://wlalsrb1109-ctrl.github.io/freelance-invoice-kit',

  /* --- Google AdSense ---------------------------------------------------
     After AdSense approves the site, paste your publisher ID here, e.g.
     adsenseClient: 'ca-pub-1234567890123456'
     and the numeric slot IDs of the ad units you create in AdSense.
     While these are empty no ad container is rendered (no empty boxes). */
  adsenseClient: '',
  adSlots: {
    top: '',
    bottom: '',
    sidebar: ''
  },

  /* --- Lemon Squeezy ----------------------------------------------------
     Paste the checkout URL of the Pro bundle here once the product is live,
     e.g. 'https://yourstore.lemonsqueezy.com/checkout/buy/1a2b3c4d-...'
     While empty, every "Get the Pro kit" button points to pro.html */
  proCheckoutUrl: '',
  proPrice: '$14',

  /* --- Contact ----------------------------------------------------------
     No personal email is published: support runs through the public repo. */
  repoUrl: 'https://github.com/wlalsrb1109-ctrl/freelance-invoice-kit',
  contactUrl: 'https://github.com/wlalsrb1109-ctrl/freelance-invoice-kit/issues/new',

  /* Defaults for the invoice generator */
  defaultCurrency: 'USD',
  defaultTaxLabel: 'VAT',
  defaultTaxRate: 0,
  defaultPaymentTerms: 14
};
