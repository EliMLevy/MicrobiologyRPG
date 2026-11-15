// MicrobiologyRPG engine: real-time lane defense, 700ms ticks.
// The player is the immune system; invaders are real pathogens whose
// virulence factors are implemented as rules, not flavor text.
import { CELLS, PATHOGENS, WAVES, UPGRADES, TICK_MS, LANES, COLS } from "./data.js";

export const TICK = TICK_MS;

let invaderId = 0;

export function createGame() {
  return {
    phase: "menu", // menu | briefing | battle | shop | won | lost
    wave: 0,
    atp: 150,
    antigen: 0,
    coreHp: 100,
    maxCoreHp: 100,
    crp: 0,
    cells: new Map(), // "lane,col" -> cell instance
    invaders: [],
    antibodies: {}, // pathogen code -> 1 (active) | 0
    presented: {}, // pathogen code -> true (antigen presented this wave)
    presentedDone: new Set(), // codes presented this wave (DC presents once per code)
    memory: {}, // pathogen code -> true (defeated before)
    upgrades: {}, // upgrade key -> level
    spawnQueue: [],
    spawnTimer: 0,
    tick: 0,
    kills: 0,
    paused: false,
    speed: 1,
    endless: false,
    endlessCycle: 0,
    log: [],
  };
}

export function log(state, msg) {
  state.log.unshift(msg);
  if (state.log.length > 40) state.log.pop();
}

export function upgradeLevel(state, key) {
  return state.upgrades[key] || 0;
}

export function wavePathogen(state) {
  const w = WAVES[(state.wave - 1) % WAVES.length];
  return PATHOGENS[w.pathogen];
}

/* ---------- wave flow ---------- */

export function startWave(state, n) {
  const p = PATHOGENS[WAVES[(n - 1) % WAVES.length].pathogen];
  state.wave = n;
  state.phase = "battle";
  state.tick = 0;
  state.spawnTimer = 0;
  state.invaders = [];
  state.antibodies = {};
  state.presented = {};
  state.presentedDone = new Set();
  const count = p.count + (state.endless ? state.endlessCycle * 2 : 0);
  const lanes = [0, 1, 2];
  state.spawnQueue = [];
  for (let i = 0; i < count; i++) {
    state.spawnQueue.push({ code: p.code, lane: lanes[Math.floor(Math.random() * lanes.length)] });
  }
  // Mucosal barrier: invaders enter with less HP.
  const barrier = upgradeLevel(state, "barrier");
  state.spawnHpFactor = 1 - 0.1 * barrier;
  log(state, `Wave ${n}: ${p.name} is invading. ${WAVES[(n - 1) % WAVES.length].note}`);
}

export function endWave(state) {
  const p = wavePathogen(state);
  state.memory[p.code] = true;
  state.antigen += 5;
  state.atp += 50;
  // Tissue repair between waves.
  state.coreHp = Math.min(state.maxCoreHp, state.coreHp + 25);
  log(state, `${p.name} cleared. Host integrity recovered +25 from tissue repair.`);
  if (!state.endless && state.wave >= WAVES.length) {
    state.phase = "won";
    return;
  }
  state.phase = "shop";
}

export function nextWave(state) {
  startWave(state, state.wave + 1);
}

export function startEndless(state) {
  state.endless = true;
  state.endlessCycle = 1;
  state.phase = "shop";
}

/* ---------- placement ---------- */

export function canPlace(state, lane, col, code) {
  const def = CELLS[code];
  if (!def) return "Unknown cell.";
  if (state.cells.has(`${lane},${col}`)) return "Occupied.";
  if (state.atp < def.cost) return `Need ${def.cost} ATP.`;
  return null;
}

export function placeCell(state, lane, col, code) {
  const err = canPlace(state, lane, col, code);
  if (err) return err;
  const def = CELLS[code];
  state.atp -= def.cost;
  state.cells.set(`${lane},${col}`, {
    code, lane, col, hp: def.hp, maxHp: def.hp, age: 0,
    presented: false, plasma: false, plasmaAge: 0,
    infected: null, infectedTicks: 0,
  });
  log(state, `${def.name} deployed at lane ${lane + 1}, position ${col + 1}.`);
  return null;
}

export function removeCell(state, lane, col) {
  const key = `${lane},${col}`;
  if (!state.cells.has(key)) return;
  const c = state.cells.get(key);
  state.cells.delete(key);
  log(state, `${CELLS[c.code].name} removed.`);
}

/* ---------- abilities ---------- */

