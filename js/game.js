// MicrobiologyRPG v2 engine: free-placement tower defense on a canvas.
// dt-based (seconds), no DOM — the UI renders state onto a canvas.
// Enemies walk a winding path through tissue toward the heart.
import { TOWERS, PATHOGENS, WAVES, UPGRADES, PATH, W, H } from "./data.js";

/* ---------- path geometry ---------- */

const SEGMENTS = [];
let PATH_LENGTH = 0;
{
  let acc = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    SEGMENTS.push({ a, b, len, start: acc });
    acc += len;
  }
  PATH_LENGTH = acc;
}

export function pathPoint(dist) {
  const d = Math.max(0, Math.min(PATH_LENGTH, dist));
  for (const s of SEGMENTS) {
    if (d <= s.start + s.len) {
      const f = (d - s.start) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
    }
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  return { x: last.b.x, y: last.b.y };
}

export function distToPath(x, y) {
  let best = Infinity;
  let bestDist = 0;
  for (const s of SEGMENTS) {
    const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((x - s.a.x) * dx + (y - s.a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = s.a.x + dx * t, py = s.a.y + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      bestDist = s.start + t * s.len;
    }
  }
  return { dist: best, along: bestDist };
}

let nextId = 1;

export function createGame() {
  return {
    phase: "menu",
    wave: 0,
    time: 0,
    atp: 150,
    antigen: 0,
    coreHp: 100,
    maxCoreHp: 100,
    crp: 0,
    towers: [], // {id, code, x, y, hp, maxHp, cooldown, age, plasma, plasmaAge, presented, infected, infectedTimer, marrowTimer}
    enemies: [], // {id, code, dist, hp, maxHp, shield, age, biofilm, drifted, slowFactor}
    roamers: [], // {id, code, x, y, hp, maxHp, age, cooldown, infected, infectedTimer}
    tracers: [], // {x1,y1,x2,y2,life}
    particles: [], // {x,y,life,color}
    antibodies: {},
    presented: {},
    presentedDone: new Set(),
    memory: {},
    upgrades: {},
    spawnQueue: [],
    spawnTimer: 0,
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
  return PATHOGENS[WAVES[(state.wave - 1) % WAVES.length].pathogen];
}

/* ---------- waves ---------- */

export function startWave(state, n) {
  const p = PATHOGENS[WAVES[(n - 1) % WAVES.length].pathogen];
  state.wave = n;
  state.phase = "battle";
  state.time = 0;
  state.spawnTimer = 0;
  state.enemies = [];
  state.antibodies = {};
  state.presented = {};
  state.presentedDone = new Set();
  const count = p.count + (state.endless ? state.endlessCycle * 2 : 0);
  state.spawnQueue = Array.from({ length: count }, () => p.code);
  // Invaders get tougher each wave (+30% HP per wave) on top of the barrier.
  state.spawnHpFactor = (1 - 0.1 * upgradeLevel(state, "barrier")) * (1 + 0.3 * (n - 1));
  // Dendritic cells must present the new invader's antigen each wave.
  for (const t of state.towers) {
    t.presented = false;
    if (!t.plasma) t.plasmaAge = 0;
  }
  log(state, `Wave ${n}: ${p.name} is invading. ${WAVES[(n - 1) % WAVES.length].note}`);
}

export function endWave(state) {
  const p = wavePathogen(state);
  state.memory[p.code] = true;
  state.antigen += 5;
  state.atp += 100;
  state.coreHp = Math.min(state.maxCoreHp, state.coreHp + 25);
  log(state, `${p.name} cleared. Memory cells banked — the secondary response will be stronger next time. Host integrity +25.`);
  if (!state.endless && state.wave >= WAVES.length) {
    state.phase = "won";
    return;
  }
  state.phase = "shop";
}

export function startEndless(state) {
  state.endless = true;
  state.endlessCycle = 1;
  state.phase = "shop";
}

/* ---------- placement ---------- */

export function canPlace(state, code, x, y) {
  const def = TOWERS[code];
  if (!def) return "Unknown tower.";
  if (x < 20 || x > W - 20 || y < 20 || y > H - 20) return "Out of bounds.";
  if (Math.hypot(x - 48, y - 270) < 60) return "Too close to the heart.";
  const near = distToPath(x, y);
  if (code === "skin") {
    if (near.dist > 70) return "Skin barriers go on the path — place it over the invasion route.";
  } else if (near.dist < 34) {
    return "Too close to the path — towers go in the tissue beside it.";
  }
  for (const t of state.towers) {
    if (Math.hypot(t.x - x, t.y - y) < TOWERS[t.code].radius + def.radius + 6) return "Too close to another structure.";
  }
  if (def.max) {
    const n = state.towers.filter((t) => t.code === code).length;
    if (n >= def.max) return `At most ${def.max} ${def.name}s.`;
  }
  if (state.atp < def.cost) return `Need ${def.cost} ATP.`;
  return null;
}

export function placeTower(state, code, x, y) {
  const err = canPlace(state, code, x, y);
  if (err) return err;
  const def = TOWERS[code];
  state.atp -= def.cost;
  state.towers.push({
    id: nextId++, code, x, y,
    hp: def.hp, maxHp: def.hp,
    cooldown: 0, age: 0, plasma: false, plasmaAge: 0,
    presented: false, infected: null, infectedTimer: 0, marrowTimer: 0,
  });
  log(state, `${def.name} placed.`);
  return null;
}

export function removeTower(state, id) {
  const i = state.towers.findIndex((t) => t.id === id);
  if (i < 0) return;
  log(state, `${TOWERS[state.towers[i].code].name} removed.`);
  state.towers.splice(i, 1);
}

export function towerAt(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const t of state.towers) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < TOWERS[t.code].radius + 6 && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}

/* ---------- abilities & shop ---------- */

export function dnaseBurst(state) {
  if (state.phase !== "battle") return "DNase only works during a wave.";
  if (state.atp < 50) return "Need 50 ATP.";
  let cleared = 0;
  for (const e of state.enemies) {
    if (e.biofilm) {
      e.biofilm = false;
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

function isOpsonizable(state, enemy) {
  if (enemy.code === "saureus" && !upgradeLevel(state, "proteinA")) return false;
  return true;
}

function antibodyBonus(state, code) {
  if (!state.antibodies[code]) return 0;
  return 0.5 + 0.25 * upgradeLevel(state, "affinity");
}

function damageToEnemy(state, attacker, enemy, baseDmg) {
  let dmg = baseDmg;
  const def = TOWERS[attacker.code];
  if (state.memory[enemy.code]) dmg *= 1 + 0.5 * upgradeLevel(state, "memoryCells");
  if (state.antibodies[enemy.code] && isOpsonizable(state, enemy)) {
    dmg *= 1 + antibodyBonus(state, enemy.code);
    dmg *= 1 + 0.15 * upgradeLevel(state, "complement");
  }
  if (enemy.code === "spyogenes" && def && def.kind === "phagocyte") {
    if (!(state.antibodies[enemy.code] && isOpsonizable(state, enemy))) dmg *= 0.5;
  }
  if (enemy.code === "saureus" && attacker.code === "neutrophil") dmg *= 0.75;
  if (enemy.code === "influenza" && attacker.code === "nk") dmg *= 0.75;
  if (enemy.code === "mtb") dmg *= 0.75;
  if (enemy.code === "paeruginosa") dmg *= 0.75;
  if (enemy.biofilm) dmg *= 0.4;
  if (attacker.code === "nk" && (enemy.code === "influenza" || enemy.infectedCell)) dmg *= 1.5;
  if (attacker.code === "macrophage") dmg *= 1 + 0.5 * upgradeLevel(state, "ifnGamma");
  if (attacker.code === "neutrophil") dmg += 4 * upgradeLevel(state, "neutrophilTraining");
  return Math.max(1, Math.round(dmg));
}

/**
 * Apply damage. Returns "dead" | "intracellular" | "alive".
 * "intracellular": M. tuberculosis survived inside the attacking phagocyte.
 */
function applyDamage(state, enemy, dmg, attacker) {
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, dmg);
    enemy.shield -= absorbed;
    dmg -= absorbed;
  }
  enemy.hp -= dmg;
  if (enemy.hp > 0) return "alive";
  if (
    enemy.code === "mtb" && attacker &&
    (attacker.code === "macrophage" || attacker.code === "neutrophil")
  ) {
    attacker.infected = "mtb";
    attacker.infectedTimer = 0;
    log(state, `M. tuberculosis survived inside the ${TOWERS[attacker.code].name} — phagosome-lysosome fusion blocked.`);
    return "intracellular";
  }
  return "dead";
}

function killEnemy(state, enemy, attackerCode) {
  state.enemies = state.enemies.filter((x) => x !== enemy);
  state.kills++;
  state.atp += 12;
  const p = enemyPos(enemy);
  state.particles.push({ x: p.x, y: p.y, life: 0.4, color: PATHOGENS[enemy.code].color });
  if (attackerCode === "macrophage") {
    state.antigen += 1;
    log(state, `Macrophage digested ${PATHOGENS[enemy.code].name} (+1 antigen).`);
  }
}

function consumeIntracellular(state, enemy) {
  state.enemies = state.enemies.filter((x) => x !== enemy);
}

export function enemyPos(enemy) {
  return pathPoint(enemy.dist);
}

function releaseOntoPath(state, code, x, y, count) {
  const near = distToPath(x, y);
  const p = PATHOGENS[code];
  for (let i = 0; i < count; i++) {
    const hp = Math.round(p.hp * state.spawnHpFactor);
    state.enemies.push({
      id: nextId++, code, dist: Math.max(0, near.along - i * 20),
      hp, maxHp: hp, shield: 0, age: 0, biofilm: false, drifted: false, slowFactor: 1,
    });
  }
}

/* ---------- targeting ---------- */

function targetInRange(state, x, y, range) {
  let best = null;
  let bestDist = -Infinity;
  for (const e of state.enemies) {
    const p = enemyPos(e);
    if (Math.hypot(p.x - x, p.y - y) <= range && e.dist > bestDist) {
      best = e;
      bestDist = e.dist;
    }
  }
  return best;
}

function infectedTargetInRange(state, x, y, range) {
  // CD8/NK can destroy infected towers and roamers, clearing the pathogen.
  let best = null;
  let bestD = Infinity;
  for (const t of state.towers) {
    if (!t.infected) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= range && d < bestD) {
      best = { type: "tower", obj: t };
      bestD = d;
    }
  }
  for (const r of state.roamers) {
    if (!r.infected) continue;
    const d = Math.hypot(r.x - x, r.y - y);
    if (d <= range && d < bestD) {
      best = { type: "roamer", obj: r };
      bestD = d;
    }
  }
  return best;
}

/* ---------- the step ---------- */

export function step(state, dt) {
  if (state.phase !== "battle" || state.paused) return;
  dt = Math.min(dt, 0.1);
  state.time += dt;
  state.atp += 1.5 * dt;

  // Spawning. Later waves arrive faster — the stream has to approach
  // the defense's throughput, or nothing ever leaks.
  if (state.spawnQueue.length) {
    state.spawnTimer += dt;
    const base = wavePathogen(state).code === "influenza" ? 1.3 : 1.6;
    const interval = Math.max(0.7, base * (1 - 0.12 * (state.wave - 1)));
    if (state.spawnTimer >= interval) {
      state.spawnTimer = 0;
      const code = state.spawnQueue.shift();
      const p = PATHOGENS[code];
      const hp = Math.round(p.hp * state.spawnHpFactor);
      state.enemies.push({
        id: nextId++, code, dist: 0,
        hp, maxHp: hp, shield: 0, age: 0, biofilm: false, drifted: false, slowFactor: 1,
      });
    }
  }

  const feverSlow = 1 - 0.1 * upgradeLevel(state, "fever");

  // --- enemy virulence timers ---
  for (const e of state.enemies) {
    e.age += dt;
    if (e.code === "saureus" && e.age >= 10 && Math.floor(e.age / 10) > Math.floor((e.age - dt) / 10)) {
      e.shield += 20;
      log(state, "S. aureus laid down a fibrin shield (+20 HP).");
    }
    if (e.code === "paeruginosa" && !e.biofilm && e.age >= 12 && !upgradeLevel(state, "dnase")) {
      e.biofilm = true;
      log(state, "P. aeruginosa encased itself in biofilm — damage reduced 60%.");
    }
    if (e.code === "influenza" && !e.drifted && e.age >= 12) {
      e.drifted = true;
      state.antibodies.influenza = 0;
      state.presented.influenza = false;
      log(state, "Antigenic drift! Influenza hemagglutinin changed — existing antibodies no longer recognize it.");
    }
    e.opsonized = !!(state.antibodies[e.code] && isOpsonizable(state, e));
  }

  // --- towers act ---
  const deadTowers = [];
  for (const t of state.towers) {
    const def = TOWERS[t.code];
    t.age += dt;

    // Neutrophil apoptosis.
    if (def.lifespan && t.age >= def.lifespan) {
      deadTowers.push(t);
      log(state, `${def.name} died by apoptosis.`);
      continue;
    }

    // Infected towers: stop firing, burst after 6 s.
    if (t.infected) {
      t.infectedTimer += dt;
      if (t.infectedTimer >= 6) {
        deadTowers.push(t);
        releaseOntoPath(state, t.infected, t.x, t.y, 2);
        log(state, `Infected ${def.name} burst, releasing 2 ${PATHOGENS[t.infected].name}.`);
      }
      continue;
    }

    // Dendritic cells present antigen (once per pathogen per wave).
    // They sample the whole field — DCs migrate to lymph nodes.
    if (t.code === "dendritic" && t.age >= 5 && !t.presented) {
      const codes = [...new Set(state.enemies.map((e) => e.code))];
      if (codes.length) {
        for (const code of codes) {
          if (!state.presentedDone.has(code)) {
            state.presentedDone.add(code);
            state.presented[code] = true;
            state.antigen += 2;
            log(state, `Dendritic cell presented ${PATHOGENS[code].name} antigen (+2 antigen). B cells can now respond.`);
          }
        }
        t.presented = true;
      }
    }

    // B cells become plasma cells and secrete antibodies.
    if (t.code === "bcell") {
      if (!t.plasma) {
        if (Object.values(state.presented).some(Boolean)) {
          t.plasmaAge += dt;
          if (t.plasmaAge >= 6) {
            t.plasma = true;
            log(state, "B cell differentiated into a plasma cell — antibody production online.");
          }
        }
      } else {
        for (const code of Object.keys(state.presented)) {
          if (state.presented[code]) state.antibodies[code] = 1;
        }
      }
    }

    // Bone marrow releases a roaming white blood cell.
    if (t.code === "marrow") {
      t.marrowTimer += dt;
      if (t.marrowTimer >= def.rate) {
        t.marrowTimer = 0;
        const roamerCode = state.roamers.filter((r) => r.code === "neutrophil").length <=
          state.roamers.filter((r) => r.code === "macrophage").length
          ? "neutrophil" : "macrophage";
        const rd = TOWERS[roamerCode];
        state.roamers.push({
          id: nextId++, code: roamerCode, x: t.x, y: t.y,
          hp: rd.hp, maxHp: rd.hp, age: 0, cooldown: 0,
          infected: null, infectedTimer: 0,
        });
        log(state, `Bone marrow released a ${rd.name} into the tissue.`);
      }
    }

    // Skin barriers are passive zones (handled in enemy movement).
    if (t.code === "skin" || def.dmg <= 0) continue;

    // Attack: first (furthest along the path) in range; else an infected cell.
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const target = targetInRange(state, t.x, t.y, def.range);
    if (target) {
      const p = enemyPos(target);
      state.tracers.push({ x1: t.x, y1: t.y, x2: p.x, y2: p.y, life: 0.12 });
      const dmg = damageToEnemy(state, t, target, def.dmg);
      const result = applyDamage(state, target, dmg, t);
      if (result === "dead") killEnemy(state, target, t.code);
      else if (result === "intracellular") consumeIntracellular(state, target);
      t.cooldown = def.rate;
      continue;
    }
    if (t.code === "cd8" || t.code === "nk") {
      const inf = infectedTargetInRange(state, t.x, t.y, def.range);
      if (inf) {
        const o = inf.obj;
        state.tracers.push({ x1: t.x, y1: t.y, x2: o.x, y2: o.y, life: 0.12 });
        o.hp -= damageToEnemy(state, t, { code: "influenza", biofilm: false, infectedCell: true }, def.dmg);
        if (o.hp <= 0) {
          if (inf.type === "tower") {
            deadTowers.push(o);
            log(state, `${def.name} destroyed an infected cell, clearing the pathogen inside.`);
          } else {
            state.roamers = state.roamers.filter((r) => r !== o);
            log(state, `${def.name} destroyed an infected cell, clearing the pathogen inside.`);
          }
        }
        t.cooldown = def.rate;
      }
    }
  }
  for (const t of deadTowers) {
    state.towers = state.towers.filter((x) => x !== t);
  }

  // --- roamers act ---
  const deadRoamers = [];
  for (const r of state.roamers) {
    const def = TOWERS[r.code];
    r.age += dt;
    if (r.age >= 25) {
      deadRoamers.push(r);
      continue;
    }
    if (r.infected) {
      r.infectedTimer += dt;
      if (r.infectedTimer >= 4) {
        deadRoamers.push(r);
        releaseOntoPath(state, r.infected, r.x, r.y, 2);
        log(state, `Infected ${def.name} burst, releasing 2 ${PATHOGENS[r.infected].name}.`);
      }
      continue;
    }
    // Chase the nearest enemy.
    let nearest = null;
    let nearestD = Infinity;
    for (const e of state.enemies) {
      const p = enemyPos(e);
      const d = Math.hypot(p.x - r.x, p.y - r.y);
      if (d < nearestD) {
        nearest = e;
        nearestD = d;
      }
    }
    if (!nearest) continue;
    const p = enemyPos(nearest);
    const d = Math.hypot(p.x - r.x, p.y - r.y);
    if (d > 20) {
      const sp = 60;
      r.x += ((p.x - r.x) / d) * sp * dt;
      r.y += ((p.y - r.y) / d) * sp * dt;
    } else {
      r.cooldown -= dt;
      if (r.cooldown <= 0) {
        const dmg = damageToEnemy(state, r, nearest, r.code === "macrophage" ? 14 : 8);
        const result = applyDamage(state, nearest, dmg, r);
        if (result === "dead") killEnemy(state, nearest, r.code);
        else if (result === "intracellular") consumeIntracellular(state, nearest);
        r.cooldown = r.code === "macrophage" ? 1.0 : 0.6;
      }
    }
  }
  for (const r of deadRoamers) {
    state.roamers = state.roamers.filter((x) => x !== r);
  }

  // --- enemies move, chew towers, infect roamers ---
  const breached = [];
  for (const e of state.enemies) {
    const p = PATHOGENS[e.code];
    let speed = p.speed * feverSlow;
    if (e.opsonized && upgradeLevel(state, "classSwitch") && isOpsonizable(state, e)) speed *= 0.8;
    // Skin barrier zones slow and damage.
    let inSkin = false;
    for (const t of state.towers) {
      if (t.code !== "skin") continue;
      const pos = enemyPos(e);
      if (Math.hypot(pos.x - t.x, pos.y - t.y) <= TOWERS.skin.range) {
        inSkin = true;
        break;
      }
    }
    if (inSkin) {
      speed *= 0.6;
      e.slowFactor = 0.6;
      const result = applyDamage(state, e, 4 * dt, null);
      if (result === "dead") {
        killEnemy(state, e, null);
        continue;
      }
      if (result === "intracellular") {
        consumeIntracellular(state, e);
        continue;
      }
    } else {
      e.slowFactor = 1;
    }
    e.dist += speed * dt;
    if (e.dist >= PATH_LENGTH) {
      breached.push(e);
      continue;
    }
    // Chew adjacent towers (half rate — towers at minimum placement
    // distance should survive a wave, not melt).
    const pos = enemyPos(e);
    for (const t of [...state.towers]) {
      if (t.code === "skin") continue;
      if (Math.hypot(pos.x - t.x, pos.y - t.y) <= TOWERS[t.code].radius + 14) {
        let dmg = p.dmg * 0.5;
        if (e.code === "spyogenes") dmg += 1; // streptolysin O
        t.hp -= dmg * dt;
        if (t.hp <= 0) {
          state.towers = state.towers.filter((x) => x !== t);
          log(state, `${TOWERS[t.code].name} was lysed by ${p.name}.`);
        }
      }
    }
    // Infect roaming cells on contact.
    if (e.code === "influenza") {
      for (const r of state.roamers) {
        if (r.infected) continue;
        if (Math.hypot(pos.x - r.x, pos.y - r.y) <= 22 && Math.random() < 0.2 * dt) {
          r.infected = "influenza";
          r.infectedTimer = 0;
          log(state, `Influenza infected a roaming ${TOWERS[r.code].name}.`);
        }
      }
    }
  }
  for (const e of breached) {
    state.enemies = state.enemies.filter((x) => x !== e);
    const p = PATHOGENS[e.code];
    state.coreHp -= p.coreDmg;
    state.crp += 10;
    log(state, `${p.name} reached the heart! Host integrity −${p.coreDmg}.`);
    if (state.coreHp <= 0) {
      state.coreHp = 0;
      state.phase = "lost";
      return;
    }
  }

  // Complement DoT on opsonized invaders.
  const comp = upgradeLevel(state, "complement");
  if (comp > 0) {
    for (const e of [...state.enemies]) {
      if (e.opsonized) {
        const result = applyDamage(state, e, comp * 2 * dt, null);
        if (result === "dead") killEnemy(state, e, null);
        else if (result === "intracellular") consumeIntracellular(state, e);
      }
    }
  }

  // Vitals.
  state.crp = Math.max(0, state.crp - 0.5 * dt + state.enemies.length * 0.05 * dt);

  // Visuals decay.
  for (const tr of state.tracers) tr.life -= dt;
  state.tracers = state.tracers.filter((tr) => tr.life > 0);
  for (const pt of state.particles) pt.life -= dt;
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // Wave cleared?
  if (!state.spawnQueue.length && !state.enemies.length) {
    endWave(state);
  }
}
