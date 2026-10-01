/**
 * Cliente mínimo de la API de Instagram (Graph API de Meta) que corre en el navegador.
 * Soporta tokens de "Instagram API con inicio de sesión de Instagram" (empiezan por IG)
 * y tokens de la Graph API de Facebook con una página vinculada a una cuenta profesional.
 */
const InstagramApi = (() => {
  const VERSION = 'v21.0';

  const isIgToken = (token) => /^IG/.test(token);
  const baseUrl = (token) => (isIgToken(token) ? `https://graph.instagram.com/${VERSION}` : `https://graph.facebook.com/${VERSION}`);

  async function get(url) {
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error('No se pudo conectar con Meta. Revisa tu conexión a internet.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const msg = json.error ? json.error.message : `Error HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  }

  function withToken(url, token) {
    return url + (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
  }

  /** Cuentas de Instagram accesibles con el token: [{ id, username }] */
  async function listAccounts(token) {
    const base = baseUrl(token);
    if (isIgToken(token)) {
      const me = await get(withToken(`${base}/me?fields=user_id,username`, token));
      return [{ id: me.user_id || me.id, username: me.username }];
    }
    const pages = await get(withToken(`${base}/me/accounts?fields=name,instagram_business_account{id,username}&limit=100`, token));
    return (pages.data || [])
      .filter((p) => p.instagram_business_account)
      .map((p) => ({ id: p.instagram_business_account.id, username: p.instagram_business_account.username || p.name }));
  }

  /** Últimas publicaciones de la cuenta (hasta 100). */
  async function listMedia(token, igUserId) {
    const fields = 'id,caption,permalink,timestamp,comments_count,media_type,media_url,thumbnail_url';
    let url = withToken(`${baseUrl(token)}/${igUserId}/media?fields=${fields}&limit=50`, token);
    const all = [];
    while (url && all.length < 100) {
      const page = await get(url);
      all.push(...(page.data || []));
      url = page.paging && page.paging.next;
    }
    return all;
  }

  /**
   * Descarga todos los comentarios de una publicación, recorriendo la paginación.
   * Devuelve [{ username, text, timestamp }]
   */
  async function fetchComments(token, mediaId, { includeReplies = true, onProgress } = {}) {
    const fields = 'id,username,text,timestamp' + (includeReplies ? ',replies.limit(50){id,username,text,timestamp}' : '');
    let url = withToken(`${baseUrl(token)}/${mediaId}/comments?fields=${encodeURIComponent(fields)}&limit=50`, token);
    const out = [];
    while (url) {
      const page = await get(url);
      for (const c of page.data || []) {
        if (c.username) out.push({ username: c.username, text: c.text || '', timestamp: c.timestamp });
        if (includeReplies && c.replies && c.replies.data) {
          for (const r of c.replies.data) {
            if (r.username) out.push({ username: r.username, text: r.text || '', timestamp: r.timestamp });
          }
        }
      }
      if (onProgress) onProgress(out.length);
      url = page.paging && page.paging.next;
    }
    return out;
  }

  /** Extrae el código corto de una URL de Instagram (/p/CODE/, /reel/CODE/). */
  function shortcodeFromUrl(url) {
    const m = String(url || '').match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  return { listAccounts, listMedia, fetchComments, shortcodeFromUrl };
})();