export function dnaseBurst(state) {
  if (state.phase !== "battle") return "DNase only works during a wave.";
  if (state.atp < 50) return "Need 50 ATP.";
  let cleared = 0;
  for (const inv of state.invaders) {
    if (inv.biofilm) {
      inv.biofilm = false;
      cleared++;
    }
  }
  state.atp -= 50;
  log(state, cleared ? `DNase burst stripped biofilm from ${cleared} invader${cleared === 1 ? "" : "s"}.` : "DNase burst fired — no biofilms on the field.");
  return null;
}

export function buyUpgrade(state, key) {
  const def = UPGRADES[key];
  if (!def) return "Unknown upgrade.";
  const level = upgradeLevel(state, key);
  if (level >= def.max) return "Already maxed.";
  const cost = def.cost(level);
  if (state.atp < cost.atp) return `Need ${cost.atp} ATP.`;
  if (state.antigen < cost.ag) return `Need ${cost.ag} antigen.`;
  state.atp -= cost.atp;
  state.antigen -= cost.ag;
  state.upgrades[key] = level + 1;
  log(state, `Researched: ${def.name} → level ${level + 1}.`);
  return null;
}

/* ---------- damage model ---------- */

function isOpsonizable(state, inv) {
  // Protein A blocks opsonization of S. aureus until countered.
  if (inv.code === "saureus" && !upgradeLevel(state, "proteinA")) return false;
  return true;
}

function antibodyBonus(state, code) {
  if (!state.antibodies[code]) return 0;
  return 0.5 + 0.25 * upgradeLevel(state, "affinity");
}

function damageToInvader(state, attacker, inv, baseDmg) {
  const p = PATHOGENS[inv.code];
  let dmg = baseDmg;
  const def = CELLS[attacker.code];

  // Memory: secondary response hits harder.
  if (state.memory[inv.code]) dmg *= 1 + 0.5 * upgradeLevel(state, "memoryCells");

  // Opsonization (antibodies) + complement.
  if (state.antibodies[inv.code] && isOpsonizable(state, inv)) {
    dmg *= 1 + antibodyBonus(state, inv.code);
    dmg *= 1 + 0.15 * upgradeLevel(state, "complement");
  }

  // M protein: phagocytes are half as effective unless the bacterium is opsonized.
  if (inv.code === "spyogenes" && def.kind === "phagocyte") {
    if (!(state.antibodies[inv.code] && isOpsonizable(state, inv))) dmg *= 0.5;
  }
  // Catalase blunts the neutrophil oxidative burst.
  if (inv.code === "saureus" && attacker.code === "neutrophil") dmg *= 0.75;
  // NS1 antagonizes interferon: NK cells are weaker vs influenza.
  if (inv.code === "influenza" && attacker.code === "nk") dmg *= 0.75;
  // Mycolic acid wall: all damage reduced.
  if (inv.code === "mtb") dmg *= 0.75;
  // Type III secretion disables adjacent immune cells.
  if (inv.code === "paeruginosa") dmg *= 0.75;
  // Biofilm: 60% damage reduction.
  if (inv.biofilm) dmg *= 0.4;
  // NK cells excel against viruses and infected cells.
  if (attacker.code === "nk" && (inv.code === "influenza" || inv.infectedCell)) dmg *= 1.5;
  // IFN-gamma activates macrophages.
  if (attacker.code === "macrophage") dmg *= 1 + 0.5 * upgradeLevel(state, "ifnGamma");
  // Neutrophil priming.
  if (attacker.code === "neutrophil") dmg += 4 * upgradeLevel(state, "neutrophilTraining");

  return Math.max(1, Math.round(dmg));
}

/**
 * Apply damage to an invader. Returns "dead" | "intracellular" | "alive".
 * "intracellular": M. tuberculosis survived inside the attacking phagocyte
 * instead of dying (phagosome arrest).
 */
function applyDamageToInvader(state, inv, dmg, attackerCell) {
  // Fibrin shield absorbs damage first.
  if (inv.shield > 0) {
    const absorbed = Math.min(inv.shield, dmg);
    inv.shield -= absorbed;
    dmg -= absorbed;
  }
  inv.hp -= dmg;
  if (inv.hp > 0) return "alive";

  // M. tuberculosis: a phagocyte's killing blow does not kill it — it
  // survives inside the phagocyte (phagosome arrest).
  if (
    inv.code === "mtb" && attackerCell &&
    (attackerCell.code === "macrophage" || attackerCell.code === "neutrophil")
  ) {
    attackerCell.infected = "mtb";
    attackerCell.infectedTicks = 0;
    log(state, `M. tuberculosis survived inside the ${CELLS[attackerCell.code].name} — phagosome-lysosome fusion blocked.`);
    return "intracellular";
  }
  return "dead";
}

