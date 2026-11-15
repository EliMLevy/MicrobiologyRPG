// MicrobiologyRPG v2 UI: canvas rendering, free placement, HUD, modals.
import { TOWERS, PATHOGENS, WAVES, UPGRADES, GLOSSARY, W, H } from "./data.js";
import {
  createGame, startWave, startEndless, step, placeTower, removeTower, towerAt,
  canPlace, dnaseBurst, buyUpgrade, upgradeLevel, wavePathogen, enemyPos, log,
} from "./game.js";
import {
  drawField, drawPath, drawHeart, drawEnemy, drawRange, drawPlacementGhost,
  drawNeutrophil, drawMacrophage, drawDendritic, drawBCell, drawCD8, drawNK,
  drawSkinBarrier, drawMarrow,
} from "./art.js";

const els = {
  vitals: document.getElementById("vitals"),
  resources: document.getElementById("resources"),
  waveLabel: document.getElementById("waveLabel"),
  canvas: document.getElementById("game"),
  tray: document.getElementById("tray"),
  log: document.getElementById("log"),
  info: document.getElementById("towerInfo"),
  pauseBtn: document.getElementById("pauseBtn"),
  speedBtn: document.getElementById("speedBtn"),
  glossaryBtn: document.getElementById("glossaryBtn"),
  dnaseBtn: document.getElementById("dnaseBtn"),
  briefingDialog: document.getElementById("briefingDialog"),
  briefingTitle: document.getElementById("briefingTitle"),
  briefingBody: document.getElementById("briefingBody"),
  startWaveBtn: document.getElementById("startWaveBtn"),
  shopDialog: document.getElementById("shopDialog"),
  shopBody: document.getElementById("shopBody"),
  nextWaveBtn: document.getElementById("nextWaveBtn"),
  glossaryDialog: document.getElementById("glossaryDialog"),
  glossaryBody: document.getElementById("glossaryBody"),
  glossaryClose: document.getElementById("glossaryClose"),
  endDialog: document.getElementById("endDialog"),
  endTitle: document.getElementById("endTitle"),
  endBody: document.getElementById("endBody"),
  restartBtn: document.getElementById("restartBtn"),
};

const ctx = els.canvas.getContext("2d");
const state = createGame();
let selectedTower = null; // tower type code to place
let selectedPlaced = null; // placed tower id
let mouse = { x: 0, y: 0, inside: false };
let pendingWave = 1;
let lastTs = 0;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function num(n) { return Math.round(n).toLocaleString(); }

/* ---------- canvas rendering ---------- */

const DRAW = {
  neutrophil: drawNeutrophil,
  macrophage: drawMacrophage,
  dendritic: drawDendritic,
  bcell: drawBCell,
  cd8: drawCD8,
  nk: drawNK,
  skin: drawSkinBarrier,
  marrow: drawMarrow,
};

function renderCanvas() {
  const t = state.time;
  drawField(ctx, t);
  drawPath(ctx);
  drawHeart(ctx, t, state.coreHp / state.maxCoreHp);

  // Towers (skin zones under everything else).
  for (const tw of state.towers) {
    if (tw.code === "skin") {
      drawSkinBarrier(ctx, tw.x, tw.y, TOWERS.skin.range, t, {
        selected: selectedPlaced === tw.id,
      });
    }
  }
  for (const tw of state.towers) {
    if (tw.code === "skin") continue;
    const def = TOWERS[tw.code];
    if (selectedPlaced === tw.id && def.range > 0) drawRange(ctx, tw.x, tw.y, def.range);
    const opts = {
      hp: def.hp > 0 ? tw.hp / tw.maxHp : null,
      infected: !!tw.infected,
      plasma: tw.plasma,
      progress: tw.code === "marrow" ? Math.min(1, tw.marrowTimer / def.rate) : null,
    };
    DRAW[tw.code](ctx, tw.x, tw.y, def.radius, t, opts);
    if (tw.infected) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", tw.x, tw.y - def.radius - 12);
    }
  }

  // Roaming white blood cells.
  for (const r of state.roamers) {
    const def = TOWERS[r.code];
    DRAW[r.code](ctx, r.x, r.y, def.radius * 0.8, t, {
      hp: r.hp / r.maxHp, infected: !!r.infected,
    });
  }

  // Enemies.
  for (const e of state.enemies) {
    const p = enemyPos(e);
    drawEnemy(ctx, e, p.x, p.y, t);
  }

  // Tracers (shots) and death particles.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  for (const tr of state.tracers) {
    ctx.globalAlpha = Math.max(0, tr.life / 0.12);
    ctx.beginPath();
    ctx.moveTo(tr.x1, tr.y1);
    ctx.lineTo(tr.x2, tr.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / 0.4);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 6 * (1 - pt.life / 0.4) + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Placement ghost.
  if (selectedTower && mouse.inside) {
    const def = TOWERS[selectedTower];
    const err = canPlace(state, selectedTower, mouse.x, mouse.y);
    if (def.range > 0) drawRange(ctx, mouse.x, mouse.y, def.range);
    drawPlacementGhost(ctx, selectedTower, mouse.x, mouse.y, !err);
  }
}

