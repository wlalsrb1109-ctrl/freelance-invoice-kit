# Invoice & Rate Kit

Two free, browser-only tools for freelancers, plus an optional paid template bundle.

- **Free invoice generator** (`index.html`) — live A4/Letter preview, tax, discount, deposit and balance, logo upload, 10 currencies, print or save as PDF.
- **Free freelance rate calculator** (`rate-calculator.html`) — works back from take-home pay through expenses, tax, buffer and real billable hours; includes a project quote builder and a tax set-aside estimator.
- **Pro Freelancer Kit** (`pro.html`) — $14 one-time bundle: Excel finance workbook, Word invoice template, 25-page pricing playbook, Notion pack.

Everything is static HTML/CSS/JS. No build step, no framework, no server, no analytics, no account. Invoice data never leaves the browser (localStorage only).

## Structure

```
index.html              invoice generator (landing + tool)
rate-calculator.html    freelance rate & tax calculator
pro.html                Pro kit sales page
about.html  privacy.html  terms.html   404.html
sitemap.xml  robots.txt  .nojekyll
assets/css/site.css
assets/js/config.js     ← the only file to edit for monetization
assets/js/calc.js       pure calculation engine (no DOM, unit-tested)
assets/js/invoice.js    invoice generator UI
assets/js/rate.js       rate calculator UI
assets/js/app.js        nav, year, ad slots, Pro links, toast
assets/js/pro.js        checkout wiring
assets/img/             favicon.svg, og-image.png
pro-bundle/free-sample/ free sample PDF (the paid bundle is delivered through the checkout)
tools/                  validators, headless UI tests and the OG image generator
```

## Deploy (GitHub Pages)

The site is written with **relative paths**, so it works at a project URL
(`https://<user>.github.io/<repo>/`) or at a domain root.

Live at **https://wlalsrb1109-ctrl.github.io/freelance-invoice-kit/** — GitHub Pages
publishes the `gh-pages` branch (root). To ship a change, update `main`, then publish it:

```bash
git push origin main
git push origin main:gh-pages
```

`.nojekyll` is included so files are served as-is. Only the public files are in this
repository: the paid Pro bundle (workbook, Word template, playbook, Notion pack) and the
builder scripts that generate it are excluded on purpose — they are delivered through
the checkout, never from this repo.

## Turning on monetization

Edit `assets/js/config.js` only — nothing else needs to change.

| Setting | What it does |
| --- | --- |
| `adsenseClient` | `'ca-pub-…'`. While empty, **no ad container is rendered** (no empty boxes on the page). |
| `adSlots.top / bottom / sidebar` | Numeric ad-unit IDs. A slot with no ID is hidden. |
| `proCheckoutUrl` | Gumroad checkout URL — currently `https://wlalsrb.gumroad.com/l/pro-freelancer-kit`. Every Pro button opens it in a new tab; when it is empty, the buttons point to `pro.html` and explain the launch state instead of hitting a dead link. |
| `proPrice` | Price shown in the header, cards and sales page. |
| `contactUrl`, `repoUrl` | Public contact route (issue tracker — no personal email is published). |

## Validate before deploying

```bash
python3 tools/validate.py          # links, meta, JSON-LD, duplicate ids, DOM wiring, JS syntax
python3 tools/test_calc.py         # 35 numeric unit tests of the calculation engine
cd tools && python3 test_ui.py        # 24 checks: runs the real invoice.js against the real markup
cd tools && python3 test_rate_ui.py   # 21 checks: the same for rate.js
python3 -m http.server 8080        # then open http://localhost:8080/
```

The UI tests use `tools/_domshim.py`, a minimal DOM built from the actual HTML, so the
page scripts run head-lessly. They are not a rendering test — open the site in a browser
before shipping changes to layout or print CSS.

## Deploying

`bash tools/deploy.sh` creates the public repo, pushes and enables Pages (it explains
what to do if the current GitHub connection cannot create repositories).

## Rebuild the share image

```bash
python3 tools/generate_og.py       # assets/img/og-image.png
```

The Pro bundle files (workbook, Word template, pricing playbook, Notion pack) are
produced in the private working copy and delivered through the checkout; they are
not part of this repository.

## Licence

Site code: personal and commercial use of the tools is free; the code may not be resold as a competing product. The Pro bundle templates are licensed to buyers for their own freelance business. Not tax, legal or financial advice.
