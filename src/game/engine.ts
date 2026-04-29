import type { GameState, Defender, Pathogen, Projectile, Effect, AtpDrop, DefenderType, PathogenType } from "./types";
import { DEFENDERS, PATHOGENS, ROWS, COLS, CELL_W, CELL_H, GRID_OFFSET_X, GRID_OFFSET_Y, STARTING_ATP, ATP_AUTO_INTERVAL, INFLAMMATION_THRESHOLD, INFLAMMATION_SLOW, INFLAMMATION_ATP_PENALTY, WAVES } from "./config";
import { cellCenter } from "./draw";
import { playSound, stopBackground } from "./audio";

let nextId = 1;
const id = () => nextId++;

export function createInitialState(): GameState {
  nextId = 1;
  return {
    atp: STARTING_ATP,
    wave: 0,
    waveProgress: 0,
    inWave: false,
    spawnQueue: [],
    spawnTimer: 0,
    defenders: [],
    pathogens: [],
    projectiles: [],
    effects: [],
    drops: [],
    selectedType: null,
    cooldowns: {},
    inflammation: new Array(ROWS).fill(0),
    warningRow: null,
    warningTime: 0,
    status: "menu",
    time: 0,
    lastAtpAuto: 0,
    hoveredCell: null,
    paused: false,
    awaitingNextWave: false,
  };
}

export function startWave(s: GameState, wave: number) {
  s.wave = wave;
  s.inWave = true;
  s.waveProgress = 0;
  s.spawnQueue = [];
  s.spawnTimer = s.time;
  const def = WAVES[Math.min(wave - 1, WAVES.length - 1)];
  let cumulativeDelay = 0;
  for (const group of def) {
    for (let i = 0; i < group.count; i++) {
      const row = group.rows ? group.rows[i % group.rows.length] : Math.floor(Math.random() * ROWS);
      cumulativeDelay = i === 0 ? group.delay : cumulativeDelay + group.spacing;
      s.spawnQueue.push({ type: group.type, row, delay: cumulativeDelay });
    }
    cumulativeDelay = 0;
  }
  // Sort by delay
  s.spawnQueue.sort((a, b) => a.delay - b.delay);
  try { playSound("wave_start"); } catch (e) {}
}

export function placeDefender(s: GameState, type: DefenderType, row: number, col: number): boolean {
  const cfg = DEFENDERS[type];
  if (s.atp < cfg.cost) return false;
  if ((s.cooldowns[type] ?? 0) > s.time) return false;
  // No stacking
  if (s.defenders.some((d) => d.row === row && d.col === col)) return false;

  s.atp -= cfg.cost;
  s.cooldowns[type] = s.time + cfg.cooldown;
  s.defenders.push({
    id: id(),
    type,
    row,
    col,
    hp: cfg.hp,
    maxHp: cfg.hp,
    lastAction: s.time,
    state: "idle",
    data: type === "tcell" ? { armed: 0, armTime: s.time + 1500 } : {},
  });
  // Update inflammation immediately
  recomputeInflammation(s);
  try { playSound("place"); } catch (e) {}
  return true;
}

export function recomputeInflammation(s: GameState) {
  const counts = new Array(ROWS).fill(0);
  for (const d of s.defenders) {
    counts[d.row]++;
  }
  for (let r = 0; r < ROWS; r++) {
    const wasInflamed = s.inflammation[r] >= INFLAMMATION_THRESHOLD;
    s.inflammation[r] = counts[r];
    const nowInflamed = counts[r] >= INFLAMMATION_THRESHOLD;
    if (!wasInflamed && nowInflamed) {
      s.warningRow = r;
      s.warningTime = s.time + 2000;
    }
  }
}

