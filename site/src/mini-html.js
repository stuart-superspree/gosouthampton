// A tiny, script-free HTML reader for source "recipes". It builds a plain tree
// (never a live DOM), so imported markup cannot run scripts or load anything.
// Supported selectors: tag, .class, tag.class, descendant chains ("a b"),
// "@attr" to read an attribute, and a trailing "*" to collect all matches.
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP = new Set(['script', 'style', 'template', 'iframe', 'object', 'noscript']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  let m;
  let skipUntil = null;
  while ((m = re.exec(html))) {
    const [token, tagName, attrText, selfClose, text] = m;
    if (token.startsWith('<!--')) continue;
    if (skipUntil) {
      if (tagName && token.startsWith('</') && tagName.toLowerCase() === skipUntil) skipUntil = null;
      continue;
    }
    if (text !== undefined) { cur.children.push({ text: decodeEntities(text) }); continue; }
    if (!tagName) { cur.children.push({ text: '<' }); continue; }
    const tag = tagName.toLowerCase();
    if (token.startsWith('</')) {
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent;
      continue;
    }
    if (SKIP.has(tag)) { skipUntil = tag; continue; }
    const attrs = {};
    (attrText || '').replace(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g, (_, k, a, b, c) => {
      attrs[k.toLowerCase()] = decodeEntities(a ?? b ?? c ?? '');
      return '';
    });
    const node = { tag, attrs, children: [], parent: cur };
    cur.children.push(node);
    if (!VOID.has(tag) && !selfClose) cur = node;
  }
  return root;
}

export function textOf(node) {
  if (node.text !== undefined) return node.text;
  return node.children.map(textOf).join('');
}

function matchesSimple(node, simple) {
  if (!node.tag || node.tag === '#root') return false;
  const [tag, ...classes] = simple.split('.');
  if (tag && tag !== '*' && node.tag !== tag.toLowerCase()) return false;
  if (classes.length) {
    const have = (node.attrs.class || '').split(/\s+/);
    if (!classes.every((c) => have.includes(c))) return false;
  }
  return true;
}

function descendants(node, out = []) {
  for (const c of node.children || []) {
    if (c.tag) { out.push(c); descendants(c, out); }
  }
  return out;
}

export function selectAll(root, selector) {
  const parts = selector.trim().split(/\s+/);
  let nodes = [root];
  for (const part of parts) {
    const next = [];
    for (const n of nodes) for (const d of descendants(n)) if (matchesSimple(d, part) && !next.includes(d)) next.push(d);
    nodes = next;
  }
  return nodes;
}

// Read a field with a recipe selector like ".title", "a@href" or "ul.access li*".
export function readField(node, selector) {
  let sel = selector.trim();
  const all = sel.endsWith('*');
  if (all) sel = sel.slice(0, -1).trim();
  let attr = null;
  const at = sel.lastIndexOf('@');
  if (at >= 0) { attr = sel.slice(at + 1); sel = sel.slice(0, at).trim(); }
  const found = sel ? selectAll(node, sel) : [node];
  const val = (n) => (attr ? (n.attrs[attr.toLowerCase()] ?? '') : textOf(n)).replace(/\s+/g, ' ').trim();
  if (all) return found.map(val).filter(Boolean);
  return found.length ? val(found[0]) : '';
}
