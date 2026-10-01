(() => {
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    comments: [], // [{ username, text }]
    disabled: new Set(), // usuarios excluidos a mano
    view: [], // participantes calculados
    result: null,
  };

  // ---------- Pestañas ----------
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
    });
  });

  function setHint(el, msg, kind = '') {
    el.textContent = msg;
    el.className = `hint ${kind}`;
  }

  function addComments(list, hintEl, sourceLabel) {
    if (!list.length) {
      setHint(hintEl, 'No se encontraron usuarios. Revisa el formato elegido.', 'error');
      return;
    }
    state.comments.push(...list);
    const users = new Set(list.map((c) => c.username)).size;
    setHint(hintEl, `✔ ${sourceLabel}: ${list.length} comentario(s) de ${users} usuario(s) agregados.`, 'ok');
    refresh();
    $('step-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Toma la URL y la cuenta dueña del resultado del extractor para rellenar los datos del sorteo. */
  function applyExtractorMeta(data) {
    if (!data || data.source !== 'sorteos-instagram-extractor') return '';
    if (data.permalink && !$('postUrl').value) $('postUrl').value = data.permalink;
    const notes = [];
    if (data.post_owner) {
      if (!$('organizer').value) $('organizer').value = '@' + data.post_owner;
      if (!$('fExclude').value) {
        $('fExclude').value = '@' + data.post_owner;
        notes.push(`se excluyó a @${data.post_owner} (dueño de la publicación)`);
      }
    }
    if (data.incomplete) notes.push('⚠ la extracción se detuvo antes de terminar');
    return notes.length ? ` (${notes.join('; ')})` : '';
  }

  /** Carga texto JSON (del extractor, la API o una exportación). Devuelve false si no es JSON. */
  function importJsonText(text, hintEl, label) {
    const trimmed = text.trim();
    if (!/^[[{]/.test(trimmed)) return false;
    let data;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      setHint(hintEl, 'El texto parece JSON pero está incompleto. Vuelve a copiar el resultado completo.', 'error');
      return true;
    }
    const note = applyExtractorMeta(data);
    addComments(Parser.parseFile('resultado.json', trimmed), hintEl, label);
    if (note && hintEl.classList.contains('ok')) hintEl.textContent += note;
    return true;
  }

  // ---------- Extractor automático (bookmarklet) ----------
  const bm = $('bookmarklet');
  bm.href = Bookmarklet.href;
  bm.addEventListener('click', (e) => {
    e.preventDefault();
    setHint($('autoHint'), 'No lo pulses aquí: arrástralo a la barra de marcadores y úsalo en la publicación de Instagram.', 'error');
  });

  $('btnCopyBookmarklet').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(Bookmarklet.href);
      $('btnCopyBookmarklet').textContent = '✔ Código copiado';
    } catch {
      prompt('Copia este código y pégalo como URL del marcador:', Bookmarklet.href);
    }
    setTimeout(() => { $('btnCopyBookmarklet').textContent = 'Copiar código'; }, 2000);
  });

  function loadAuto() {
    const text = $('autoInput').value;
    if (!text.trim()) return setHint($('autoHint'), 'Pega primero el resultado del extractor.', 'error');
    if (!importJsonText(text, $('autoHint'), 'Extractor')) {
      setHint($('autoHint'), 'Esto no parece el resultado del extractor. Para texto copiado de Instagram usa la pestaña “Pegar comentarios”.', 'error');
      return;
    }
    if ($('autoHint').classList.contains('ok')) $('autoInput').value = '';
  }
  $('btnAutoLoad').addEventListener('click', loadAuto);
  $('btnAutoClipboard').addEventListener('click', async () => {
    try {
      $('autoInput').value = await navigator.clipboard.readText();
    } catch {
      setHint($('autoHint'), 'El navegador no permitió leer el portapapeles. Pega con Ctrl+V en el recuadro.', 'error');
      $('autoInput').focus();
      return;
    }
    loadAuto();
  });

  // ---------- Pegar ----------
  $('btnExtract').addEventListener('click', () => {
    const text = $('pasteInput').value;
    if (importJsonText(text, $('pasteHint'), 'JSON pegado')) return;
    const mode = $('pasteMode').value;
    const list = mode === 'list' ? Parser.parseUserList(text)
      : mode === 'mentions' ? Parser.parseMentions(text)
        : Parser.parseInstagramComments(text);
    addComments(list, $('pasteHint'), 'Texto pegado');
  });

  $('btnSample').addEventListener('click', () => {
    const names = ['laura.mtz', 'carlos_rdz', 'sofi.travels', 'juanpa_92', 'vale.fit', 'andres.dev', 'mafe_art', 'dani.coffee',
      'pipe.music', 'cata_rojas', 'nico.photo', 'luisa.bakes', 'tomas_gamer', 'isa.yoga', 'mateo.surf', 'pau_lectora'];
    const pick = () => names[Math.floor(Math.random() * names.length)];
    const lines = [];
    names.forEach((n, i) => {
      lines.push(n, `¡Participo! @${pick()} @${pick()} 🙌`, `${(i % 6) + 1} sem`, `${i * 3} Me gusta`, 'Responder');
      if (i % 4 === 0) lines.push(n, `Otra vez yo, suerte a todos @${pick()}`, '2 d', 'Responder');
    });
    $('pasteMode').value = 'comments';
    $('pasteInput').value = lines.join('\n');
  });

  // ---------- Archivos ----------
  async function handleFiles(files) {
    let all = [];
    for (const f of files) {
      try {
        const content = await f.text();
        if (/^\s*[[{]/.test(content)) { try { applyExtractorMeta(JSON.parse(content)); } catch { /* lo reporta parseFile */ } }
        all = all.concat(Parser.parseFile(f.name, content));
      } catch (e) {
        setHint($('fileHint'), `Error leyendo ${f.name}: ${e.message}`, 'error');
        return;
      }
    }
    addComments(all, $('fileHint'), files.length > 1 ? `${files.length} archivos` : files[0].name);
  }
  $('fileInput').addEventListener('change', (e) => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ''; });
  const dz = $('dropzone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });

  // ---------- API ----------
  let selectedMedia = null;
  $('btnApiConnect').addEventListener('click', async () => {
    const token = $('apiToken').value.trim();
    if (!token) return setHint($('apiHint'), 'Pega un token de acceso.', 'error');
    setHint($('apiHint'), 'Conectando…');
    try {
      const accounts = await InstagramApi.listAccounts(token);
      if (!accounts.length) throw new Error('El token no tiene cuentas profesionales de Instagram vinculadas.');
      $('apiAccount').innerHTML = accounts.map((a) => `<option value="${esc(a.id)}">@${esc(a.username)}</option>`).join('');
      $('apiAccountRow').classList.remove('hidden');
      setHint($('apiHint'), `✔ ${accounts.length} cuenta(s) encontrada(s).`, 'ok');
      if (!$('organizer').value) $('organizer').value = '@' + accounts[0].username;
      if (accounts.length === 1) $('btnApiMedia').click();
    } catch (e) {
      setHint($('apiHint'), `Error: ${e.message}`, 'error');
    }
  });

  $('btnApiMedia').addEventListener('click', async () => {
    const token = $('apiToken').value.trim();
    setHint($('apiHint'), 'Cargando publicaciones…');
    try {
      const media = await InstagramApi.listMedia(token, $('apiAccount').value);
      const wanted = InstagramApi.shortcodeFromUrl($('postUrl').value);
      const grid = $('apiMedia');
      grid.innerHTML = '';
      selectedMedia = null;
      $('btnApiComments').disabled = true;
      media.forEach((m) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'media-item';
        const img = m.thumbnail_url || (m.media_type !== 'VIDEO' ? m.media_url : '');
        btn.innerHTML = `${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<img alt="">'}
          <div>💬 ${m.comments_count ?? '?'} · ${esc((m.caption || '').slice(0, 40)) || 'Sin texto'}</div>`;
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.media-item').forEach((el) => el.classList.remove('selected'));
          btn.classList.add('selected');
          selectedMedia = m;
          $('btnApiComments').disabled = false;
          if (m.permalink) $('postUrl').value = m.permalink;
        });
        grid.appendChild(btn);
        if (wanted && m.permalink && m.permalink.includes(`/${wanted}`)) btn.click();
      });
      $('apiMediaRow').classList.remove('hidden');
      setHint($('apiHint'), `${media.length} publicaciones.`, 'ok');
    } catch (e) {
      setHint($('apiHint'), `Error: ${e.message}`, 'error');
    }
  });

  $('btnApiComments').addEventListener('click', async () => {
    if (!selectedMedia) return;
    const btn = $('btnApiComments');
    btn.disabled = true;
    try {
      const comments = await InstagramApi.fetchComments($('apiToken').value.trim(), selectedMedia.id, {
        includeReplies: $('apiReplies').checked,
        onProgress: (n) => setHint($('apiHint'), `Descargando… ${n} comentarios`),
      });
      const list = comments.map((c) => ({ username: Parser.asUsername(c.username), text: c.text })).filter((c) => c.username);
      addComments(list, $('apiHint'), 'API');
    } catch (e) {
      setHint($('apiHint'), `Error: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Participantes y reglas ----------
  function readFilters() {
    const exclude = new Set(($('fExclude').value.match(/[A-Za-z0-9._]+/g) || []).map((u) => u.toLowerCase()));
    return {
      exclude,
      minMentions: Math.max(0, parseInt($('fMinMentions').value, 10) || 0),
      keyword: $('fKeyword').value.trim().toLowerCase(),
      entries: $('fEntries').value,
    };
  }

  function describeRules(f) {
    const rules = [];
    if (f.exclude.size) rules.push(`Excluidas: ${[...f.exclude].map((u) => '@' + u).join(', ')}`);
    if (f.minMentions) rules.push(`Mínimo ${f.minMentions} amigo(s) etiquetado(s)`);
    if (f.keyword) rules.push(`Debe incluir "${f.keyword}"`);
    if (state.disabled.size) rules.push(`${state.disabled.size} participante(s) excluido(s) manualmente`);
    return rules;
  }

  function computeParticipants() {
    const f = readFilters();
    const map = new Map();
    for (const c of state.comments) {
      let p = map.get(c.username);
      if (!p) { p = { username: c.username, texts: [], mentions: new Set() }; map.set(c.username, p); }
      p.texts.push(c.text || '');
      Parser.mentionsIn(c.text).forEach((m) => { if (m !== c.username) p.mentions.add(m); });
    }
    const list = [...map.values()];
    for (const p of list) {
      p.reason = '';
      if (f.exclude.has(p.username)) p.reason = 'Cuenta excluida';
      else if (p.mentions.size < f.minMentions) p.reason = `Etiquetó ${p.mentions.size} de ${f.minMentions}`;
      else if (f.keyword && !p.texts.some((t) => t.toLowerCase().includes(f.keyword))) p.reason = 'Falta palabra clave';
      p.manualOff = state.disabled.has(p.username);
      p.eligible = !p.reason && !p.manualOff;
      p.tickets = p.eligible ? (f.entries === 'per-comment' ? p.texts.length : 1) : 0;
    }
    return { list, filters: f };
  }

  function eligiblePool() {
    return state.view.filter((p) => p.eligible).map((p) => ({ username: p.username, tickets: p.tickets }));
  }

  function refresh() {
    const { list, filters } = computeParticipants();
    state.view = list;
    const eligible = list.filter((p) => p.eligible);
    $('statComments').textContent = state.comments.length;
    $('statUsers').textContent = list.length;
    $('statEligible').textContent = eligible.length;
    $('statTickets').textContent = eligible.reduce((s, p) => s + p.tickets, 0);

    const hasText = state.comments.some((c) => c.text);
    $('filterNote').textContent = state.comments.length && !hasText && (filters.minMentions || filters.keyword)
      ? '⚠ Los datos cargados no tienen texto de comentario, por eso las reglas de etiquetas y palabra clave dejan a todos fuera.'
      : '';
    renderTable();
  }

  function renderTable() {
    const q = $('search').value.trim().toLowerCase().replace(/^@/, '');
    const rows = state.view.filter((p) => !q || p.username.includes(q));
    const tbody = $('ptbody');
    if (!state.view.length) {
      tbody.innerHTML = '<tr class="empty"><td colspan="6">Aún no hay participantes. Cárgalos en el paso 2.</td></tr>';
      return;
    }
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty"><td colspan="6">Ningún usuario coincide con la búsqueda.</td></tr>';
      return;
    }
    // Limita el render a 1000 filas para listas enormes; la búsqueda permite llegar a cualquiera.
    const shown = rows.slice(0, 1000);
    tbody.innerHTML = shown.map((p, i) => {
      const sample = p.texts.find(Boolean) || '';
      const status = p.eligible ? '<span class="pill ok">Válido</span>'
        : `<span class="pill bad">${esc(p.manualOff && !p.reason ? 'Excluido a mano' : p.reason)}</span>`;
      return `<tr class="${p.eligible ? '' : 'off'}">
        <td>${i + 1}</td>
        <td class="user">@${esc(p.username)}${sample ? `<small title="${esc(sample)}">${esc(sample)}</small>` : ''}</td>
        <td class="num">${p.texts.length}</td>
        <td class="num">${p.mentions.size}</td>
        <td>${status}</td>
        <td class="num"><input type="checkbox" data-user="${esc(p.username)}" ${p.manualOff ? '' : 'checked'} aria-label="Incluir @${esc(p.username)}"></td>
      </tr>`;
    }).join('') + (rows.length > shown.length ? `<tr class="empty"><td colspan="6">… y ${rows.length - shown.length} más. Usa el buscador.</td></tr>` : '');
  }

  $('ptbody').addEventListener('change', (e) => {
    const u = e.target.dataset.user;
    if (!u) return;
    if (e.target.checked) state.disabled.delete(u); else state.disabled.add(u);
    refresh();
  });
  ['fExclude', 'fMinMentions', 'fKeyword', 'fEntries'].forEach((id) => $(id).addEventListener('input', refresh));
  $('search').addEventListener('input', renderTable);

  $('btnClear').addEventListener('click', () => {
    if (state.comments.length && !confirm('¿Vaciar la lista de participantes?')) return;
    state.comments = [];
    state.disabled.clear();
    refresh();
  });

  $('btnCsv').addEventListener('click', () => {
    if (!state.view.length) return;
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = ['usuario,comentarios,etiquetas,valido,oportunidades,motivo'];
    state.view.forEach((p) => lines.push([q(p.username), p.texts.length, p.mentions.size, p.eligible ? 'si' : 'no', p.tickets, q(p.reason || (p.manualOff ? 'Excluido a mano' : ''))].join(',')));
    download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'participantes.csv');
  });

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Sorteo ----------
  $('suspense').addEventListener('input', () => { $('suspenseLabel').textContent = `${$('suspense').value} s`; });

  const confettiFire = (() => {
    if (!window.confetti) return () => {};
    const fire = window.confetti.create($('confettiCanvas'), { resize: true, useWorker: false });
    return (big) => {
      const colors = ['#fdcf58', '#fd5949', '#d6249f', '#833ab4', '#ffffff'];
      fire({ particleCount: big ? 220 : 120, spread: big ? 120 : 80, origin: { y: 0.55 }, colors, startVelocity: 45 });
      if (big) {
        setTimeout(() => fire({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors }), 250);
        setTimeout(() => fire({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors }), 400);
      }
    };
  })();

  function waitClick(btn) {
    return new Promise((resolve) => {
      btn.classList.remove('hidden');
      btn.focus();
      btn.addEventListener('click', () => { btn.classList.add('hidden'); resolve(); }, { once: true });
    });
  }

  async function countdown(sound) {
    const el = $('countdown');
    const reel = $('reel');
    reel.classList.add('hidden');
    el.classList.remove('hidden');
    for (const n of [3, 2, 1]) {
      el.textContent = n;
      el.style.animation = 'none';
      void el.offsetWidth; // reinicia la animación
      el.style.animation = '';
      if (sound) Draw.sounds.beat();
      await sleep(900);
    }
    el.classList.add('hidden');
    reel.classList.remove('hidden');
  }

  /** Ruleta de nombres que se va frenando hasta caer en el ganador. */
  async function spin(names, winner, seconds, sound) {
    const reel = $('reel');
    const nameEl = $('reelName');
    reel.className = 'reel spinning';
    const total = seconds * 1000;
    const start = performance.now();
    let last = '';
    while (true) {
      const t = (performance.now() - start) / total;
      if (t >= 1) break;
      last = Draw.randomName(names, last);
      nameEl.textContent = '@' + last;
      if (t > 0.65) reel.classList.add('tense');
      $('stageSub').textContent = t < 0.4 ? 'Mezclando participantes…' : t < 0.8 ? 'Se está frenando…' : '¡Casi!';
      if (sound) Draw.sounds.tick(t);
      await sleep(35 + 520 * Math.pow(t, 3)); // cada vez más lento
    }
    await sleep(350);
    nameEl.textContent = '@' + winner;
    reel.className = 'reel revealed';
    if (sound) Draw.sounds.win();
  }

  $('btnDraw').addEventListener('click', async () => {
    const hint = $('drawHint');
    const pool = eligiblePool();
    const nW = parseInt($('nWinners').value, 10);
    const nA = Math.max(0, parseInt($('nAlternates').value, 10) || 0);
    if (!pool.length) return setHint(hint, 'No hay participantes válidos. Carga la lista en el paso 2.', 'error');
    if (!(nW >= 1)) return setHint(hint, 'Indica al menos 1 ganador.', 'error');
    if (nW + nA > pool.length) {
      return setHint(hint, `Pides ${nW + nA} personas (ganadores + suplentes) pero sólo hay ${pool.length} participantes válidos.`, 'error');
    }
    setHint(hint, '');

    const sound = $('sound').checked;
    if (sound) Draw.sounds.unlock();
    const seconds = parseInt($('suspense').value, 10);
    const { filters } = computeParticipants();
    const date = new Date();
    const canonical = pool.map((p) => `${p.username}:${p.tickets}`).sort().join('\n');
    const fingerprint = await Draw.fingerprint(canonical);
    const picks = Draw.pickWinners(pool, nW + nA);
    const names = pool.map((p) => p.username);

    // Pantalla de sorteo
    const overlay = $('overlay');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    $('stageWinners').innerHTML = '';
    $('reelName').textContent = '@…';
    $('reel').className = 'reel';

    for (let i = 0; i < picks.length; i++) {
      const isAlt = i >= nW;
      const label = isAlt ? `Suplente #${i - nW + 1}` : nW > 1 ? `Ganador #${i + 1} de ${nW}` : 'Ganador';
      $('stageLabel').textContent = label;
      $('stageSub').innerHTML = '&nbsp;';
      if (i === 0) await countdown(sound);
      // Los suplentes van más rápido para no alargar demasiado.
      await spin(names.filter((n) => !picks.slice(0, i).some((p) => p.username === n)), picks[i].username, isAlt ? Math.max(2, Math.round(seconds / 2)) : seconds, sound);
      $('stageSub').textContent = isAlt ? 'Suplente seleccionado' : '🎉 ¡Felicidades! 🎉';
      confettiFire(!isAlt);
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `<b>${isAlt ? 'S' + (i - nW + 1) : i + 1}</b>@${esc(picks[i].username)}`;
      $('stageWinners').appendChild(chip);
      if (i < picks.length - 1) {
        $('btnNext').textContent = i + 1 < nW ? `Siguiente ganador ➜` : 'Sortear suplentes ➜';
        await waitClick($('btnNext'));
      }
    }

    state.result = {
      prize: $('prize').value.trim(),
      organizer: $('organizer').value.trim(),
      postUrl: $('postUrl').value.trim(),
      date,
      winners: picks.slice(0, nW),
      alternates: picks.slice(nW),
      participants: pool,
      totalComments: state.comments.length,
      totalUsers: state.view.length,
      totalTickets: pool.reduce((s, p) => s + p.tickets, 0),
      entriesMode: filters.entries,
      rules: describeRules(filters),
      fingerprint,
    };
    renderResult();
    await waitClick($('btnFinish'));
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    $('step-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function renderResult() {
    const r = state.result;
    const card = (p, label, main) => `<div class="winner-card ${main ? 'main' : ''}">
      <div class="pos">${label}</div>
      <div class="name">@${esc(p.username)}</div>
      <a href="https://www.instagram.com/${encodeURIComponent(p.username)}/" target="_blank" rel="noopener">Ver perfil ↗</a>
    </div>`;
    $('resultBody').innerHTML = `
      <div class="winners">${r.winners.map((p, i) => card(p, r.winners.length > 1 ? `🏆 Ganador #${i + 1}` : '🏆 Ganador', true)).join('')}</div>
      ${r.alternates.length ? `<h3>Suplentes</h3><div class="winners">${r.alternates.map((p, i) => card(p, `Suplente #${i + 1}`, false)).join('')}</div>` : ''}
      <p class="result-meta">
        <b>${r.participants.length}</b> participantes válidos · <b>${r.totalTickets}</b> oportunidades ·
        ${r.date.toLocaleString('es')}<br>
        Huella ${r.fingerprint.algo}: <code>${r.fingerprint.hex}</code>
      </p>`;
    $('step-result').classList.remove('hidden');
  }

  $('btnPdf').addEventListener('click', () => {
    if (!state.result) return;
    if (!window.jspdf) return alert('No se pudo cargar el generador de PDF.');
    PdfReport.generate(state.result);
  });

  $('btnCopy').addEventListener('click', async () => {
    const r = state.result;
    if (!r) return;
    const lines = [`🎁 ${r.prize || 'Sorteo'} — resultados`, ''];
    r.winners.forEach((p, i) => lines.push(`🏆 ${r.winners.length > 1 ? `Ganador #${i + 1}: ` : 'Ganador: '}@${p.username}`));
    r.alternates.forEach((p, i) => lines.push(`Suplente #${i + 1}: @${p.username}`));
    lines.push('', `Participantes válidos: ${r.participants.length}`);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      $('btnCopy').textContent = '✔ Copiado';
    } catch {
      prompt('Copia el texto:', lines.join('\n'));
    }
    setTimeout(() => { $('btnCopy').textContent = '📋 Copiar ganadores'; }, 1800);
  });

  $('btnRedo').addEventListener('click', () => {
    $('step-result').classList.add('hidden');
    $('step-draw').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.comments.length) { e.preventDefault(); e.returnValue = ''; }
  });

  refresh();
})();
