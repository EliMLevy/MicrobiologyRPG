// MicrobiologyRPG UI: rendering, placement, shop, briefing, glossary.
import { CELLS, PATHOGENS, WAVES, UPGRADES, GLOSSARY, LANES, COLS } from "./data.js";
import {
  createGame, startWave, startEndless, tick, placeCell, removeCell,
  dnaseBurst, buyUpgrade, upgradeLevel, wavePathogen, log,
} from "./game.js";

const els = {
  vitals: document.getElementById("vitals"),
  resources: document.getElementById("resources"),
  waveLabel: document.getElementById("waveLabel"),
  battlefield: document.getElementById("battlefield"),
  tray: document.getElementById("tray"),
  log: document.getElementById("log"),
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

const state = createGame();
let selectedCell = null;
let removeMode = false;
let loopId = null;
let pendingWave = 1;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function num(n) { return Math.round(n).toLocaleString(); }

/* ---------- rendering ---------- */

function renderVitals() {
  const liveCells = state.cells.size;
  const temp = (37.0 + 0.8 * upgradeLevel(state, "fever") + (state.phase === "battle" && state.invaders.length ? 0.4 : 0)).toFixed(1);
  els.vitals.innerHTML =
    `<span class="vit" title="Host integrity — reaches 0 and the host goes septic">❤ <b>${num(state.coreHp)}</b>/100</span>` +
    `<span class="vit" title="Core temperature">🌡 ${temp}°C</span>` +
    `<span class="vit" title="White blood cells deployed">🩸 WBC ${liveCells}</span>` +
    `<span class="vit" title="C-reactive protein — rises with infection">CRP ${num(state.crp)}</span>`;
  els.resources.innerHTML =
    `<span class="vit" title="ATP — energy for deploying cells and abilities">⚡ ATP <b>${num(state.atp)}</b></span>` +
    `<span class="vit" title="Antigen samples — research currency">🧬 Antigen <b>${num(state.antigen)}</b></span>` +
    `<span class="vit">Wave <b>${state.wave || "—"}</b> / ${WAVES.length}</span>`;
}

function hpBar(hp, maxHp) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return `<div class="hpbar"><i style="width:${pct.toFixed(0)}%"></i></div>`;
}

function renderBattlefield() {
  let html = "";
  for (let lane = 0; lane < LANES; lane++) {
    html += `<div class="lane" data-lane="${lane}">`;
    html += `<div class="core" title="Host core — do not let invaders reach it">🫀</div>`;
    for (let col = 0; col < COLS; col++) {
      const cell = state.cells.get(`${lane},${col}`);
      const invs = state.invaders.filter((i) => i.lane === lane && Math.floor(i.col) === col);
      let inner = "";
      if (cell) {
        const def = CELLS[cell.code];
        const infected = cell.infected ? ` infected` : "";
        const plasma = cell.plasma ? ` plasma` : "";
        inner += `<div class="unit cell${infected}${plasma}" style="--c:${def.color}" title="${esc(def.name)}${cell.infected ? " — INFECTED" : ""}${cell.plasma ? " — plasma cell" : ""}">` +
          `<span class="abbr">${def.abbr}</span>${hpBar(cell.hp, cell.maxHp)}</div>`;
      }
      for (const inv of invs) {
        const p = PATHOGENS[inv.code];
        const flags = [
          inv.biofilm ? "biofilm" : "",
          inv.shield > 0 ? `shield +${num(inv.shield)}` : "",
          inv.drifted ? "drifted" : "",
        ].filter(Boolean).join(" · ");
        inner += `<div class="unit inv" style="--c:${p.color}" title="${esc(p.name)}${flags ? " — " + esc(flags) : ""}">` +
          `<span class="abbr">${p.abbr}</span>${hpBar(inv.hp + inv.shield, inv.maxHp)}</div>`;
      }
      html += `<div class="slot" data-lane="${lane}" data-col="${col}">${inner}</div>`;
    }
    html += `</div>`;
  }
  els.battlefield.innerHTML = html;
  const p = state.phase === "battle" ? wavePathogen(state) : null;
  els.waveLabel.textContent =
    state.phase === "battle"
      ? `Wave ${state.wave}: ${p.name} — ${state.spawnQueue.length + state.invaders.length} remaining`
      : state.phase === "shop"
        ? `Wave ${state.wave} cleared — research, then continue`
        : state.phase === "won"
          ? "Host survived all five pathogens!"
          : state.phase === "lost"
            ? "Sepsis — the host did not survive."
            : "No invasion yet — read the briefing and start wave 1.";
}

