// Motor que interpreta as telas no formato .dc.html (template + classe de lógica)
// e as renderiza com Preact, fora do canvas de design.
import React from 'preact/compat';

const h = React.createElement;
const Fragment = React.Fragment;

const rawFiles = import.meta.glob('./screens/*.dc.html', { query: '?raw', import: 'default', eager: true });

const sources = {};
for (const path in rawFiles) {
  const name = path.split('/').pop().replace('.dc.html', '');
  sources[name] = rawFiles[path];
}

const defs = {};
const comps = {};
const injected = new Set();
let navigateFn = (name) => { window.location.hash = '#/' + name; };

export function setNavigate(fn) { navigateFn = fn; }
export function screenNames() { return Object.keys(sources); }
export function screenTitle(name) { return getDef(name).title; }

const HOLE_ALL = /\{\{\s*([^}]*?)\s*\}\}/g;
const HOLE_ONLY = /^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/;
const BOOL_ATTRS = new Set(['checked', 'disabled', 'selected', 'readonly', 'multiple', 'hidden', 'required', 'autofocus', 'open']);

function preprocess(src) {
  // <template> é aceito em qualquer lugar (inclusive dentro de <tbody>), então
  // sc-for / sc-if viram <template data-sc="..."> para o parser HTML não movê-los.
  return src
    .replace(/<sc-(for|if)\b/g, '<template data-sc="$1"')
    .replace(/<\/sc-(for|if)>/g, '</template>');
}

function getDef(name) {
  if (defs[name]) return defs[name];
  const src = sources[name];
  if (!src) throw new Error('Tela não encontrada: ' + name);
  const doc = new DOMParser().parseFromString(preprocess(src), 'text/html');
  const xdc = doc.querySelector('x-dc');
  const helmet = xdc.querySelector(':scope > helmet');
  const nodes = Array.from(xdc.childNodes).filter((n) => n !== helmet);
  const script = doc.querySelector('script[data-dc-script]');
  const titleEl = doc.querySelector('head > title');
  defs[name] = {
    name,
    title: titleEl ? titleEl.textContent : name,
    helmet,
    nodes,
    code: script ? script.textContent : 'class Component extends DCLogic { renderVals() { return {}; } }'
  };
  return defs[name];
}

// ---------- CSS: cada tela tem seus estilos escopados ----------
function scopeSelector(sel, name) {
  const s = sel.trim();
  if (!s) return s;
  if (/^(html|body|:root)\b/.test(s)) return s;
  const attr = '[data-dc="' + name + '"]';
  // aplica ao último seletor composto, antes de pseudo-classes / pseudo-elementos
  const lastSpace = Math.max(s.lastIndexOf(' '), s.lastIndexOf('>'), s.lastIndexOf('+'), s.lastIndexOf('~'));
  const head = s.slice(0, lastSpace + 1);
  const tail = s.slice(lastSpace + 1);
  const pseudo = tail.indexOf(':');
  return pseudo === -1 ? head + tail + attr : head + tail.slice(0, pseudo) + attr + tail.slice(pseudo);
}

function scopeRules(rules, name) {
  let out = '';
  for (const r of Array.from(rules)) {
    if (r.type === 1) { // CSSStyleRule
      const sel = r.selectorText.split(',').map((x) => scopeSelector(x, name)).join(', ');
      out += sel + '{' + r.style.cssText + '}\n';
    } else if (r.type === 4) { // CSSMediaRule
      out += '@media ' + r.conditionText + '{' + scopeRules(r.cssRules, name) + '}\n';
    } else {
      out += r.cssText + '\n';
    }
  }
  return out;
}

function scopeCss(text, name) {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    return scopeRules(sheet.cssRules, name);
  } catch (e) {
    return text;
  }
}

function ensureHelmet(def) {
  if (injected.has(def.name) || !def.helmet) return;
  injected.add(def.name);
  for (const el of Array.from(def.helmet.children)) {
    const tag = el.localName;
    if (tag === 'link') {
      const href = el.getAttribute('href');
      if (document.head.querySelector('link[href="' + CSS.escape(href) + '"]')) continue;
      const link = document.createElement('link');
      for (const a of Array.from(el.attributes)) link.setAttribute(a.name, a.value);
      document.head.appendChild(link);
    } else if (tag === 'style') {
      const style = document.createElement('style');
      style.setAttribute('data-dc-style', def.name);
      style.textContent = scopeCss(el.textContent, def.name);
      document.head.appendChild(style);
    }
  }
}