/* ---------- HUD ---------- */

function renderHUD() {
  const liveCells = state.towers.length + state.roamers.length;
  const temp = (37.0 + 0.8 * upgradeLevel(state, "fever") + (state.phase === "battle" && state.enemies.length ? 0.4 : 0)).toFixed(1);
  els.vitals.innerHTML =
    `<span class="vit" title="Host integrity — reaches 0 and the host goes septic">❤ <b>${num(state.coreHp)}</b>/100</span>` +
    `<span class="vit" title="Core temperature">🌡 ${temp}°C</span>` +
    `<span class="vit" title="White blood cells deployed">🩸 WBC ${liveCells}</span>` +
    `<span class="vit" title="C-reactive protein — rises with infection">CRP ${num(state.crp)}</span>`;
  els.resources.innerHTML =
    `<span class="vit" title="ATP — energy for deploying cells and abilities">⚡ ATP <b>${num(state.atp)}</b></span>` +
    `<span class="vit" title="Antigen samples — research currency">🧬 Antigen <b>${num(state.antigen)}</b></span>` +
    `<span class="vit">Wave <b>${state.wave || "—"}</b> / ${WAVES.length}</span>`;
  const p = state.phase === "battle" ? wavePathogen(state) : null;
  els.waveLabel.textContent =
    state.phase === "battle"
      ? `Wave ${state.wave}: ${p.name} — ${state.spawnQueue.length + state.enemies.length} remaining`
      : state.phase === "shop"
        ? `Wave ${state.wave} cleared — research, then continue`
        : state.phase === "won"
          ? "Host survived all five pathogens!"
          : state.phase === "lost"
            ? "Sepsis — the host did not survive."
            : "No invasion yet — read the briefing and start wave 1.";
  els.log.innerHTML = state.log.slice(0, 12).map((m) => `<div class="log-line">${esc(m)}</div>`).join("") ||
    `<div class="log-line">No events yet.</div>`;
  els.pauseBtn.textContent = state.paused ? "▶ Resume" : "⏸ Pause";
  els.speedBtn.textContent = `${state.speed}×`;
  els.dnaseBtn.disabled = state.phase !== "battle" || state.atp < 50;

  // Selected tower info.
  if (selectedPlaced != null) {
    const tw = state.towers.find((x) => x.id === selectedPlaced);
    if (!tw) {
      selectedPlaced = null;
      els.info.innerHTML = "";
    } else {
      const def = TOWERS[tw.code];
      els.info.innerHTML =
        `<div class="tower-info"><b>${esc(def.name)}</b> ` +
        (def.hp > 0 ? `<span class="mono">HP ${Math.ceil(tw.hp)}/${def.maxHp}</span>` : "") +
        (tw.infected ? ` <span class="tag tag-bad">INFECTED — bursts soon</span>` : "") +
        (tw.plasma ? ` <span class="tag tag-ok">plasma cell</span>` : "") +
        `<div class="upg-desc">${esc(def.desc)}</div>` +
        `<button type="button" class="small" id="removeTowerBtn">Remove</button></div>`;
      const rb = document.getElementById("removeTowerBtn");
      if (rb) rb.addEventListener("click", () => {
        removeTower(state, selectedPlaced);
        selectedPlaced = null;
        els.info.innerHTML = "";
      });
    }
  } else {
    els.info.innerHTML = "";
  }
}