export function spawnPathogen(s: GameState, type: PathogenType, row: number) {
  const cfg = PATHOGENS[type];
  s.pathogens.push({
    id: id(),
    type,
    row,
    x: GRID_OFFSET_X + COLS * CELL_W + 30,
    hp: cfg.hp,
    maxHp: cfg.hp,
    speed: cfg.speed,
    damage: cfg.damage,
    reward: cfg.reward,
    attackingId: null,
    lastAttack: 0,
    slowUntil: 0,
    burnUntil: 0,
    burnTick: 0,
    pulse: 0,
  });
  try { playSound("spawn"); } catch (e) {}
}

export function tick(s: GameState, dt: number) {
  if (s.status !== "playing" || s.paused) return;
  s.time += dt;

  // Wave spawning
  if (s.inWave && s.spawnQueue.length > 0) {
    while (s.spawnQueue.length > 0 && s.time - s.spawnTimer >= s.spawnQueue[0].delay) {
      const sp = s.spawnQueue.shift()!;
      spawnPathogen(s, sp.type, sp.row);
    }
  }
  if (s.inWave && s.spawnQueue.length === 0 && s.pathogens.length === 0) {
    s.inWave = false;
    if (s.wave >= WAVES.length) {
      s.status = "won";
      try { playSound("win"); } catch (e) {}
      try { stopBackground(); } catch (e) {}
      return;
    }
    // Pause and await player to begin next wave; don't auto-award ATP to increase difficulty
    s.awaitingNextWave = true;
    s.paused = true;
    s.effects.push({
      id: id(),
      type: "text",
      x: GRID_OFFSET_X + COLS * CELL_W / 2,
      y: GRID_OFFSET_Y + (ROWS * CELL_H) / 2,
      age: 0,
      duration: 2000,
      color: "#ffd700",
      text: `Wave ${s.wave} cleared!`,
    });
  }

  // Update defenders
  for (const d of s.defenders) {
    updateDefender(s, d);
  }

  // Update pathogens
  for (const p of s.pathogens) {
    updatePathogen(s, p, dt);
  }

  // Update projectiles
  for (const proj of s.projectiles) {
    proj.x += proj.vx * (dt / 1000);
    // Hit detection
    for (const p of s.pathogens) {
      if (p.row !== proj.row) continue;
      const cfg = PATHOGENS[p.type];
      const dx = p.x - proj.x;
      if (Math.abs(dx) < cfg.size * 0.5 + 6) {
        p.hp -= proj.damage;
        if (proj.effect === "slow") p.slowUntil = s.time + 3000;
        if (proj.effect === "burn") {
          p.burnUntil = s.time + 4000;
          p.burnTick = s.time;
        }
        s.effects.push({
          id: id(),
          type: "splash",
          x: proj.x,
          y: proj.y,
          age: 0,
          duration: 250,
          color: proj.color,
        });
        proj.x = -9999;
        try { playSound("hit"); } catch (e) {}
        break;
      }
    }
  }

  // Cleanup
  s.projectiles = s.projectiles.filter((p) => p.x > GRID_OFFSET_X - 50 && p.x < GRID_OFFSET_X + COLS * CELL_W + 50);
  s.pathogens = s.pathogens.filter((p) => {
    if (p.hp <= 0) {
      s.atp += p.reward;
      s.effects.push({
        id: id(),
        type: "atp",
        x: p.x,
        y: GRID_OFFSET_Y + p.row * CELL_H + CELL_H / 2 - 20,
        age: 0,
        duration: 1000,
        color: "#ffd700",
        text: `${p.reward}`,
      });
      s.effects.push({
        id: id(),
        type: "splash",
        x: p.x,
        y: GRID_OFFSET_Y + p.row * CELL_H + CELL_H / 2,
        age: 0,
        duration: 400,
        color: "#ff6060",
      });
      try { playSound("pathogen_die"); } catch (e) {}
      return false;
    }
    return true;
  });
  s.defenders = s.defenders.filter((d) => {
    if (d.hp <= 0) {
      s.effects.push({
        id: id(),
        type: "splash",
        x: cellCenter(d.row, d.col).x,
        y: cellCenter(d.row, d.col).y,
        age: 0,
        duration: 400,
        color: "#aa6060",
      });
      // Reset attackers targeting this defender
      for (const p of s.pathogens) {
        if (p.attackingId === d.id) p.attackingId = null;
      }
      try { playSound("defender_die"); } catch (e) {}
      return false;
    }
    return true;
  });
  // Recompute inflammation when defenders change
  if (s.defenders.length !== s.inflammation.reduce((a, b) => a + b, 0)) {
    recomputeInflammation(s);
  }

  // Update effects
  for (const e of s.effects) e.age += dt;
  s.effects = s.effects.filter((e) => e.age < e.duration);

  // Update ATP drops (auto-collect after 8s)
  for (const d of s.drops) {
    d.age += dt;
    if (d.y < d.targetY) {
      d.y = Math.min(d.targetY, d.y + d.vy * (dt / 1000));
    }
  }
  s.drops = s.drops.filter((d) => d.age < 12000);

  // Lose condition
  for (const p of s.pathogens) {
    if (p.x < GRID_OFFSET_X - 20) {
      s.status = "lost";
      try { playSound("lose"); } catch (e) {}
      try { stopBackground(); } catch (e) {}
      return;
    }
  }
}

