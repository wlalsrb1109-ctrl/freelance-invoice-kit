"""Headless smoke test for the rate calculator UI (rate-calculator.html + rate.js)."""
import sys

import _domshim

ctx = _domshim.load_page("rate-calculator.html")
_domshim.run_script(ctx, "assets/js/rate.js")

results = {}


def check(name, expr):
    try:
        ok = ctx.eval("(function(){ return %s; })()" % expr)
    except Exception as e:
        ok = "ERROR: %s" % str(e)[:160]
    results[name] = ok


def txt(el_id):
    return ctx.eval("document.getElementById(%r).textContent" % el_id)


check("init renders a rate", "document.getElementById('outHourly').textContent.indexOf('82') > -1")

# defaults: 60k net, 6k expenses, 25% tax, 10% buffer, 5x5x46 = 1150 hours -> $82.26
hourly = txt("outHourly")
check("default hourly rate is 82.26 (got %s)" % hourly, "document.getElementById('outHourly').textContent.indexOf('82.26') > -1")
check("default day rate 411", "document.getElementById('outDay').textContent.indexOf('411') > -1")
check("default week rate 2,056", "document.getElementById('outWeek').textContent.replace(/,/g,'').indexOf('2056') > -1")
check("billable hours 1,150", "document.getElementById('outHours').textContent.replace(/,/g,'') === '1150'")
check("revenue row shows 94,600", "document.getElementById('rowRevenue').textContent.replace(/,/g,'').indexOf('94600') > -1")
check("tax row shows 22,150", "document.getElementById('rowTax').textContent.replace(/,/g,'').indexOf('22150') > -1")
check("bar widths are percentages",
      "parseFloat(document.getElementById('barNet').style.width) > 50 && parseFloat(document.getElementById('barTax').style.width) > 15")

# change the take-home target
ctx.eval("var el = document.getElementById('netIncome'); el.value = '120000'; el.dispatch('input');")
check("doubling take-home raises the rate above 150",
      "parseFloat(document.getElementById('outHourly').textContent.replace(/[^0-9.]/g,'')) > 150")

# preset chip
ctx.eval("var chips = document.querySelectorAll('#incomePresets .chip'); chips[1].dispatch('click');")
check("preset chip sets 75,000",
      "document.getElementById('netIncome').value === '75000' && document.getElementById('incomePresets') !== null")

# capacity preset
ctx.eval("var caps = document.querySelectorAll('#capacityPresets .chip'); caps[0].dispatch('click');")
check("capacity preset sets 25 h/week", "Number(document.getElementById('hoursPerDay').value) === 5 && Number(document.getElementById('daysPerWeek').value) === 5")

# currency
ctx.eval("var cur = document.getElementById('rateCurrency'); cur.value = 'EUR'; cur.dispatch('change');")
check("currency switch keeps formatting", "document.getElementById('outHourly').textContent.indexOf('€') > -1 || document.getElementById('outHourly').textContent.indexOf('EUR') > -1")

# project quote uses the computed hourly rate
ctx.eval("""
var ph = document.getElementById('projHours'); ph.value = '40'; ph.dispatch('input');
var pc = document.getElementById('projContingency'); pc.value = '15'; pc.dispatch('input');
""")
check("project quote total is positive", "document.getElementById('projTotal').textContent.replace(/[^0-9]/g,'').length > 0")
check("project note mentions the effective rate",
      "document.getElementById('projNote').textContent.toLowerCase().indexOf('hour') > -1")
ctx.eval("var ph2 = document.getElementById('projHours'); ph2.value = '80'; ph2.dispatch('input');")
check("project hours drive the quote",
      "parseFloat(document.getElementById('projTotal').textContent.replace(/[^0-9.]/g,'')) > 5000")

# tax set-aside
ctx.eval("var pa = document.getElementById('payAmount'); pa.value = '2000'; pa.dispatch('input');")
check("set-aside of 25% of 2,000 = 500", "document.getElementById('asideAmount').textContent.replace(/,/g,'').indexOf('500') > -1")

# sensitivity table
check("sensitivity table has 6 rows", "document.querySelectorAll('#sensitivity tbody tr').length === 6")
check("fewer hours means a higher rate",
      "parseFloat(document.querySelectorAll('#sensitivity tbody tr')[0].childNodes[2].textContent.replace(/[^0-9.]/g,'')) > "
      "parseFloat(document.querySelectorAll('#sensitivity tbody tr')[5].childNodes[2].textContent.replace(/[^0-9.]/g,''))")

# zero capacity must not produce NaN or Infinity
ctx.eval("""
var d = document.getElementById('daysPerWeek'); d.value = '0'; d.dispatch('input');
var h = document.getElementById('hoursPerDay'); h.value = '0'; h.dispatch('input');
""")
check("zero hours never shows NaN/Infinity",
      "document.getElementById('outHourly').textContent.indexOf('NaN') === -1 && document.getElementById('outHourly').textContent.indexOf('Infinity') === -1")

_domshim.flush(ctx)
check("inputs persist to localStorage",
      "(function(){ var raw = JSON.parse(localStorage.getItem('irk.rate.v1')); return raw && typeof raw.state.netIncome === 'number'; })()")

ctx.eval("document.getElementById('rateReset').dispatch('click');")
check("reset restores the default rate", "Number(document.getElementById('netIncome').value) === 60000")

failed = 0
for name, ok in results.items():
    if ok is True:
        print("  . %-58s ok" % name)
    else:
        failed += 1
        print("  x %-58s %s" % (name, ok))

print()
print("%d rate UI checks, %d failed" % (len(results), failed))
sys.exit(1 if failed else 0)