function renderTray() {
  els.tray.innerHTML = Object.values(TOWERS)
    .map((c, i) => {
      const afford = state.atp >= c.cost;
      const sel = selectedTower === c.code ? " selected" : "";
      return `<button type="button" class="tray-btn${sel}${afford ? "" : " poor"}" data-code="${c.code}" title="${esc(c.desc)}">` +
        `<span class="tray-abbr" style="--c:${c.color}">${c.abbr}</span>` +
        `<span class="tray-name">${esc(c.name)}</span>` +
        `<span class="mono tray-cost">${c.cost} ATP · ${i + 1}</span></button>`;
    })
    .join("");
}

/* ---------- modals ---------- */

function openBriefing(n) {
  pendingWave = n;
  const w = WAVES[(n - 1) % WAVES.length];
  const p = PATHOGENS[w.pathogen];
  const mem = state.memory[p.code];
  els.briefingTitle.textContent = `Wave ${n} — ${p.name}`;
  els.briefingBody.innerHTML =
    `<p class="path-meta"><span class="tag">${esc(p.gram)}</span> <span class="tag">${esc(p.shape)}</span>` +
    (mem ? ` <span class="tag tag-ok">Memory cells banked — secondary response</span>` : "") + `</p>` +
    `<p>${esc(w.note)}</p>` +
    `<h4>Virulence factors</h4>` +
    p.virulence.map((v) => `<div class="vf"><b>${esc(v.name)}</b> — ${esc(v.text)}</div>`).join("") +
    `<h4>Textbook note</h4><p class="textbook">${esc(p.textbook)}</p>` +
    `<h4>Counter-strategy</h4><p>${esc(p.counter)}</p>`;
  if (typeof els.briefingDialog.showModal === "function") els.briefingDialog.showModal();
}

function openShop() {
  els.shopBody.innerHTML =
    `<p class="shop-meta">ATP <b>${num(state.atp)}</b> · Antigen <b>${num(state.antigen)}</b> — spend before the next wave.</p>` +
    Object.entries(UPGRADES)
      .map(([key, def]) => {
        const level = upgradeLevel(state, key);
        const maxed = level >= def.max;
        const cost = maxed ? null : def.cost(level);
        const afford = cost && state.atp >= cost.atp && state.antigen >= cost.ag;
        return `<div class="upg"><div class="upg-info"><b>${esc(def.name)}</b> <span class="mono">Lv ${level}/${def.max}</span>` +
          `<div class="upg-desc">${esc(def.desc)}</div></div>` +
          (maxed
            ? `<span class="tag">Maxed</span>`
            : `<button type="button" class="small primary" data-upg="${key}" ${afford ? "" : "disabled"}>${cost.atp} ATP · ${cost.ag} Ag</button>`) +
          `</div>`;
      })
      .join("");
  els.nextWaveBtn.textContent = state.endless
    ? `Next wave (endless ${state.endlessCycle + 1})`
    : state.wave >= WAVES.length
      ? "Finish"
      : `Next wave — ${PATHOGENS[WAVES[state.wave % WAVES.length].pathogen].name}`;
  if (typeof els.shopDialog.showModal === "function") els.shopDialog.showModal();
}

function openEnd(won) {
  els.endTitle.textContent = won ? "Host survived!" : "Sepsis";
  els.endBody.innerHTML = won
    ? `<p>You cleared all five pathogens. The host recovered — and now carries memory cells against every one of them.</p>` +
      `<p class="mono">Waves cleared: ${state.wave} · Invaders killed: ${state.kills} · Host integrity: ${num(state.coreHp)}/100</p>` +
      `<p><button type="button" class="small primary" id="endlessBtn">Continue — endless mode</button></p>`
    : `<p>The core was overrun. The host went septic.</p>` +
      `<p class="mono">Waves cleared: ${state.wave - 1} · Invaders killed: ${state.kills}</p>`;
  const eb = document.getElementById("endlessBtn");
  if (eb) eb.addEventListener("click", () => {
    els.endDialog.close();
    startEndless(state);
    openShop();
  });
  if (typeof els.endDialog.showModal === "function") els.endDialog.showModal();
}

