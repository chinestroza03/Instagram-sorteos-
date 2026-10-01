/**
 * Lógica del sorteo: azar criptográfico, selección sin repetición y huella de verificación.
 */
const Draw = (() => {
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;

  /** Entero aleatorio uniforme en [0, max) usando crypto.getRandomValues (sin sesgo de módulo). */
  function randomInt(max) {
    if (max <= 0) throw new Error('max debe ser > 0');
    if (!cryptoObj || !cryptoObj.getRandomValues) return Math.floor(Math.random() * max);
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    do { cryptoObj.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  /**
   * Elige `count` personas distintas de `pool` ([{ username, tickets }]).
   * Cada persona tiene probabilidad proporcional a sus oportunidades (tickets).
   * Al salir elegida se retira del bombo, así que nunca se repite.
   */
  function pickWinners(pool, count) {
    const remaining = pool.filter((p) => p.tickets > 0).map((p) => ({ ...p }));
    if (count > remaining.length) throw new Error('Hay menos participantes que premios.');
    const winners = [];
    for (let i = 0; i < count; i++) {
      const total = remaining.reduce((s, p) => s + p.tickets, 0);
      let r = randomInt(total);
      let idx = 0;
      while (r >= remaining[idx].tickets) { r -= remaining[idx].tickets; idx++; }
      winners.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return winners;
  }

  /** Nombre aleatorio para la animación (evita repetir el anterior). */
  function randomName(names, avoid) {
    if (names.length === 1) return names[0];
    let n;
    do { n = names[randomInt(names.length)]; } while (n === avoid);
    return n;
  }

  /** SHA-256 en hexadecimal (con respaldo FNV-1a si el navegador no expone crypto.subtle). */
  async function fingerprint(text) {
    if (cryptoObj && cryptoObj.subtle) {
      const data = new TextEncoder().encode(text);
      const hash = await cryptoObj.subtle.digest('SHA-256', data);
      return { algo: 'SHA-256', hex: [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('') };
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return { algo: 'FNV-1a', hex: h.toString(16).padStart(8, '0') };
  }

  // ---------- Sonido (Web Audio, sin archivos) ----------
  let audioCtx = null;
  function audio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, start, duration, { type = 'sine', gain = 0.15 } = {}) {
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  const sounds = {
    tick: (progress = 0) => tone(500 + progress * 700, 0, 0.05, { type: 'square', gain: 0.05 }),
    beat: () => { tone(110, 0, 0.25, { type: 'triangle', gain: 0.35 }); tone(70, 0, 0.3, { gain: 0.3 }); },
    win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.6 - i * 0.05, { type: 'triangle', gain: 0.2 })),
    unlock: () => audio(),
  };

  return { randomInt, pickWinners, randomName, fingerprint, sounds };
})();

if (typeof module !== 'undefined') module.exports = Draw;
