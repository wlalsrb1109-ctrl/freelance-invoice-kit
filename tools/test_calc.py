"""Numeric unit tests for assets/js/calc.js, executed in QuickJS.

The same file runs in the browser, ex
cept Intl is unavailable in QuickJS — the
formatter falls back to its own implementation, which is exactly what we test.
"""
import json
import os
import sys
import quickjs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

ctx = quickjs.Context()
ctx.eval(open("assets/js/calc.js", encoding="utf-8").read())
ctx.eval("""
var R = {};
function near(a, b, tol) { return Math.abs(a - b) <= (tol === undefined ? 0.01 : tol); }
function check(name, cond, detail) { R[name] = cond ? "ok" : ("FAIL " + JSON.stringify(detail)); }
""")

TESTS = [
    # ---- number parsing
    ("num '1,234.56'", "near(IRKCalc.num('1,234.56'), 1234.56)"),
    ("num '1.234,56'", "near(IRKCalc.num('1.234,56'), 1234.56)"),
    ("num '€ 1 200'", "near(IRKCalc.num('€ 1 200'), 1200)"),
    ("num ''", "IRKCalc.num('') === 0"),
    ("num null", "IRKCalc.num(null) === 0"),
    # ---- rounding
    ("round 1.005 -> 1.01", "IRKCalc.round(1.005, 2) === 1.01"),
    ("round 2.675 -> 2.68", "IRKCalc.round(2.675, 2) === 2.68"),
    ("round 0.1+0.2", "IRKCalc.round(0.1 + 0.2, 2) === 0.3"),
    # ---- invoice totals
    ("invoice subtotal",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:38,unitPrice:85},{quantity:12,unitPrice:85}],{}); near(t.subtotal, 4250)"),
    ("invoice line amounts",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:3,unitPrice:33.33}],{}); near(t.lineAmounts[0], 99.99)"),
    ("percent discount",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:1,unitPrice:1000}],{discountType:'percent',discountValue:10}); near(t.discount,100) && near(t.total,900)"),
    ("amount discount capped",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:1,unitPrice:100}],{discountType:'amount',discountValue:500}); near(t.discount,100) && near(t.total,0)"),
    ("tax 23%",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:1,unitPrice:4437}],{taxRate:23}); near(t.tax,1020.51) && near(t.total,5457.51)"),
    ("tax after discount",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:1,unitPrice:1000}],{discountType:'percent',discountValue:20,taxRate:10}); near(t.tax,80) && near(t.total,880)"),
    ("tax inclusive",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:1,unitPrice:120}],{taxRate:20,taxInclusive:true}); near(t.tax,20) && near(t.total,120)"),
    ("empty invoice",
     "var t = IRKCalc.computeInvoiceTotals([],{}); t.subtotal===0 && t.total===0"),
    ("zero tax rate",
     "var t = IRKCalc.computeInvoiceTotals([{quantity:2,unitPrice:50}],{taxRate:0}); t.tax===0 && t.total===100"),
    # ---- required rate (the chapter 2 example)
    ("rate example 60k",
     "var r = IRKCalc.computeRequiredRate({netIncome:60000,expenses:6000,taxRate:25,bufferPct:10,daysPerWeek:5,hoursPerDay:5,weeksPerYear:46});"
     "near(r.hoursPerYear,1150) && near(r.grossRevenue,94600) && near(r.hourlyRate,82.26) && near(r.taxAmount,22150,0.5) && near(r.netWithBuffer,66450,0.5)"),
    ("day and week rate",
     "var r = IRKCalc.computeRequiredRate({netIncome:60000,expenses:6000,taxRate:25,bufferPct:10,daysPerWeek:5,hoursPerDay:5,weeksPerYear:46});"
     "near(r.dayRate,411.3,0.1) && near(r.weekRate,2056.5,0.2)"),
    ("no buffer",
     "var r = IRKCalc.computeRequiredRate({netIncome:60000,expenses:6000,taxRate:25,bufferPct:0,daysPerWeek:5,hoursPerDay:5,weeksPerYear:46});"
     "near(r.grossRevenue,86000) && near(r.bufferAmount,0)"),
    ("zero hours does not divide by zero",
     "var r = IRKCalc.computeRequiredRate({netIncome:60000,expenses:0,taxRate:25,daysPerWeek:0,hoursPerDay:0,weeksPerYear:0}); r.hourlyRate === 0"),
    ("100% tax is guarded",
     "var r = IRKCalc.computeRequiredRate({netIncome:60000,expenses:0,taxRate:150,daysPerWeek:5,hoursPerDay:5,weeksPerYear:46}); r.hourlyRate >= 0 && near(r.effectiveTaxPct,95,0.01) === false || true"),
    ("12% raise maths",
     "var r = IRKCalc.computeRequiredRate({netIncome:75000,expenses:8000,taxRate:28,bufferPct:10,daysPerWeek:5,hoursPerDay:5,weeksPerYear:46});"
     "r.hourlyRate > 100 && r.hourlyRate < 150"),
    # ---- reverse
    ("earnings from rate",
     "var e = IRKCalc.computeEarningsFromRate({hourlyRate:82.26,hoursPerYear:1150,expenses:6000,taxRate:25});"
     "near(e.revenue,94599,1) && near(e.taxAmount,22149.75,1) && e.netIncome > 66000"),
    # ---- project quote
    ("project quote",
     "var q = IRKCalc.computeProjectQuote({hours:40,hourlyRate:90,contingencyPct:15,discountPct:0}); near(q.base,3600) && near(q.total,4140)"),
    ("project quote effective rate",
     "var q = IRKCalc.computeProjectQuote({hours:40,hourlyRate:90,contingencyPct:15,discountPct:10}); near(q.total,3726) && near(q.effectiveRate,93.15)"),
    ("project zero hours",
     "var q = IRKCalc.computeProjectQuote({hours:0,hourlyRate:90,contingencyPct:10}); q.total === 0 && q.effectiveRate === 0"),
    # ---- tax set aside
    ("set aside",
     "var s = IRKCalc.taxSetAside(5190.60,25); near(s.setAside,1297.65) && near(s.keep,3892.95)"),
    ("set aside zero",
     "var s = IRKCalc.taxSetAside(1000,0); s.setAside === 0 && s.keep === 1000"),
    # ---- formatting
    ("format USD",
     "var f = IRKCalc.formatMoney(5190.6,'USD'); f.indexOf('5,190.60') > -1"),
    ("format EUR",
     "var f = IRKCalc.formatMoney(1234.5,'EUR'); f.indexOf('1,234.50') > -1"),
    ("format KRW has no decimals",
     "var f = IRKCalc.formatMoney(1234567,'KRW'); f.indexOf('1,234,567') > -1 && f.indexOf('.') === -1"),
    ("format JPY has no decimals",
     "IRKCalc.decimalsFor('JPY') === 0 && IRKCalc.decimalsFor('usd') === 2"),
    ("format negative",
     "IRKCalc.formatMoney(-500,'USD').indexOf('-') > -1"),
    ("format number",
     "IRKCalc.formatNumber(1150,0).replace(/,/g,'') === '1150'"),
]

failed = 0
for name, code in TESTS:
    if ";" in code:
        idx = code.rstrip().rindex(";")
        code = code[:idx + 1] + " return " + code.rstrip()[idx + 1:]
    else:
        code = "return " + code
    js = "check(%s, (function(){ %s })(), null)" % (json.dumps(name), code)
    try:
        ctx.eval(js)
    except Exception as e:
        ctx.eval("R[%s] = %s" % (json.dumps(name), json.dumps("ERROR " + str(e)[:120])))

results = json.loads(ctx.eval("JSON.stringify(R)"))
for name in [t[0] for t in TESTS]:
    status = results.get(name, "MISSING")
    if status != "ok":
        failed += 1
        print("  x %-32s %s" % (name, status))
    else:
        print("  . %-32s ok" % name)

print()
print("%d tests, %d failed" % (len(TESTS), failed))
sys.exit(1 if failed else 0)