function updateDefender(s: GameState, d: Defender) {
  const cfg = DEFENDERS[d.type];
  const center = cellCenter(d.row, d.col);
  const inflamed = s.inflammation[d.row] >= INFLAMMATION_THRESHOLD;

  switch (d.type) {
    case "stem": {
      // Generates ATP every 8s (or 12s if inflamed)
      const interval = inflamed ? ATP_AUTO_INTERVAL / INFLAMMATION_ATP_PENALTY : ATP_AUTO_INTERVAL;
      if (s.time - d.lastAction >= interval) {
        d.lastAction = s.time;
        // Drop ATP near the cell
        s.drops.push({
          id: id(),
          x: center.x + (Math.random() - 0.5) * 40,
          y: center.y - 30,
          vy: 60,
          targetY: center.y + 25,
          age: 0,
          amount: 25,
          spawnedAt: s.time,
        });
      }
      break;
    }
    case "neutrophil": {
      // Shoots if pathogen in same row to the right
      if (s.time - d.lastAction >= 1500) {
        const hasTarget = s.pathogens.some((p) => p.row === d.row && p.x > center.x && p.x < GRID_OFFSET_X + COLS * CELL_W + 30);
        if (hasTarget) {
          d.lastAction = s.time;
          s.projectiles.push({
            id: id(),
            row: d.row,
            x: center.x + 18,
            y: center.y,
            vx: 320,
            damage: 25,
            kind: "antibody",
            color: "#a8d8ff",
          });
          try { playSound("defender_shoot"); } catch (e) {}
        }
      }
      break;
    }
    case "eosinophil": {
      // Eats pathogen in front (within ~1.5 cells), 4s cooldown to chew
      if (d.state === "chewing") {
        if (s.time - d.lastAction >= 4000) {
          d.state = "idle";
        }
        break;
      }
      const target = s.pathogens.find(
        (p) => p.row === d.row && p.x > center.x - 10 && p.x < center.x + CELL_W * 1.2,
      );
      if (target) {
        target.hp -= 250;
        d.state = "chewing";
        d.lastAction = s.time;
        s.effects.push({
          id: id(),
          type: "splash",
          x: target.x,
          y: center.y,
          age: 0,
          duration: 350,
          color: "#ff8080",
        });
        try { playSound("defender_melee"); } catch (e) {}
      }
      break;
    }
    case "basophil": {
      // Releases spore cloud in 3-tile area in front every 4s
      if (s.time - d.lastAction >= 4000) {
        const targetX = center.x + CELL_W * 1.5;
        const hasTarget = s.pathogens.some(
          (p) => p.row === d.row && p.x > center.x && p.x < targetX + CELL_W,
        );
        if (hasTarget) {
          d.lastAction = s.time;
          s.effects.push({
            id: id(),
            type: "spore-cloud",
            x: targetX,
            y: center.y,
            age: 0,
            duration: 1500,
            color: "rgba(155, 89, 182, 0.6)",
            radius: CELL_W * 1.4,
            row: d.row,
            damage: 10,
            hit: new Set(),
          });
          try { playSound("basophil_release"); } catch (e) {}
        }
      }
      // Apply spore cloud damage tick
      for (const e of s.effects) {
        if (e.type === "spore-cloud" && e.row === d.row) {
          for (const p of s.pathogens) {
            if (p.row !== e.row) continue;
            const dx = p.x - e.x;
            if (Math.abs(dx) < (e.radius ?? 50)) {
              if (e.age - (e.hit?.size || 0) * 200 > 200 && !e.hit?.has(p.id)) {
                p.hp -= e.damage ?? 10;
                e.hit?.add(p.id);
                setTimeout(() => e.hit?.delete(p.id), 200);
              }
            }
          }
        }
      }
      break;
    }
    case "monocyte": {
      // Squashes the first pathogen in lane within range
      if (d.state === "idle") {
        const target = s.pathogens
          .filter((p) => p.row === d.row && p.x > center.x - 30 && p.x < center.x + CELL_W * 3)
          .sort((a, b) => a.x - b.x)[0];
        if (target) {
          d.state = "jumping";
          d.lastAction = s.time;
          d.data.targetX = target.x;
          d.data.targetId = target.id;
        }
      } else if (d.state === "jumping") {
        if (s.time - d.lastAction >= 600) {
          // Land
          for (const p of s.pathogens) {
            if (p.row === d.row && Math.abs(p.x - d.data.targetX) < 50) {
              p.hp -= 800;
            }
          }
          s.effects.push({
            id: id(),
            type: "explosion",
            x: d.data.targetX,
            y: center.y,
            age: 0,
            duration: 500,
            color: "#7eb86b",
            radius: 50,
          });
          try { playSound("monocyte_land"); } catch (e) {}
          d.hp = 0; // Single-use
        }
      }
      break;
    }
    case "tcell": {
      // Mine — explodes when pathogen close
      if (s.time < d.data.armTime) break;
      d.data.armed = 1;
      const target = s.pathogens.find(
        (p) => p.row === d.row && Math.abs(p.x - center.x) < 35,
      );
      if (target) {
        for (const p of s.pathogens) {
          if (p.row === d.row && Math.abs(p.x - center.x) < 70) {
            p.hp -= 600;
          }
        }
        s.effects.push({
          id: id(),
          type: "explosion",
          x: center.x,
          y: center.y,
          age: 0,
          duration: 500,
          color: "#ff8030",
          radius: 70,
        });
        try { playSound("mine_explode"); } catch (e) {}
        d.hp = 0;
      }
      break;
    }
    case "bcell": {
      // Shoots in 3 lanes (own + above + below)
      if (s.time - d.lastAction >= 1800) {
        const rows = [d.row - 1, d.row, d.row + 1].filter((r) => r >= 0 && r < ROWS);
        const hasTarget = s.pathogens.some((p) => rows.includes(p.row) && p.x > center.x);
        if (hasTarget) {
          d.lastAction = s.time;
          for (const r of rows) {
            const ry = GRID_OFFSET_Y + r * CELL_H + CELL_H / 2;
            s.projectiles.push({
              id: id(),
              row: r,
              x: center.x + 18,
              y: ry,
              vx: 320,
              damage: 25,
              kind: "antibody",
              color: "#fff066",
            });
          }
          try { playSound("defender_shoot"); } catch (e) {}
        }
      }
      break;
    }
    case "platelet": {
      // Wait 1s, then explode with fire damage to entire lane
      if (s.time - d.lastAction >= 1000) {
        for (const p of s.pathogens) {
          if (p.row === d.row) {
            p.hp -= 1500;
          }
        }
        // Adjacent lane minor damage
        for (const p of s.pathogens) {
          if (Math.abs(p.row - d.row) === 1) p.hp -= 300;
        }
        s.effects.push({
          id: id(),
          type: "explosion",
          x: GRID_OFFSET_X + COLS * CELL_W / 2,
          y: center.y,
          age: 0,
          duration: 700,
          color: "#ff5e3a",
          radius: COLS * CELL_W / 2 + 50,
        });
        d.hp = 0;
        try { playSound("platelet_explode"); } catch (e) {}
      }
      break;
    }
  }
}