/* ---------- main loop ---------- */

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  const prevPhase = state.phase;
  if (state.phase === "battle" && !state.paused) {
    step(state, dt * state.speed);
  }
  if (state.phase !== prevPhase) {
    if (state.phase === "shop") openShop();
    if (state.phase === "won" || state.phase === "lost") openEnd(state.phase === "won");
  }
  renderCanvas();
  renderHUD();
  requestAnimationFrame(frame);
}

/* ---------- input ---------- */

function canvasPos(e) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * W,
    y: ((e.clientY - rect.top) / rect.height) * H,
  };
}

els.canvas.addEventListener("mousemove", (e) => {
  const p = canvasPos(e);
  mouse = { x: p.x, y: p.y, inside: true };
});
els.canvas.addEventListener("mouseleave", () => { mouse.inside = false; });
els.canvas.addEventListener("click", (e) => {
  const p = canvasPos(e);
  if (selectedTower) {
    const err = placeTower(state, selectedTower, p.x, p.y);
    if (err) log(state, err);
    else if (!e.shiftKey) selectedTower = null;
    renderTray();
    return;
  }
  const tw = towerAt(state, p.x, p.y);
  selectedPlaced = tw ? tw.id : null;
});

els.tray.addEventListener("click", (e) => {
  const btn = e.target.closest(".tray-btn[data-code]");
  if (!btn) return;
  selectedTower = selectedTower === btn.dataset.code ? null : btn.dataset.code;
  selectedPlaced = null;
  renderTray();
});

els.dnaseBtn.addEventListener("click", () => {
  const err = dnaseBurst(state);
  if (err) log(state, err);
});

els.pauseBtn.addEventListener("click", () => { state.paused = !state.paused; });
els.speedBtn.addEventListener("click", () => { state.speed = state.speed === 1 ? 2 : 1; });

els.startWaveBtn.addEventListener("click", () => {
  els.briefingDialog.close();
  startWave(state, pendingWave);
});

els.nextWaveBtn.addEventListener("click", () => {
  els.shopDialog.close();
  if (!state.endless && state.wave >= WAVES.length) {
    state.phase = "won";
    openEnd(true);
    return;
  }
  if (state.endless) state.endlessCycle++;
  openBriefing(state.wave + 1);
});

els.shopBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-upg]");
  if (!btn) return;
  const err = buyUpgrade(state, btn.dataset.upg);
  if (err) log(state, err);
  openShop();
});

els.glossaryBtn.addEventListener("click", () => {
  els.glossaryBody.innerHTML = GLOSSARY.map(
    (g) => `<div class="gloss"><b>${esc(g.term)}</b> — ${esc(g.def)}</div>`
  ).join("");
  if (typeof els.glossaryDialog.showModal === "function") els.glossaryDialog.showModal();
});
els.glossaryClose.addEventListener("click", () => els.glossaryDialog.close());
els.restartBtn.addEventListener("click", () => location.reload());

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const codes = Object.keys(TOWERS);
  const idx = Number(e.key) - 1;
  if (idx >= 0 && idx < codes.length) {
    selectedTower = selectedTower === codes[idx] ? null : codes[idx];
    selectedPlaced = null;
    renderTray();
  }
  if (e.key === " ") {
    e.preventDefault();
    state.paused = !state.paused;
  }
  if (e.key === "Escape") {
    selectedTower = null;
    selectedPlaced = null;
    renderTray();
  }
});

/* ---------- boot ---------- */

log(state, "Welcome. You are the immune system. Read the briefing, then place your defenses.");
renderTray();
requestAnimationFrame(frame);
openBriefing(1);