function killInvader(state, inv, attackerCode) {
  state.invaders = state.invaders.filter((x) => x !== inv);
  state.kills++;
  state.atp += 15;
  if (attackerCode === "macrophage") {
    state.antigen += 1;
    log(state, `Macrophage digested ${PATHOGENS[inv.code].name} (+1 antigen).`);
  }
}

function consumeIntracellular(state, inv) {
  state.invaders = state.invaders.filter((x) => x !== inv);
}

/* ---------- the tick ---------- */

// Targeting: cells focus the invader closest to the core ("first" targeting),
// so a wounded invader gets finished instead of walking past while the cell
// switches to a fresher one that wandered nearer.
function nearestTargetInLane(state, lane, col, range, attacker) {
  let best = null;
  let bestCol = Infinity;
  for (const inv of state.invaders) {
    if (inv.lane !== lane) continue;
    const d = Math.abs(inv.col - col);
    if (d <= range && inv.col < bestCol) {
      best = inv;
      bestCol = inv.col;
    }
  }
  if (best) return { type: "invader", target: best };
  // NK / CD8 cells can also attack infected host cells in their lane.
  if (attacker.code === "nk" || attacker.code === "cd8") {
    for (const cell of state.cells.values()) {
      if (cell.lane !== lane || !cell.infected) continue;
      const d = Math.abs(cell.col - col);
      if (d <= range && cell.col < bestCol) {
        best = cell;
        bestCol = cell.col;
      }
    }
    if (best) return { type: "cell", target: best };
  }
  return null;
}

