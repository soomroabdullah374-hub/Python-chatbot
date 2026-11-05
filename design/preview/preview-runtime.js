/*
 * CodeBloom design preview runtime.
 * Renders a design screen's <template> using the screen's Component class:
 *   {{ path }}            -> value from renderVals() / loop scope
 *   <template data-sc-for list="{{ xs }}" as="x">  -> repeat
 *   <template data-sc-if value="{{ cond }}">       -> conditional
 *   onClick="{{ fn }}"     -> event handler
 * This file exists only so the static previews are clickable. It is NOT part of the app;
 * build the real UI in Next.js/React following design/README.md.
 */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, next);
      schedule();
    }
    forceUpdate() { schedule(); }
  }
  window.DCLogic = DCLogic;

  let inst, tpl, root, pending = false;
  const WHOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const ANY = /\{\{\s*([^}]+?)\s*\}\}/g;

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function resolve(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    let v = scope;
    for (const k of path.split('.')) {
      if (v == null) return undefined;
      v = v[k];
    }
    return v;
  }

  function interp(str, scope) {
    return str.replace(ANY, (_, p) => {
      const v = resolve(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function attrValue(node, name, scope) {
    const raw = node.getAttribute(name) || '';
    const m = raw.match(WHOLE);
    return m ? resolve(m[1], scope) : raw;
  }

  function eventName(attr) {
    const n = attr.slice(2).toLowerCase();
    return n === 'doubleclick' ? 'dblclick' : n;
  }

  function processNode(node, scope, out) {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      out.appendChild(document.createTextNode(t.indexOf('{{') >= 0 ? interp(t, scope) : t));
      return;
    }
    if (node.nodeType !== 1) return;

    if (node.localName === 'template' && node.hasAttribute('data-sc-for')) {
      const list = attrValue(node, 'list', scope) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        const s = Object.create(scope);
        s[as] = item;
        s.$index = i;
        node.content.childNodes.forEach((c) => processNode(c, s, out));
      });
      return;
    }
    if (node.localName === 'template' && node.hasAttribute('data-sc-if')) {
      if (attrValue(node, 'value', scope)) node.content.childNodes.forEach((c) => processNode(c, scope, out));
      return;
    }

    const el = node.cloneNode(false);
    for (const a of Array.from(el.attributes)) {
      const v = a.value;
      if (v.indexOf('{{') < 0) continue;
      const m = v.match(WHOLE);
      if (/^on/i.test(a.name)) {
        el.removeAttribute(a.name);
        const fn = m ? resolve(m[1], scope) : null;
        if (typeof fn === 'function') {
          el.addEventListener(eventName(a.name), (e) => {
            if (el.localName === 'a' && el.getAttribute('href') === '#') e.preventDefault();
            fn(e);
          });
        }
        continue;
      }
      if (m) {
        const val = resolve(m[1], scope);
        if (val === true) el.setAttribute(a.name, '');
        else if (val === false || val == null) el.removeAttribute(a.name);
        else el.setAttribute(a.name, String(val));
      } else {
        el.setAttribute(a.name, interp(v, scope));
      }
    }
    if (el.localName === 'textarea' && el.hasAttribute('value')) {
      el.textContent = el.getAttribute('value');
      el.removeAttribute('value');
    }
    node.childNodes.forEach((c) => processNode(c, scope, el));
    out.appendChild(el);
  }

  function render() {
    const vals = inst.renderVals() || {};
    const frag = document.createDocumentFragment();
    tpl.content.childNodes.forEach((c) => processNode(c, vals, frag));
    root.replaceChildren(frag);
    if (!document.documentElement.classList.contains('dc-rendered')) {
      requestAnimationFrame(() => setTimeout(() => document.documentElement.classList.add('dc-rendered'), 900));
    }
  }

  window.__mount = function (Component) {
    tpl = document.getElementById('tpl');
    root = document.getElementById('root');
    inst = new Component(window.__PROPS__ || {});
    render();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
  };
})();
