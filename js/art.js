// MicrobiologyRPG v2 — procedural canvas art.
// Every cell and pathogen is drawn in code: lobed neutrophil nuclei,
// amoeboid macrophages, dendritic arms, staph clusters, spiky virions.
// No images, no emoji — the morphology is the point.
import { PATH, HEART, W, H } from "./data.js";

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function blob(ctx, x, y, r, t, lobes, wobble) {
  ctx.beginPath();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 + wobble * Math.sin(a * lobes + t * 2));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/* ---------- the field ---------- */

export function drawField(ctx, t) {
  // Tissue background: soft vertical gradient + faint cell texture.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#241d1a");
  g.addColorStop(1, "#1a1512");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Faint background cells (static-ish, slow drift).
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let i = 0; i < 40; i++) {
    const x = ((i * 173) % W) + Math.sin(t * 0.1 + i) * 4;
    const y = ((i * 97) % H) + Math.cos(t * 0.08 + i) * 4;
    circle(ctx, x, y, 6 + (i % 5) * 3);
  }
}

export function drawPath(ctx) {
  // The invasion route: a vessel/track through the tissue.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#3d2b26";
  ctx.lineWidth = 46;
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.strokeStyle = "#4a352d";
  ctx.lineWidth = 38;
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  // Dashed center line.
  ctx.strokeStyle = "rgba(255,200,160,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawHeart(ctx, t, hpFrac) {
  const x = HEART.x, y = HEART.y;
  const beat = 1 + 0.08 * Math.sin(t * 4);
  const r = 26 * beat;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(beat, beat);
  ctx.fillStyle = hpFrac > 0.5 ? "#e53935" : hpFrac > 0.25 ? "#fb8c00" : "#b71c1c";
  // Heart shape from two lobes + point.
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.bezierCurveTo(-26, 2, -22, -20, -8, -20);
  ctx.bezierCurveTo(-2, -20, 0, -14, 0, -10);
  ctx.bezierCurveTo(0, -14, 2, -20, 8, -20);
  ctx.bezierCurveTo(22, -20, 26, 2, 0, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  circle(ctx, -9, -8, 4);
  ctx.restore();
  // Integrity ring.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpFrac);
  ctx.stroke();
}

/* ---------- immune cells (towers & roamers) ---------- */

function hpBar(ctx, x, y, w, frac, color) {
  if (frac >= 1) return;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2, y - 6, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - 6, w * Math.max(0, frac), 4);
}

