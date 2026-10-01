/**
 * Extractor de comentarios que se instala como marcador (bookmarklet).
 *
 * `instagramCommentsExtractor` se ejecuta DENTRO de instagram.com, con la sesión del usuario,
 * así que no puede usar nada de este archivo ni de la app: todo lo que necesita está adentro.
 * La app convierte la función en un enlace `javascript:` para arrastrarlo a la barra de marcadores.
 *
 * Usa la API interna de la web de Instagram (la misma que usa la página para mostrar comentarios).
 * Si Instagram la cambia, este es el único archivo que hay que ajustar.
 */
function instagramCommentsExtractor() {
  const APP_ID = '936619743392459'; // ID público de la app web de Instagram
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const BASE = 'https://www.instagram.com/api/v1/';

  if (!/(^|\.)instagram\.com$/.test(location.hostname)) {
    alert('Abre primero la publicación en instagram.com y luego pulsa este marcador.');
    return;
  }
  const match = location.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) {
    alert('Abre la publicación del sorteo (la URL debe contener /p/ o /reel/) y vuelve a pulsar el marcador.');
    return;
  }
  if (window.__igSorteoExtractor) return;
  window.__igSorteoExtractor = true;

  const shortcode = match[1];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let cancelled = false;

  // ---------- Panel flotante ----------
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:330px;max-width:calc(100vw - 40px);'
    + 'background:#0b2416;color:#f2f8ef;border-radius:14px;padding:16px;font:14px/1.45 system-ui,sans-serif;'
    + 'box-shadow:0 10px 40px rgba(0,0,0,.5);border:2px solid #058c46';
  document.body.appendChild(box);

  const btnCss = 'border:none;border-radius:8px;padding:8px 12px;font:600 13px system-ui;cursor:pointer;margin:8px 6px 0 0;';
  function render(title, detail, buttons) {
    box.textContent = '';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;font-size:15px;margin-bottom:4px';
    h.textContent = '🏃 MMC26 · ' + title;
    const p = document.createElement('div');
    p.style.cssText = 'color:#b9d2bf;white-space:pre-line';
    p.textContent = detail;
    box.append(h, p);
    (buttons || []).forEach(([label, onClick, primary]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = btnCss + (primary ? 'background:linear-gradient(45deg,#0a9e50,#058c46,#006837);color:#fff' : 'background:#1d4a2e;color:#f2f8ef');
      b.onclick = onClick;
      box.appendChild(b);
    });
  }
  const close = () => { box.remove(); window.__igSorteoExtractor = false; };
  const cancelBtn = ['Cancelar', () => { cancelled = true; }];

  // ---------- API ----------
  const csrf = (document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) || [])[1] || '';
  async function api(path) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await fetch(BASE + path, {
        credentials: 'include',
        headers: { 'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrf },
      });
      if (res.status === 429) {
        const wait = 20 * attempt;
        render('Instagram pidió una pausa', `Esperando ${wait} s antes de continuar…`, [cancelBtn]);
        await sleep(wait * 1000);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('Instagram no autorizó la consulta. Asegúrate de haber iniciado sesión y recarga la página.');
      }
      if (!res.ok) {
        const err = new Error('Instagram respondió con error ' + res.status + '.');
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      if (json.status === 'fail') throw new Error(json.message || 'Instagram rechazó la consulta.');
      return json;
    }
    throw new Error('Instagram está limitando las consultas. Espera unos minutos e inténtalo de nuevo.');
  }

  /** Posibles IDs numéricos de la publicación: el que se deduce del código corto y el de la página. */
  function mediaIdCandidates() {
    const ids = [];
    let id = 0n;
    for (const ch of shortcode.slice(0, 11)) id = id * 64n + BigInt(ALPHABET.indexOf(ch));
    ids.push(id.toString());
    const meta = document.querySelector('meta[property="al:ios:url"], meta[property="al:android:url"]');
    const fromMeta = meta && (meta.content.match(/media\?id=(\d+)/) || [])[1];
    if (fromMeta) ids.push(fromMeta);
    return [...new Set(ids)];
  }

  const comments = [];
  const seen = new Set();
  function add(c, parentId) {
    if (!c || !c.user || !c.user.username) return false;
    const id = String(c.pk || c.id);
    if (seen.has(id)) return false;
    seen.add(id);
    comments.push({
      id,
      username: c.user.username,
      text: c.text || '',
      timestamp: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      parent_id: parentId || null,
    });
    return true;
  }

  function nextCursor(page, seenCursors) {
    const options = [['min_id', page.next_min_id], ['max_id', page.next_max_id]];
    for (const [param, value] of options) {
      if (value && !seenCursors.has(value)) { seenCursors.add(value); return `&${param}=${encodeURIComponent(value)}`; }
    }
    return null;
  }

  async function run() {
    const includeReplies = confirm('¿Incluir también las respuestas a los comentarios?\n\nAceptar = sí · Cancelar = sólo comentarios principales');
    render('Extrayendo comentarios…', 'Conectando con la publicación…', [cancelBtn]);

    const query = 'can_support_threading=true&permalink_enabled=false';
    let mediaId = null;
    let page = null;
    for (const id of mediaIdCandidates()) {
      try {
        page = await api(`media/${id}/comments/?${query}`);
        mediaId = id;
        break;
      } catch (e) {
        if (!e.status) throw e;
      }
    }
    if (!mediaId) throw new Error('No se pudo leer esta publicación. Recarga la página de la publicación y vuelve a intentarlo.');

    const owner = page.caption && page.caption.user ? page.caption.user.username : null;
    const total = page.comment_count || null;
    const threads = [];
    const cursors = new Set();

    while (page && !cancelled) {
      let added = 0;
      for (const c of page.comments || []) {
        if (add(c)) added++;
        const previews = c.preview_child_comments || [];
        if (includeReplies) {
          previews.forEach((r) => add(r, String(c.pk)));
          if ((c.child_comment_count || 0) > previews.length) threads.push(String(c.pk));
        }
      }
      render('Extrayendo comentarios…', `${comments.length}${total ? ' de ~' + total : ''} comentarios leídos`, [cancelBtn]);
      const cursor = nextCursor(page, cursors);
      if (!cursor || added === 0) break;
      await sleep(700 + Math.random() * 600);
      page = await api(`media/${mediaId}/comments/?${query}${cursor}`);
    }

    for (let i = 0; i < threads.length && !cancelled; i++) {
      const tCursors = new Set();
      let cursor = '';
      while (!cancelled) {
        render('Extrayendo respuestas…', `Hilo ${i + 1} de ${threads.length}\n${comments.length} comentarios en total`, [cancelBtn]);
        await sleep(600 + Math.random() * 500);
        const r = await api(`media/${mediaId}/comments/${threads[i]}/child_comments/?${cursor.slice(1)}`);
        let added = 0;
        for (const c of r.child_comments || []) if (add(c, threads[i])) added++;
        const more = r.has_more_tail_child_comments || r.has_more_head_child_comments;
        cursor = more ? nextCursor(r, tCursors) : null;
        if (!cursor || added === 0) break;
      }
    }

    return {
      source: 'sorteos-instagram-extractor',
      version: 1,
      shortcode,
      permalink: `https://www.instagram.com/p/${shortcode}/`,
      post_owner: owner,
      extracted_at: new Date().toISOString(),
      incomplete: cancelled,
      replies_included: includeReplies,
      comments,
    };
  }

  run().then((result) => {
    const json = JSON.stringify(result);
    const users = new Set(result.comments.map((c) => c.username)).size;
    const download = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `comentarios-${result.shortcode}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
    const copy = async (ev) => {
      const btn = ev.target;
      try {
        await navigator.clipboard.writeText(json);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = json;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.textContent = '✔ Copiado';
    };
    render(
      result.incomplete ? 'Extracción detenida' : '¡Listo!',
      `${result.comments.length} comentarios de ${users} personas.\nCópialos y pégalos en la app de sorteos MMC26 (pestaña “Extractor automático”), o descarga el archivo.`,
      [['📋 Copiar resultado', copy, true], ['⬇ Descargar', download], ['Cerrar', close]],
    );
  }).catch((e) => {
    render('No se pudo extraer', e.message + '\n\nAlternativa: copia y pega los comentarios a mano en la app.', [['Cerrar', close]]);
  });
}

const Bookmarklet = {
  href: 'javascript:' + encodeURIComponent('(' + instagramCommentsExtractor.toString() + ')();void 0'),
};

if (typeof module !== 'undefined') module.exports = { instagramCommentsExtractor, Bookmarklet };