// ---------- valores ----------
function resolve(expr, scope) {
  const e = expr.trim();
  if (e === 'true') return true;
  if (e === 'false') return false;
  if (e === 'null') return null;
  if (e === 'undefined' || e === '') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (/^(['"]).*\1$/.test(e)) return e.slice(1, -1);
  let v = scope;
  for (const k of e.split('.')) {
    if (v === null || v === undefined) return undefined;
    v = v[k];
  }
  return v;
}

function interpolate(text, scope) {
  return text.replace(HOLE_ALL, (_, expr) => {
    const v = resolve(expr, scope);
    return v === null || v === undefined ? '' : String(v);
  });
}

function attrValue(value, scope) {
  const m = value.match(HOLE_ONLY);
  if (m) return resolve(m[1], scope);
  if (value.indexOf('{{') !== -1) return interpolate(value, scope);
  return value;
}

function propName(n) {
  if (n.length > 2 && n.startsWith('on')) return 'on' + n[2].toUpperCase() + n.slice(3);
  return n;
}

function camel(n) {
  return n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ---------- renderização ----------
function renderNodes(nodes, scope, def) {
  const out = [];
  for (const n of Array.from(nodes)) {
    const r = renderNode(n, scope, def);
    if (r === null || r === undefined) continue;
    if (Array.isArray(r)) out.push(...r); else out.push(r);
  }
  return out;
}

function renderNode(node, scope, def) {
  if (node.nodeType === 3) {
    const t = node.textContent;
    return t.indexOf('{{') === -1 ? t : interpolate(t, scope);
  }
  if (node.nodeType !== 1) return null;
  const tag = node.localName;

  if (tag === 'template') {
    const kind = node.getAttribute('data-sc');
    const children = node.content.childNodes;
    if (kind === 'for') {
      const list = attrValue(node.getAttribute('list') || '', scope) || [];
      const as = node.getAttribute('as') || 'item';
      return Array.from(list).map((item, i) =>
        h(Fragment, { key: i }, renderNodes(children, Object.assign({}, scope, { [as]: item, $index: i }), def)));
    }
    if (kind === 'if') {
      return attrValue(node.getAttribute('value') || '', scope) ? renderNodes(children, scope, def) : null;
    }
    return null;
  }

  if (tag === 'helmet') return null;

  if (tag === 'dc-import') {
    const target = node.getAttribute('name');
    const props = {};
    for (const a of Array.from(node.attributes)) {
      if (a.name === 'name' || a.name.startsWith('hint-')) continue;
      props[camel(a.name)] = attrValue(a.value, scope);
    }
    return h(getComponent(target), props);
  }

  const props = { 'data-dc': def.name };
  for (const a of Array.from(node.attributes)) {
    let v = attrValue(a.value, scope);
    if (v === '' && BOOL_ATTRS.has(a.name)) v = true;
    props[propName(a.name)] = v;
  }

  if (tag === 'a' && typeof props.href === 'string') {
    const href = props.href;
    const m = href.match(/([A-Za-z0-9_-]+)\.dc\.html$/);
    if (m) {
      const target = m[1];
      const orig = props.onClick;
      props.href = '#/' + target;
      props.onClick = (e) => {
        if (typeof orig === 'function') orig(e);
        e.preventDefault();
        navigateFn(target);
      };
    } else if (/^https?:/.test(href)) {
      props.target = '_blank';
      props.rel = 'noopener noreferrer';
    }
  }

  if (tag === 'textarea') return h(tag, props);
  return h(tag, props, ...renderNodes(node.childNodes, scope, def));
}

class DCLogic extends React.Component {
  constructor(props) {
    super(props);
    if (!this.state) this.state = {};
    ensureHelmet(this.__def);
  }
  render() {
    const vals = typeof this.renderVals === 'function' ? this.renderVals() : {};
    return h(Fragment, null, renderNodes(this.__def.nodes, vals || {}, this.__def));
  }
}

export function getComponent(name) {
  if (comps[name]) return comps[name];
  const def = getDef(name);
  let C;
  try {
    // eslint-disable-next-line no-new-func
    C = new Function('DCLogic', def.code + '\n;return Component;')(DCLogic);
  } catch (e) {
    console.error('Erro ao carregar a tela ' + name, e);
    C = class extends DCLogic { renderVals() { return {}; } };
  }
  C.prototype.__def = def;
  C.displayName = name;
  comps[name] = C;
  return C;
}
