"""Minimal DOM shim so the real page scripts can run head-lessly under QuickJS.

Builds a node tree from the actual HTML file, then exposes document/window/
localStorage stubs covering exactly the APIs the site's own JS uses.
"""
import json
import os

import quickjs
from lxml import html as LH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

JS_SHIM = r"""
var NODES = [];
var MAP = {};
function Node(s) {
  this.tagName = (s.tag || 'div').toUpperCase();
  this.id = s.id;
  this.className = s.cls || '';
  this.attrs = s.attrs || {};
  this.type = s.type || '';
  this.value = s.value === undefined ? '' : s.value;
  this.checked = false;
  this.hidden = !!s.hidden;
  this.childNodes = [];
  this.parentNode = null;
  this.listeners = {};
  this.options = (s.options || []).map(function (o) { return { value: o.value, text: o.text }; });
  this.style = {};
  this.clientWidth = 720;
  this.offsetHeight = 1040;
  this._text = s.text || '';
  var self = this;
  this.classList = {
    add: function (c) { if (!self.hasClass(c)) self.className = (self.className + ' ' + c).trim(); },
    remove: function (c) { self.className = self.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
    toggle: function (c, on) { if (on === undefined) on = !self.hasClass(c); on ? self.classList.add(c) : self.classList.remove(c); },
    contains: function (c) { return self.hasClass(c); }
  };
  if (this.id) { NODES.push(this); MAP[this.id] = this; }
  var kids = s.children || [];
  for (var i = 0; i < kids.length; i++) {
    var k = new Node(kids[i]);
    k.parentNode = this;
    this.childNodes.push(k);
  }
}
Node.prototype.hasClass = function (c) { return this.className.split(/\s+/).indexOf(c) > -1; };
Object.defineProperty(Node.prototype, 'textContent', {
  get: function () { return this._text; },
  set: function (v) { this._text = String(v); this.childNodes = []; }
});
Object.defineProperty(Node.prototype, 'innerHTML', {
  get: function () { return this._text; },
  set: function (v) { this._text = String(v); this.childNodes = []; }
});
Node.prototype.appendChild = function (n) { n.parentNode = this; this.childNodes.push(n); if (n.id) MAP[n.id] = n; return n; };
Node.prototype.removeChild = function (n) { this.childNodes = this.childNodes.filter(function (x) { return x !== n; }); };
Node.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
Node.prototype.getAttribute = function (k) { return this.attrs[k] === undefined ? null : this.attrs[k]; };
Node.prototype.hasAttribute = function (k) { return this.attrs[k] !== undefined; };
Node.prototype.addEventListener = function (ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); };
Node.prototype.focus = function () {};
Node.prototype.scrollIntoView = function () {};
Node.prototype.querySelectorAll = function (sel) { return query(sel, this); };
Node.prototype.querySelector = function (sel) { var r = query(sel, this); return r.length ? r[0] : null; };
Node.prototype.dispatch = function (ev) {
  var ls = this.listeners[ev] || [];
  for (var i = 0; i < ls.length; i++) ls[i].call(this, { target: this, preventDefault: function () {} });
};
Node.prototype.descendants = function () {
  var out = [];
  (function walk(n) {
    for (var i = 0; i < n.childNodes.length; i++) { out.push(n.childNodes[i]); walk(n.childNodes[i]); }
  })(this);
  return out;
};

var ROOT_NODES = [];
for (var ri = 0; ri < SPEC.length; ri++) ROOT_NODES.push(new Node(SPEC[ri]));

function allNodes() {
  var out = [];
  function walk(n) { out.push(n); for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]); }
  for (var i = 0; i < ROOT_NODES.length; i++) walk(ROOT_NODES[i]);
  return out;
}

function matchToken(n, tok) {
  if (!tok) return true;
  if (tok.charAt(0) === '#') return n.id === tok.slice(1);
  if (tok.charAt(0) === '.') return n.hasClass(tok.slice(1));
  if (tok.charAt(0) === '[') {
    var attr = tok.slice(1, -1).split('=')[0];
    return n.attrs[attr] !== undefined;
  }
  return n.tagName === tok.toUpperCase();
}

function query(sel, rootNode) {
  var parts = String(sel).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var out = [];
  for (var p = 0; p < parts.length; p++) {
    var tokens = parts[p].split(/\s+/).filter(Boolean);
    var current = rootNode ? rootNode.descendants() : allNodes();
    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];
      if (t === 0) {
        current = current.filter(function (n) { return matchToken(n, tok); });
      } else {
        var next = [];
        current.forEach(function (n) {
          n.descendants().forEach(function (d) { if (matchToken(d, tok)) next.push(d); });
        });
        current = next;
      }
    }
    for (var i = 0; i < current.length; i++) if (out.indexOf(current[i]) === -1) out.push(current[i]);
  }
  return out;
}

var __timers = [];
function setTimeout(fn) { __timers.push(fn); return __timers.length; }
function clearTimeout() {}
function setInterval() { return 0; }
function clearInterval() {}
function requestAnimationFrame(fn) { __timers.push(fn); return 0; }
function flushTimers() { __timers.splice(0).forEach(function (f) { f(); }); }

var document = {
  readyState: 'complete',
  body: ROOT_NODES[ROOT_NODES.length - 1],
  getElementById: function (id) { return MAP[id] || null; },
  querySelectorAll: function (sel) { return query(sel, null); },
  querySelector: function (sel) { var r = query(sel, null); return r.length ? r[0] : null; },
  createElement: function (tag) { return new Node({ tag: tag, children: [] }); },
  addEventListener: function () {},
  fonts: null,
  documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } }
};
var STORE = {};
var localStorage = {
  getItem: function (k) { return STORE[k] === undefined ? null : STORE[k]; },
  setItem: function (k, v) { STORE[k] = String(v); },
  removeItem: function (k) { delete STORE[k]; }
};
var window = {
  addEventListener: function () {},
  print: function () {},
  confirm: function () { return true; },
  open: function () {},
  IRK: { toast: function () {} },
  location: { pathname: '/', search: '' }
};
window.window = window;
var navigator = { clipboard: null };
var console = { log: function () {} };
"""


def spec_of(el):
    node = {
        "tag": el.tag,
        "id": el.get("id") or "",
        "cls": el.get("class") or "",
        "attrs": {k: v for k, v in el.attrib.items() if k.startswith("data-")},
        "type": (el.get("type") or "").lower(),
        "value": el.get("value") or "",
        "hidden": "hidden" in el.attrib,
        "text": "",
        "options": [],
        "children": [],
    }
    if el.tag == "select":
        node["options"] = [{"value": o.get("value"), "text": (o.text or "").strip()} for o in el.findall("option")]
    kids = [spec_of(c) for c in el if isinstance(c.tag, str)]
    node["children"] = kids
    if not kids:
        node["text"] = " ".join((el.text or "").split())
    return node


def load_page(page_file):
    """Return a QuickJS context with the page's DOM built and config/calc loaded."""
    tree = LH.parse(os.path.join(ROOT, page_file)).getroot()
    spec = [spec_of(c) for c in tree]
    ctx = quickjs.Context()
    ctx.eval("var SPEC = %s;" % json.dumps(spec))
    ctx.eval(JS_SHIM)
    for f in ("assets/js/config.js", "assets/js/calc.js"):
        ctx.eval(open(os.path.join(ROOT, f), encoding="utf-8").read())
    ctx.eval("window.IRKCalc = IRKCalc;")
    return ctx


def run_script(ctx, path):
    ctx.eval(open(os.path.join(ROOT, path), encoding="utf-8").read())


def flush(ctx):
    ctx.eval("flushTimers();")