function renderTray() {
  els.tray.innerHTML = Object.values(CELLS)
    .map((c, i) => {
      const afford = state.atp >= c.cost;
      const sel = selectedCell === c.code ? " selected" : "";
      return `<button type="button" class="tray-btn${sel}${afford ? "" : " poor"}" data-code="${c.code}" title="${esc(c.desc)}">` +
        `<span class="tray-abbr" style="--c:${c.color}">${c.abbr}</span>` +
        `<span class="tray-name">${esc(c.name)}</span>` +
        `<span class="mono tray-cost">${c.cost} ATP · ${i + 1}</span></button>`;
    })
    .join("") +
    `<button type="button" class="tray-btn${removeMode ? " selected" : ""}" id="removeBtn" title="Remove a deployed cell">✕ Remove</button>`;
  const rb = document.getElementById("removeBtn");
  if (rb) rb.addEventListener("click", () => {
    removeMode = !removeMode;
    selectedCell = null;
    renderTray();
  });
}

function renderLog() {
  els.log.innerHTML = state.log.slice(0, 12).map((m) => `<div class="log-line">${esc(m)}</div>`).join("") ||
    `<div class="log-line">No events yet.</div>`;
}

function render() {
  renderVitals();
  renderBattlefield();
  renderTray();
  renderLog();
  els.pauseBtn.textContent = state.paused ? "▶ Resume" : "⏸ Pause";
  els.speedBtn.textContent = `${state.speed}×`;
  els.dnaseBtn.disabled = state.phase !== "battle" || state.atp < 50;
}

/* ---------- briefing / shop / end ---------- */

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
    render();
  });
  if (typeof els.endDialog.showModal === "function") els.endDialog.showModal();
}

/* ---------- loop ---------- */

function startLoop() {
  stopLoop();
  loopId = setInterval(() => {
    const prevPhase = state.phase;
    tick(state);
    if (state.phase !== prevPhase) {
      if (state.phase === "shop") openShop();
      if (state.phase === "won" || state.phase === "lost") openEnd(state.phase === "won");
    }
    render();
  }, 700 / state.speed);
}
function stopLoop() {
  if (loopId) clearInterval(loopId);
  loopId = null;
}

/* ---------- wiring ---------- */

els.tray.addEventListener("click", (e) => {
  const btn = e.target.closest(".tray-btn[data-code]");
  if (!btn) return;
  selectedCell = selectedCell === btn.dataset.code ? null : btn.dataset.code;
  removeMode = false;
  renderTray();
});

els.battlefield.addEventListener("click", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  const lane = Number(slot.dataset.lane);
  const col = Number(slot.dataset.col);
  if (removeMode) {
    removeCell(state, lane, col);
    render();
    return;
  }
  if (!selectedCell) return;
  const err = placeCell(state, lane, col, selectedCell);
  if (err) log(state, err);
  render();
});

els.dnaseBtn.addEventListener("click", () => {
  const err = dnaseBurst(state);
  if (err) log(state, err);
  render();
});

els.pauseBtn.addEventListener("click", () => {
  state.paused = !state.paused;
  render();
});

els.speedBtn.addEventListener("click", () => {
  state.speed = state.speed === 1 ? 2 : 1;
  startLoop();
  render();
});

els.startWaveBtn.addEventListener("click", () => {
  els.briefingDialog.close();
  startWave(state, pendingWave);
  startLoop();
  render();
});

els.nextWaveBtn.addEventListener("click", () => {
  els.shopDialog.close();
  if (!state.endless && state.wave >= WAVES.length) {
    state.phase = "won";
    openEnd(true);
    render();
    return;
  }
  if (state.endless) state.endlessCycle++;
  openBriefing(state.wave + 1);
  render();
});

els.shopBody.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-upg]");
  if (!btn) return;
  const err = buyUpgrade(state, btn.dataset.upg);
  if (err) log(state, err);
  openShop();
  render();
});

els.glossaryBtn.addEventListener("click", () => {
  els.glossaryBody.innerHTML = GLOSSARY.map(
    (g) => `<div class="gloss"><b>${esc(g.term)}</b> — ${esc(g.def)}</div>`
  ).join("");
  if (typeof els.glossaryDialog.showModal === "function") els.glossaryDialog.showModal();
});
els.glossaryClose.addEventListener("click", () => els.glossaryDialog.close());

els.restartBtn.addEventListener("click", () => {
  els.endDialog.close();
  location.reload();
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const codes = Object.keys(CELLS);
  const idx = Number(e.key) - 1;
  if (idx >= 0 && idx < codes.length) {
    selectedCell = selectedCell === codes[idx] ? null : codes[idx];
    removeMode = false;
    renderTray();
  }
  if (e.key === " ") {
    e.preventDefault();
    state.paused = !state.paused;
    render();
  }
});

/* ---------- boot ---------- */

log(state, "Welcome. You are the immune system. Read the briefing, then deploy.");
render();
openBriefing(1);