export function drawNeutrophil(ctx, x, y, r, t, opts = {}) {
  // Pale lavender cytoplasm, multi-lobed nucleus (3 lobes), granules.
  ctx.fillStyle = "#e6dcf7";
  blob(ctx, x, y, r, t, 3, 0.08);
  ctx.fillStyle = "#7e57c2";
  const lo = r * 0.32;
  circle(ctx, x - lo, y - lo * 0.5, r * 0.30);
  circle(ctx, x + lo * 0.4, y - lo * 0.6, r * 0.28);
  circle(ctx, x + lo * 0.2, y + lo * 0.7, r * 0.30);
  ctx.fillStyle = "rgba(126,87,194,0.5)";
  for (let i = 0; i < 5; i++) {
    const a = t + (i * Math.PI * 2) / 5;
    circle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 1.5);
  }
  if (opts.infected) drawInfectedMark(ctx, x, y, r, t);
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawMacrophage(ctx, x, y, r, t, opts = {}) {
  // Big amoeboid cell: pseudopods, kidney nucleus, vacuoles.
  ctx.fillStyle = "#ffcc80";
  blob(ctx, x, y, r, t, 5, 0.16);
  ctx.fillStyle = "#ef6c00";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y, r * 0.45, r * 0.3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  circle(ctx, x + r * 0.4, y - r * 0.35, r * 0.18);
  circle(ctx, x + r * 0.5, y + r * 0.3, r * 0.13);
  if (opts.infected) drawInfectedMark(ctx, x, y, r, t);
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawDendritic(ctx, x, y, r, t, opts = {}) {
  // Star-shaped with long dendrite arms.
  ctx.strokeStyle = "#ce93d8";
  ctx.lineWidth = 2.5;
  ctx.fillStyle = "#ba68c8";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.15;
    const len = r * (1.6 + 0.2 * Math.sin(t * 2 + i));
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    circle(ctx, ex, ey, 2.5);
  }
  circle(ctx, x, y, r * 0.7);
  ctx.fillStyle = "#6a1b9a";
  circle(ctx, x, y, r * 0.35);
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawBCell(ctx, x, y, r, t, opts = {}) {
  // Round lymphocyte: huge nucleus, thin cytoplasm rim.
  ctx.fillStyle = "#a5d6a7";
  circle(ctx, x, y, r);
  ctx.fillStyle = "#2e7d32";
  circle(ctx, x, y, r * 0.72);
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.18);
  if (opts.plasma) {
    // Plasma cell: golden halo + secreted antibodies orbiting.
    ctx.strokeStyle = "rgba(255,213,79,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 3 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffd54f";
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + (i * Math.PI * 2) / 3;
      circle(ctx, x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7), 2);
    }
  }
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawCD8(ctx, x, y, r, t, opts = {}) {
  ctx.fillStyle = "#f48fb1";
  blob(ctx, x, y, r, t, 3, 0.06);
  ctx.fillStyle = "#c62828";
  for (let i = 0; i < 4; i++) {
    const a = t * 0.5 + (i * Math.PI * 2) / 4;
    circle(ctx, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.14);
  }
  ctx.fillStyle = "#880e4f";
  circle(ctx, x, y, r * 0.3);
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawNK(ctx, x, y, r, t, opts = {}) {
  ctx.fillStyle = "#90caf9";
  blob(ctx, x, y, r, t, 4, 0.07);
  ctx.fillStyle = "#1565c0";
  circle(ctx, x, y, r * 0.4);
  ctx.fillStyle = "#0d47a1";
  for (let i = 0; i < 3; i++) {
    const a = -t + (i * Math.PI * 2) / 3;
    circle(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.12);
  }
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

export function drawSkinBarrier(ctx, x, y, r, t, opts = {}) {
  // Layered epithelium: concentric rings + hatch marks, pulsing faintly.
  const pulse = 1 + 0.03 * Math.sin(t * 1.5);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "rgba(244,169,136,0.18)";
  circle(ctx, 0, 0, r);
  ctx.strokeStyle = "#f4a988";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(244,169,136,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.33, 0, Math.PI * 2); ctx.stroke();
  // Mucus dots.
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.2;
    circle(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 2);
  }
  ctx.restore();
  if (opts.selected) drawRange(ctx, x, y, r);
}

export function drawMarrow(ctx, x, y, r, t, opts = {}) {
  // Bone cross-section: white cortical ring, red marrow center, pulsing.
  const pulse = 1 + 0.04 * Math.sin(t * 2);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "#f5f0e6";
  circle(ctx, 0, 0, r);
  ctx.fillStyle = "#e57373";
  circle(ctx, 0, 0, r * 0.68);
  ctx.fillStyle = "#ffcdd2";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    circle(ctx, Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.12);
  }
  ctx.fillStyle = "#b71c1c";
  circle(ctx, 0, 0, r * 0.22);
  ctx.restore();
  // Progress ring to next release.
  if (opts.progress != null) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * opts.progress);
    ctx.stroke();
  }
  if (opts.hp != null) hpBar(ctx, x, y - r - 4, r * 2, opts.hp, "#81c784");
}

