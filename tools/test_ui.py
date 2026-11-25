"""Headless smoke test for the invoice generator UI.

Runs the real index.html markup against the real assets/js/invoice.js (no browser
available in this environment) and simulates a user typing, then asserts the A4
preview, totals, numbering, persistence and controls all react correctly.
"""
import sys

import _domshim

ctx = _domshim.load_page("index.html")
_domshim.run_script(ctx, "assets/js/invoice.js")

results = {}


def check(name, expr):
    try:
        ok = ctx.eval("(function(){ return %s; })()" % expr)
    except Exception as e:
        ok = "ERROR: %s" % str(e)[:160]
    results[name] = ok


check("init ran (state exists)", "!!window.IRKInvoice.getState()")
check("invoice number generated", "/^INV-\\d{4}-\\d{3}$/.test(window.IRKInvoice.getState().meta.number)")
check("one blank line item", "window.IRKInvoice.getState().items.length === 1")
check("empty-state preview shows a hint", "document.getElementById('pvBizName').textContent.length > 0")

ctx.eval("""
var biz = document.getElementById('bizName');
biz.value = 'Studio Nova — Ana Silva';
biz.dispatch('input');
""")
check("business name reaches the preview",
      "document.getElementById('pvBizName').textContent === 'Studio Nova — Ana Silva'")

ctx.eval("""
var rows = document.querySelectorAll('#itemRows .item-row');
rows[0].querySelector('.i-desc').value = 'Homepage redesign';
rows[0].querySelector('.i-desc').dispatch('input');
rows[0].querySelector('.i-qty').value = '38';
rows[0].querySelector('.i-qty').dispatch('input');
rows[0].querySelector('.i-price').value = '85';
rows[0].querySelector('.i-price').dispatch('input');
""")
check("subtotal updates to 3,230", "document.getElementById('pvSubtotal').textContent.indexOf('3,230') > -1")
check("total equals subtotal with 0% tax", "document.getElementById('pvTotal').textContent.indexOf('3,230') > -1")
check("line amount rendered", "document.querySelectorAll('#pvItems tr')[0].childNodes[3].textContent.indexOf('3,230') > -1")
check("discount row hidden when no discount", "document.getElementById('pvDiscountRow').hidden === true")

ctx.eval("""
document.getElementById('addItem').dispatch('click');
var r2 = document.querySelectorAll('#itemRows .item-row');
r2[1].querySelector('.i-desc').value = 'Design system';
r2[1].querySelector('.i-desc').dispatch('input');
r2[1].querySelector('.i-qty').value = '12';
r2[1].querySelector('.i-qty').dispatch('input');
r2[1].querySelector('.i-price').value = '85';
r2[1].querySelector('.i-price').dispatch('input');
var dt = document.getElementById('discountType'); dt.value = 'percent'; dt.dispatch('change');
var dv = document.getElementById('discountValue'); dv.value = '5'; dv.dispatch('input');
var tr = document.getElementById('taxRate'); tr.value = '20'; tr.dispatch('input');
""")
check("subtotal after two lines = 4,250", "document.getElementById('pvSubtotal').textContent.indexOf('4,250') > -1")
check("discount row shows 212.50",
      "document.getElementById('pvDiscountRow').hidden === false && document.getElementById('pvDiscount').textContent.indexOf('212.50') > -1")
check("tax label carries the rate", "document.getElementById('pvTaxLabel').textContent.indexOf('20') > -1")
check("total = 4,845", "document.getElementById('pvTotal').textContent.indexOf('4,845') > -1")

ctx.eval("var pd = document.getElementById('paid'); pd.value = '1500'; pd.dispatch('input');")
check("balance due = 3,345 after a deposit",
      "document.getElementById('pvDueRow').hidden === false && document.getElementById('pvDueAmount').textContent.indexOf('3,345') > -1")

ctx.eval("var rc = document.getElementById('reverseCharge'); rc.checked = true; rc.dispatch('change');")
check("reverse charge zeroes tax and prints the note",
      "document.getElementById('pvTaxLabel').textContent.toLowerCase().indexOf('reverse') > -1 && document.getElementById('pvTotal').textContent.indexOf('4,037') > -1")

ctx.eval("var cur = document.getElementById('currency'); cur.value = 'EUR'; cur.dispatch('change');")
check("currency switch keeps the value (EUR)", "document.getElementById('pvTotal').textContent.indexOf('4,037') > -1")

ctx.eval("var dt2 = document.getElementById('docType'); dt2.value = 'quote'; dt2.dispatch('change');")
check("doc type switches heading and number prefix",
      "document.getElementById('pvDocType').textContent === 'QUOTE' && /^QT-/.test(window.IRKInvoice.getState().meta.number)")

ctx.eval("var tp = document.getElementById('termPreset'); tp.value = '30'; tp.dispatch('change');")
check("Net 30 sets the due date 30 days out",
      "Math.round((new Date(window.IRKInvoice.getState().meta.due) - new Date(window.IRKInvoice.getState().meta.issue)) / 86400000) === 30")

_domshim.flush(ctx)
check("state written to localStorage",
      "(function(){ var s = JSON.parse(localStorage.getItem('irk.invoice.v2')); return s.biz.name === 'Studio Nova — Ana Silva' && s.items.length === 2; })()")

ctx.eval("var lp = document.querySelectorAll('[data-paper]'); lp[1].dispatch('click');")
check("Letter paper sets the print rule", "document.getElementById('pageRule').textContent.indexOf('letter') > -1")

ctx.eval("var tp2 = document.querySelectorAll('[data-template]'); tp2[1].dispatch('click');")
check("template switch applies the class", "document.getElementById('sheet').className.indexOf('tpl-ledger') > -1")

ctx.eval("var rows3 = document.querySelectorAll('#itemRows .item-row'); rows3[1].querySelector('.i-del').dispatch('click');")
check("removing a line drops it from state", "window.IRKInvoice.getState().items.length === 1")

ctx.eval("document.getElementById('newBtn').dispatch('click');")
check("new invoice increments the number and keeps the business",
      "(function(){ var s = window.IRKInvoice.getState(); return s.items.length === 1 && s.biz.name === 'Studio Nova — Ana Silva' && /-002$/.test(s.meta.number); })()")

ctx.eval("document.getElementById('resetBtn').dispatch('click');")
check("reset clears everything", "window.IRKInvoice.getState().biz.name === ''")

failed = 0
for name, ok in results.items():
    if ok is True:
        print("  . %-58s ok" % name)
    else:
        failed += 1
        print("  x %-58s %s" % (name, ok))

print()
print("%d invoice UI checks, %d failed" % (len(results), failed))
sys.exit(1 if failed else 0)