export function tick(state) {
  if (state.phase !== "battle" || state.paused) return;
  state.tick++;

  // ATP trickle.
  state.atp += 8;

  // Spawning.
  if (state.spawnQueue.length) {
    state.spawnTimer++;
    const interval = 3;
    if (state.spawnTimer >= interval) {
      state.spawnTimer = 0;
      const next = state.spawnQueue.shift();
      const p = PATHOGENS[next.code];
      const hp = Math.round(p.hp * state.spawnHpFactor);
      state.invaders.push({
        id: ++invaderId, code: next.code, lane: next.lane, col: COLS - 0.5,
        hp, maxHp: hp, shield: 0, age: 0, biofilm: false, drifted: false,
      });
    }
  }

  const feverSlow = 1 - 0.1 * upgradeLevel(state, "fever");

  // --- virulence timers ---
  for (const inv of state.invaders) {
    inv.age++;
    // Coagulase: fibrin shield every 10 ticks.
    if (inv.code === "saureus" && inv.age % 10 === 0) {
      inv.shield += 20;
      log(state, "S. aureus laid down a fibrin shield (+20 HP).");
    }
    // Biofilm formation.
    if (inv.code === "paeruginosa" && !inv.biofilm && inv.age >= 12 && !upgradeLevel(state, "dnase")) {
      inv.biofilm = true;
      log(state, "P. aeruginosa encased itself in biofilm — damage reduced 60%.");
    }
    // Antigenic drift: antibodies stop working.
    if (inv.code === "influenza" && !inv.drifted && inv.age >= 12) {
      inv.drifted = true;
      state.antibodies.influenza = 0;
      state.presented.influenza = false;
      log(state, "Antigenic drift! Influenza hemagglutinin changed — existing antibodies no longer recognize it.");
    }
  }

  // --- immune cells act ---
  const deadCells = [];
  for (const [key, cell] of state.cells) {
    const def = CELLS[cell.code];
    cell.age++;

    // Lifespan (neutrophil apoptosis).
    if (def.lifespan && cell.age >= def.lifespan) {
      deadCells.push(key);
      log(state, `${def.name} died by apoptosis.`);
      continue;
    }

    // Infected cells: flu bursts after 4 ticks, TB after 6.
    if (cell.infected) {
      cell.infectedTicks++;
      const burstAt = cell.infected === "influenza" ? 4 : 6;
      if (cell.infectedTicks >= burstAt) {
        deadCells.push(key);
        const p = PATHOGENS[cell.infected];
        for (let i = 0; i < 2; i++) {
          state.invaders.push({
            id: ++invaderId, code: cell.infected, lane: cell.lane, col: cell.col + 0.5,
            hp: Math.round(p.hp * state.spawnHpFactor), maxHp: Math.round(p.hp * state.spawnHpFactor),
            shield: 0, age: 0, biofilm: false, drifted: false,
          });
        }
        log(state, `Infected ${def.name} burst, releasing 2 ${p.name}.`);
        continue;
      }
    }

    // Dendritic cells present antigen (once per pathogen per wave).
    // They sample the whole field — DCs migrate to lymph nodes.
    if (cell.code === "dendritic" && cell.age >= 5 && !cell.presented) {
      const codes = [...new Set(state.invaders.map((i) => i.code))];
      for (const code of codes) {
        if (!state.presentedDone.has(code)) {
          state.presentedDone.add(code);
          state.presented[code] = true;
          state.antigen += 2;
          log(state, `Dendritic cell presented ${PATHOGENS[code].name} antigen (+2 antigen). B cells can now respond.`);
        }
      }
      cell.presented = true;
    }

    // B cells differentiate into plasma cells and secrete antibodies.
    if (cell.code === "bcell") {
      if (!cell.plasma) {
        const codes = Object.keys(state.presented).filter((c) => state.presented[c]);
        if (codes.length) {
          cell.plasmaAge++;
          if (cell.plasmaAge >= 3) {
            cell.plasma = true;
            log(state, "B cell differentiated into a plasma cell — antibody production online.");
          }
        }
      } else {
        for (const code of Object.keys(state.presented)) {
          if (state.presented[code]) state.antibodies[code] = 1;
        }
      }
    }

    // Attack.
    if (def.dmg > 0 && !cell.infected) {
      const hit = nearestTargetInLane(state, cell.lane, cell.col, def.range, cell);
      if (hit) {
        if (hit.type === "invader") {
          const inv = hit.target;
          const dmg = damageToInvader(state, cell, inv, def.dmg);
          const result = applyDamageToInvader(state, inv, dmg, cell);
          if (result === "dead") killInvader(state, inv, cell.code);
          else if (result === "intracellular") consumeIntracellular(state, inv);
        } else {
          // Attacking an infected host cell: killing it clears the pathogen inside.
          const target = hit.target;
          target.hp -= damageToInvader(state, cell, { code: "influenza", biofilm: false, infectedCell: true }, def.dmg);
          if (target.hp <= 0) {
            const k = `${target.lane},${target.col}`;
            state.cells.delete(k);
            log(state, `${def.name} destroyed an infected cell, clearing the pathogen inside.`);
          }
        }
      }
    }
  }
  for (const k of deadCells) state.cells.delete(k);

  // --- invaders move and attack ---
  const breached = [];
  for (const inv of state.invaders) {
    const p = PATHOGENS[inv.code];
    let speed = p.speed * feverSlow;
    if (state.antibodies[inv.code] && upgradeLevel(state, "classSwitch") && isOpsonizable(state, inv)) speed *= 0.8;
    inv.col -= speed;
    if (inv.col <= 0) {
      breached.push(inv);
      continue;
    }
    // Attack an adjacent immune cell.
    const cellCol = Math.floor(inv.col);
    const cell = state.cells.get(`${inv.lane},${cellCol}`);
    if (cell && !cell.infected) {
      let dmg = p.dmg;
      if (inv.code === "spyogenes") dmg += 3; // streptolysin O
      cell.hp -= dmg;
      if (cell.hp <= 0) {
        state.cells.delete(`${inv.lane},${cellCol}`);
        log(state, `${CELLS[cell.code].name} was lysed by ${p.name}.`);
      } else if (inv.code === "influenza" && Math.random() < 0.2) {
        cell.infected = "influenza";
        cell.infectedTicks = 0;
        log(state, `Influenza infected a ${CELLS[cell.code].name}.`);
      }
    }
  }
  for (const inv of breached) {
    state.invaders = state.invaders.filter((x) => x !== inv);
    const p = PATHOGENS[inv.code];
    state.coreHp -= p.coreDmg;
    state.crp += 10;
    log(state, `${p.name} breached the core! Host integrity −${p.coreDmg}.`);
    if (state.coreHp <= 0) {
      state.coreHp = 0;
      state.phase = "lost";
      return;
    }
  }

  // Complement DoT on opsonized invaders.
  const comp = upgradeLevel(state, "complement");
  if (comp > 0) {
    for (const inv of [...state.invaders]) {
      if (state.antibodies[inv.code] && isOpsonizable(state, inv)) {
        const result = applyDamageToInvader(state, inv, comp * 2, null);
        if (result === "dead") killInvader(state, inv, null);
        else if (result === "intracellular") consumeIntracellular(state, inv);
      }
    }
  }

  // Vitals.
  state.crp = Math.max(0, state.crp - 0.5 + state.invaders.length * 0.2);

  // Wave cleared?
  if (!state.spawnQueue.length && !state.invaders.length) {
    endWave(state);
  }
}