function updatePathogen(s: GameState, p: Pathogen, dt: number) {
  const cfg = PATHOGENS[p.type];
  const inflamed = s.inflammation[p.row] >= INFLAMMATION_THRESHOLD;
  const slowed = p.slowUntil > s.time;

  // Find blocker (defender directly in front)
  const blocker = s.defenders.find((d) => {
    if (d.row !== p.row) return false;
    if (d.type === "tcell" || d.type === "stem") return false; // mines/stem don't block
    const center = cellCenter(d.row, d.col);
    return Math.abs(p.x - center.x) < CELL_W * 0.5 + cfg.size * 0.3;
  });

  if (blocker) {
    p.attackingId = blocker.id;
    if (s.time - p.lastAttack >= 800) {
      p.lastAttack = s.time;
      blocker.hp -= p.damage;
    }
  } else {
    p.attackingId = null;
    let speed = p.speed;
    if (inflamed) speed *= INFLAMMATION_SLOW;
    if (slowed) speed *= 0.6;
    p.x -= speed * (dt / 1000);
  }

  // Burn damage
  if (p.burnUntil > s.time && s.time - p.burnTick >= 500) {
    p.hp -= 15;
    p.burnTick = s.time;
  }
}

export function collectAtp(s: GameState, dropId: number) {
  const drop = s.drops.find((d) => d.id === dropId);
  if (!drop) return;
  s.atp += drop.amount;
  s.drops = s.drops.filter((d) => d.id !== dropId);
  s.effects.push({
    id: id(),
    type: "atp",
    x: drop.x,
    y: drop.y,
    age: 0,
    duration: 700,
    color: "#ffd700",
    text: `${drop.amount}`,
  });
  try { playSound("collect"); } catch (e) {}
}

