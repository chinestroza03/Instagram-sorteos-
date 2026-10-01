/**
 * Extracción de participantes a partir de texto o archivos.
 * Todas las funciones devuelven una lista de comentarios: [{ username, text }]
 */
const Parser = (() => {
  const USERNAME_RE = /^[a-z0-9._]{1,30}$/;
  const MENTION_RE = /@([a-zA-Z0-9._]{1,30})/g;

  // Fragmentos de interfaz de Instagram que aparecen al copiar comentarios (ES / EN / PT).
  const UI_FRAGMENTS = [
    /\b(hace\s+)?\d+\s*(s|seg|segundos?|min|minutos?|m|h|hr|horas?|hours?|d|días?|dias?|days?|sem|semanas?|w|weeks?|mes(es)?|months?|a|años?|y|years?)\b\.?/gi,
    /\b\d[\d.,]*\s*(mil\s+)?(me gusta|likes?|curtidas?|respuestas?|replies)\b/gi,
    /\b(responder|reply|responder a|ver traducción|ver traduccion|see translation|ver tradução|editado|edited|fijado|pinned|autor|author|creador|creator|verificado|verified|seguir|follow|siguiendo|following|me gusta|like|curtir|enviar|send|más|more|ver más|see more)\b/gi,
    /[·•—–\-|]+/g,
  ];
  const UI_LINES = [
    /^(ver|ocultar|view|hide|ver todas las|view all)\s+.*(respuestas?|replies|comentarios|comments)/i,
    /^(cargar|load|ver|view)\s+(más|more)\s+(comentarios|comments)/i,
    /^(agrega|añade|add)\s+(un\s+)?(comentario|comment)/i,
    /^(publicar|post)$/i,
    /^(original audio|audio original)/i,
  ];

  function isUiNoise(line) {
    // Separa textos pegados al copiar ("1 sem12 Me gustaResponder" → "1 sem 12 Me gusta Responder")
    let rest = line
      .replace(/([a-záéíóúñ])(\d)/gi, '$1 $2')
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2');
    const bare = rest.replace(/^[\s·•—–\-|]+/, '');
    if (UI_LINES.some((re) => re.test(bare))) return true;
    for (const re of UI_FRAGMENTS) rest = rest.replace(re, ' ');
    return rest.trim() === '';
  }

  /** Normaliza un posible nombre de usuario. Devuelve null si no lo parece. */
  function asUsername(raw) {
    if (!raw) return null;
    let s = raw.trim().replace(/^@/, '');
    // Quita etiquetas que acompañan al usuario ("usuario Verificado", "usuario · Autor").
    s = s.replace(/\s*[·•]?\s*(verificado|verified|autor|author|creador|creator)\s*$/i, '').trim();
    s = s.toLowerCase();
    if (!USERNAME_RE.test(s)) return null;
    if (/^[\d.]+$/.test(s)) return null; // sólo números o puntos: no es un usuario
    if (/^\.|\.$|\.\./.test(s)) return null; // Instagram no permite estos patrones
    return s;
  }

  /**
   * Interpreta el texto copiado de una publicación de Instagram.
   * Cada línea con forma de usuario inicia un comentario; las líneas siguientes son su texto.
   * Una línea con forma de usuario justo después de un autor se toma como texto
   * (comentarios de una sola palabra como "participo").
   */
  function parseInstagramComments(text) {
    const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out = [];
    let current = null;

    const flush = () => {
      if (current) out.push({ username: current.username, text: current.lines.join(' ').trim() });
      current = null;
    };

    for (const line of lines) {
      // Formato "usuario: comentario" (exportaciones / copias desde el móvil)
      const colon = line.match(/^@?([A-Za-z0-9._]{1,30}):\s+(.+)$/);
      if (colon && asUsername(colon[1])) {
        flush();
        out.push({ username: asUsername(colon[1]), text: colon[2].trim() });
        continue;
      }

      const user = asUsername(line);
      if (user && !isUiNoise(line) && !(current && current.lines.length === 0)) {
        flush();
        current = { username: user, lines: [] };
        continue;
      }

      if (isUiNoise(line)) continue;
      if (current) current.lines.push(line);
    }
    flush();
    return out;
  }

  /** Lista simple de usuarios: uno por línea, o separados por comas / espacios. */
  function parseUserList(text) {
    const out = [];
    for (const token of String(text).split(/[\s,;]+/)) {
      const u = asUsername(token);
      if (u) out.push({ username: u, text: '' });
    }
    return out;
  }

  /** Todas las @menciones encontradas en el texto. */
  function parseMentions(text) {
    const out = [];
    for (const m of String(text).matchAll(MENTION_RE)) {
      const u = asUsername(m[1]);
      if (u) out.push({ username: u, text: '' });
    }
    return out;
  }

  /** Menciones distintas dentro de un texto (en minúsculas). */
  function mentionsIn(text) {
    const set = new Set();
    for (const m of String(text || '').matchAll(MENTION_RE)) {
      const u = asUsername(m[1]);
      if (u) set.add(u);
    }
    return set;
  }

  // ---------- Archivos ----------

  const USER_KEYS = ['username', 'user', 'usuario', 'user_name', 'autor', 'author', 'owner', 'ownerusername', 'from', 'handle', 'name', 'nombre', 'profile'];
  const TEXT_KEYS = ['text', 'comment', 'comentario', 'message', 'mensaje', 'content', 'body', 'texto'];

  function pickField(obj, keys) {
    const lower = {};
    for (const k of Object.keys(obj)) lower[k.toLowerCase().replace(/[\s-]/g, '_')] = obj[k];
    for (const k of keys) {
      const v = lower[k];
      if (v == null) continue;
      if (typeof v === 'object') {
        const nested = v.username || v.name || v.user_name;
        if (nested) return String(nested);
        continue;
      }
      return String(v);
    }
    return null;
  }

  function fromJson(data) {
    const out = [];
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') {
        if (typeof node === 'string') {
          const u = asUsername(node);
          if (u) out.push({ username: u, text: '' });
        }
        return;
      }
      const u = asUsername(pickField(node, USER_KEYS) || '');
      if (u) out.push({ username: u, text: pickField(node, TEXT_KEYS) || '' });
      // Respuestas anidadas (formato Graph API) y envoltorios { data: [...] }
      if (node.data) visit(node.data);
      if (node.replies) visit(node.replies.data || node.replies);
      if (node.comments) visit(node.comments.data || node.comments);
    };
    visit(data);
    return out;
  }

  /** Parser CSV mínimo con soporte de comillas. Detecta separador , ; o tabulador. */
  function parseCsvRows(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const sep = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === sep) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
  }

  function fromCsv(text) {
    const rows = parseCsvRows(text.replace(/^﻿/, ''));
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]/g, '_'));
    const find = (keys, partial) => {
      const exact = header.findIndex((h) => keys.includes(h));
      return exact >= 0 ? exact : header.findIndex((h) => partial.test(h) && !/(^|_)(id|url|link|pic|avatar|image)($|_)/.test(h));
    };
    const ui = find(USER_KEYS, /user|usuario|autor|author|handle|owner/);
    const ti = find(TEXT_KEYS, /text|coment|comment|message|mensaje/);
    if (ui === -1) {
      // Sin encabezado reconocible: primera columna = usuario, segunda = texto.
      return rows.map((r) => ({ username: asUsername(r[0] || ''), text: r[1] || '' })).filter((c) => c.username);
    }
    return rows.slice(1)
      .map((r) => ({ username: asUsername(r[ui] || ''), text: ti >= 0 ? r[ti] || '' : '' }))
      .filter((c) => c.username);
  }

  function parseFile(name, content) {
    const lower = name.toLowerCase();
    const trimmed = content.trim();
    if (lower.endsWith('.json') || /^[[{]/.test(trimmed)) {
      return fromJson(JSON.parse(trimmed));
    }
    if (lower.endsWith('.csv')) return fromCsv(content);
    // .txt: intenta como comentarios copiados; si no encuentra nada, como lista.
    const comments = parseInstagramComments(content);
    return comments.length ? comments : parseUserList(content);
  }

  return { parseInstagramComments, parseUserList, parseMentions, parseFile, mentionsIn, asUsername };
})();

if (typeof module !== 'undefined') module.exports = Parser;