function drawInfectedMark(ctx, x, y, r, t) {
  // Purple blotch + pulsing outline: something is growing inside.
  ctx.fillStyle = "rgba(106,27,154,0.55)";
  circle(ctx, x + r * 0.3, y - r * 0.2, r * 0.35 + Math.sin(t * 4) * 1.5);
  ctx.strokeStyle = "#ab47bc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 2 + Math.sin(t * 4), 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------- pathogens ---------- */

export function drawStaph(ctx, x, y, r, t) {
  // Grape-like cluster of golden cocci.
  const offsets = [[0, 0], [-0.7, -0.4], [0.7, -0.5], [-0.5, 0.6], [0.6, 0.55], [0, -0.9], [-0.9, 0.1]];
  ctx.fillStyle = "#ffd54f";
  for (const [ox, oy] of offsets) {
    circle(ctx, x + ox * r * 0.7, y + oy * r * 0.7, r * 0.42);
  }
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  circle(ctx, x - r * 0.3, y - r * 0.35, r * 0.14);
  ctx.strokeStyle = "#f9a825";
  ctx.lineWidth = 1;
  for (const [ox, oy] of offsets) {
    ctx.beginPath();
    ctx.arc(x + ox * r * 0.7, y + oy * r * 0.7, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawStrep(ctx, x, y, r, t) {
  // Chain of red cocci, slowly rotating.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.7) * 0.3);
  ctx.fillStyle = "#ef5350";
  for (let i = -2; i <= 2; i++) {
    circle(ctx, i * r * 0.55, Math.sin(i * 1.2 + t) * r * 0.12, r * 0.36);
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  circle(ctx, -r * 1.1, -r * 0.15, r * 0.1);
  ctx.restore();
}

export function drawMtb(ctx, x, y, r, t) {
  // Acid-fast rod: beaded red bacillus, slight curve.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4 + Math.sin(t * 0.5) * 0.1);
  ctx.fillStyle = "#ff7043";
  ctx.beginPath();
  ctx.roundRect(-r * 1.3, -r * 0.32, r * 2.6, r * 0.64, r * 0.32);
  ctx.fill();
  ctx.fillStyle = "#d84315";
  for (let i = -1; i <= 1; i++) {
    circle(ctx, i * r * 0.8, 0, r * 0.16);
  }
  ctx.restore();
}

export function drawFlu(ctx, x, y, r, t) {
  // Spiky virion: blue sphere with hemagglutinin spikes.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.4);
  ctx.strokeStyle = "#90caf9";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x1 = Math.cos(a) * r * 0.8;
    const y1 = Math.sin(a) * r * 0.8;
    const x2 = Math.cos(a) * r * 1.25;
    const y2 = Math.sin(a) * r * 1.25;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.fillStyle = "#bbdefb";
    circle(ctx, x2, y2, 2);
  }
  ctx.fillStyle = "#42a5f5";
  circle(ctx, 0, 0, r * 0.8);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  circle(ctx, -r * 0.25, -r * 0.25, r * 0.2);
  ctx.restore();
}

export function drawPseudomonas(ctx, x, y, r, t) {
  // Green rod with a slimy alginate halo.
  ctx.fillStyle = "rgba(77,182,172,0.25)";
  blob(ctx, x, y, r * 1.5, t, 3, 0.12);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5 + Math.sin(t * 0.6) * 0.15);
  ctx.fillStyle = "#26a69a";
  ctx.beginPath();
  ctx.roundRect(-r * 1.2, -r * 0.3, r * 2.4, r * 0.6, r * 0.3);
  ctx.fill();
  ctx.fillStyle = "#004d40";
  circle(ctx, r * 0.7, 0, r * 0.12);
  ctx.restore();
}

export function drawEnemy(ctx, enemy, x, y, t) {
  const r = 13;
  switch (enemy.code) {
    case "saureus": drawStaph(ctx, x, y, r, t); break;
    case "spyogenes": drawStrep(ctx, x, y, r, t); break;
    case "mtb": drawMtb(ctx, x, y, r, t); break;
    case "influenza": drawFlu(ctx, x, y, r, t); break;
    case "paeruginosa": drawPseudomonas(ctx, x, y, r, t); break;
    default: ctx.fillStyle = "#fff"; circle(ctx, x, y, r);
  }
  // Fibrin shield ring.
  if (enemy.shield > 0) {
    ctx.strokeStyle = "rgba(255,241,118,0.9)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Biofilm slime.
  if (enemy.biofilm) {
    ctx.fillStyle = "rgba(77,182,172,0.35)";
    blob(ctx, x, y, r + 6, t, 4, 0.15);
  }
  // Opsonization: gold antibody dots orbiting.
  if (enemy.opsonized) {
    ctx.fillStyle = "#ffd54f";
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i * Math.PI * 2) / 3;
      circle(ctx, x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), 2.5);
    }
  }
  // Slow tint.
  if (enemy.slowFactor < 1) {
    ctx.strokeStyle = "rgba(100,181,246,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  hpBar(ctx, x, y - r - 8, r * 2.2, (enemy.hp + enemy.shield) / enemy.maxHp, "#ef5350");
}

/* ---------- overlays ---------- */

export function drawRange(ctx, x, y, range) {
  ctx.fillStyle = "rgba(79,195,247,0.08)";
  ctx.strokeStyle = "rgba(79,195,247,0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawPlacementGhost(ctx, type, x, y, valid) {
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = valid ? "#81c784" : "#ef5350";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}
