/**
 * Genera el acta del sorteo en PDF con jsPDF + AutoTable.
 */
const PdfReport = (() => {
  const B = (typeof BRAND !== 'undefined' && BRAND) || null;
  const C = {
    primary: B ? B.pdf.primary : [5, 140, 70],
    dark: B ? B.pdf.dark : [0, 104, 55],
    lime: B ? B.pdf.lime : [137, 186, 59],
    yellow: B ? B.pdf.yellow : [211, 216, 33],
    ink: [18, 48, 31],
    muted: [93, 115, 101],
    light: [240, 246, 236],
  };

  // Las fuentes estándar de PDF sólo cubren Latin-1: quitamos emojis y otros símbolos.
  const clean = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF]/g, '').replace(/\s+/g, ' ').trim();

  function fmtDate(d) {
    return d.toLocaleString('es', { dateStyle: 'long', timeStyle: 'medium' });
  }

  /** Franja con el degradado de la marca (amarillo → lima → verde → verde oscuro). */
  function stripe(doc, y, h) {
    const w = doc.internal.pageSize.getWidth();
    const stops = [C.yellow, C.lime, C.primary, C.dark];
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      const t = (i / (steps - 1)) * (stops.length - 1);
      const a = stops[Math.min(Math.floor(t), stops.length - 2)];
      const b = stops[Math.min(Math.floor(t) + 1, stops.length - 1)];
      const k = t - Math.min(Math.floor(t), stops.length - 2);
      doc.setFillColor(...a.map((v, j) => Math.round(v + (b[j] - v) * k)));
      doc.rect((w / steps) * i, y, w / steps + 0.5, h, 'F');
    }
  }

  function header(doc, title, subtitle) {
    const w = doc.internal.pageSize.getWidth();
    let textX = 15;
    if (B && B.logoPdf) {
      const lw = 48;
      doc.addImage(B.logoPdf.data, 'PNG', 15, 7, lw, (lw * B.logoPdf.height) / B.logoPdf.width);
      textX = w - 15;
    }
    const align = textX === 15 ? 'left' : 'right';
    doc.setTextColor(...C.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text(title, textX, 16, { align });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...C.muted);
    doc.text(doc.splitTextToSize(subtitle, 110), textX, 23, { align });
    stripe(doc, 31, 2.2);
  }

  function footer(doc, id) {
    const pages = doc.getNumberOfPages();
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text(`${B ? clean(B.name) + ' · ' : ''}ID de verificación: ${id}`, 15, h - 8);
      doc.text(`Página ${i} de ${pages}`, w - 15, h - 8, { align: 'right' });
    }
  }

  function generate(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = doc.internal.pageSize.getWidth();
    const shortId = r.fingerprint.hex.slice(0, 16).toUpperCase();

    header(doc, 'Acta de sorteo', clean(r.prize) || 'Sorteo en Instagram');

    // Datos generales
    const info = [
      ...(B ? [['Evento', clean(B.name)]] : []),
      ['Premio / sorteo', clean(r.prize) || '-'],
      ['Organizador', clean(r.organizer) || '-'],
      ['Publicación', clean(r.postUrl) || '-'],
      ['Fecha y hora', fmtDate(r.date)],
      ['Comentarios analizados', String(r.totalComments)],
      ['Personas únicas', String(r.totalUsers)],
      ['Participantes válidos', String(r.participants.length)],
      ['Oportunidades en el bombo', String(r.totalTickets)],
      ['Modalidad', r.entriesMode === 'per-comment' ? '1 oportunidad por comentario' : '1 oportunidad por persona'],
      ['Reglas aplicadas', r.rules.length ? r.rules.map(clean).join('; ') : 'Ninguna'],
      ['Método', 'Selección aleatoria con crypto.getRandomValues, sin repetición de ganadores'],
      [`Huella de participantes (${r.fingerprint.algo})`, r.fingerprint.hex],
    ];
    doc.autoTable({
      startY: 40,
      body: info,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 1.8, textColor: C.ink, overflow: 'linebreak' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 58, textColor: C.muted } },
      margin: { left: 15, right: 15 },
    });

    // Ganadores
    let y = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...C.dark);
    doc.text(r.winners.length > 1 ? 'Ganadores' : 'Ganador', 15, y);

    const rows = r.winners.map((p, i) => [`${i + 1}`, `@${p.username}`, 'Ganador', `instagram.com/${p.username}`]);
    r.alternates.forEach((p, i) => rows.push([`S${i + 1}`, `@${p.username}`, 'Suplente', `instagram.com/${p.username}`]));
    doc.autoTable({
      startY: y + 4,
      head: [['Puesto', 'Usuario', 'Tipo', 'Perfil']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: C.primary, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 11, cellPadding: 3, textColor: C.ink },
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 1: { fontStyle: 'bold' }, 2: { cellWidth: 26 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.raw[2] === 'Suplente') data.cell.styles.textColor = C.muted;
      },
      margin: { left: 15, right: 15 },
    });

    y = doc.lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.muted);
    const note = 'Los suplentes reemplazan, en orden, a los ganadores que no reclamen el premio o no cumplan las bases. '
      + 'La huella se calcula sobre la lista ordenada de participantes y sus oportunidades (anexo), lo que permite comprobar que la lista no fue modificada.';
    doc.text(doc.splitTextToSize(note, w - 30), 15, y);

    // Anexo: participantes
    doc.addPage();
    header(doc, 'Anexo: participantes', `${r.participants.length} participantes válidos`);
    const cols = 3;
    const sorted = [...r.participants].sort((a, b) => a.username.localeCompare(b.username));
    const per = Math.ceil(sorted.length / cols);
    const body = [];
    const winnerSet = new Set([...r.winners, ...r.alternates].map((p) => p.username));
    const cell = (p, idx) => (p ? `${idx + 1}. @${p.username}${r.entriesMode === 'per-comment' ? ` (${p.tickets})` : ''}` : '');
    for (let i = 0; i < per; i++) {
      const row = [];
      for (let c = 0; c < cols; c++) { const idx = c * per + i; row.push(cell(sorted[idx], idx)); }
      body.push(row);
    }
    doc.autoTable({
      startY: 40,
      body,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 1.6, textColor: C.ink },
      alternateRowStyles: { fillColor: C.light },
      didParseCell: (data) => {
        const m = String(data.cell.raw).match(/@([a-z0-9._]+)/);
        if (m && winnerSet.has(m[1])) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = C.primary; }
      },
      margin: { left: 15, right: 15, top: 40 },
      willDrawPage: (data) => { if (data.pageNumber > 1) header(doc, 'Anexo: participantes (cont.)', ''); },
    });

    footer(doc, shortId);
    const stamp = r.date.toISOString().slice(0, 16).replace(/[:T]/g, '-');
    doc.save(`acta-sorteo-${stamp}.pdf`);
  }

  return { generate };
})();