export function clickAtCanvas(s: GameState, x: number, y: number): { collected: boolean } {
  // Try to collect ATP drop
  for (const drop of s.drops) {
    const dx = x - drop.x;
    const dy = y - drop.y;
    if (dx * dx + dy * dy < 400) {
      collectAtp(s, drop.id);
      return { collected: true };
    }
  }

  if (!s.selectedType) return { collected: false };

  // Try to place defender
  const col = Math.floor((x - GRID_OFFSET_X) / CELL_W);
  const row = Math.floor((y - GRID_OFFSET_Y) / CELL_H);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return { collected: false };

  const placed = placeDefender(s, s.selectedType, row, col);
  if (placed) {
    s.selectedType = null;
  }
  return { collected: false };
}

export function hoverAtCanvas(s: GameState, x: number, y: number) {
  const col = Math.floor((x - GRID_OFFSET_X) / CELL_W);
  const row = Math.floor((y - GRID_OFFSET_Y) / CELL_H);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    s.hoveredCell = null;
    return;
  }
  s.hoveredCell = { row, col };
}

export function canPlaceAt(s: GameState, row: number, col: number): boolean {
  if (!s.selectedType) return false;
  const cfg = DEFENDERS[s.selectedType];
  if (s.atp < cfg.cost) return false;
  if ((s.cooldowns[s.selectedType] ?? 0) > s.time) return false;
  if (s.defenders.some((d) => d.row === row && d.col === col)) return false;
  return true;
}
