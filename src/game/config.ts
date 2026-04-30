import type { DefenderConfig, PathogenConfig, DefenderType, PathogenType } from "./types";

export const ROWS = 5;
export const COLS = 9;
export const CELL_W = 96;
export const CELL_H = 110;
export const GRID_OFFSET_X = 80;
export const GRID_OFFSET_Y = 80;
export const CANVAS_W = GRID_OFFSET_X + COLS * CELL_W + 30;
export const CANVAS_H = GRID_OFFSET_Y + ROWS * CELL_H + 20;

export let STARTING_ATP = 150;
export const ATP_AUTO_INTERVAL = 8000;
export const INFLAMMATION_THRESHOLD = 3;
export const INFLAMMATION_SLOW = 0.5;
export const INFLAMMATION_ATP_PENALTY = 0.5;

export const DEFENDERS: Record<DefenderType, DefenderConfig> = {
  stem: {
    type: "stem",
    name: "Stem Cell",
    description: "Generates ATP over time",
    cost: 50,
    hp: 100,
    cooldown: 5000,
    color: "#f5d76e",
    accentColor: "#fff3a8",
  },
  neutrophil: {
    type: "neutrophil",
    name: "Neutrophil",
    description: "Shoots antibodies forward",
    cost: 100,
    hp: 120,
    cooldown: 5000,
    color: "#e8e8f0",
    accentColor: "#a8d8ff",
  },
  eosinophil: {
    type: "eosinophil",
    name: "Eosinophil",
    description: "Devours pathogens that come close",
    cost: 150,
    hp: 200,
    cooldown: 7000,
    color: "#e85a5a",
    accentColor: "#ff8a8a",
  },
  basophil: {
    type: "basophil",
    name: "Basophil",
    description: "Releases damaging spore clouds",
    cost: 175,
    hp: 130,
    cooldown: 7500,
    color: "#9b59b6",
    accentColor: "#c39bd3",
  },
  monocyte: {
    type: "monocyte",
    name: "Monocyte",
    description: "Squashes the first pathogen in lane",
    cost: 50,
    hp: 1,
    cooldown: 30000,
    color: "#5a8c4f",
    accentColor: "#7eb86b",
  },
  tcell: {
    type: "tcell",
    name: "T Cell",
    description: "Buried mine that detonates on contact",
    cost: 25,
    hp: 1,
    cooldown: 12000,
    color: "#7d4f30",
    accentColor: "#a87a4f",
  },
  bcell: {
    type: "bcell",
    name: "B Cell",
    description: "Fires antibodies in 3 lanes",
    cost: 325,
    hp: 120,
    cooldown: 7500,
    color: "#3498db",
    accentColor: "#5dade2",
  },
  platelet: {
    type: "platelet",
    name: "Platelets",
    description: "Clots the entire lane in fire",
    cost: 125,
    hp: 1,
    cooldown: 25000,
    color: "#ff5e3a",
    accentColor: "#ffaa66",
  },
};

export const PATHOGENS: Record<PathogenType, PathogenConfig> = {
  parasite: {
    type: "parasite",
    name: "Parasite",
    hp: 200,
    speed: 18,
    damage: 8,
    reward: 15,
    color: "#8b4789",
    accentColor: "#b87cb6",
    size: 36,
  },
  protozoa: {
    type: "protozoa",
    name: "Protozoa",
    hp: 280,
    speed: 14,
    damage: 10,
    reward: 18,
    color: "#5a7d2a",
    accentColor: "#8eaf4e",
    size: 40,
  },
  fungi: {
    type: "fungi",
    name: "Fungi",
    hp: 380,
    speed: 12,
    damage: 12,
    reward: 22,
    color: "#c08552",
    accentColor: "#e0a878",
    size: 44,
  },
  prokaryote: {
    type: "prokaryote",
    name: "Prokaryote",
    hp: 150,
    speed: 22,
    damage: 6,
    reward: 12,
    color: "#27ae60",
    accentColor: "#52be80",
    size: 32,
  },
  virus: {
    type: "virus",
    name: "Virus",
    hp: 120,
    speed: 28,
    damage: 8,
    reward: 14,
    color: "#c0392b",
    accentColor: "#e74c3c",
    size: 30,
  },
  prion: {
    type: "prion",
    name: "Prion",
    hp: 600,
    speed: 10,
    damage: 18,
    reward: 35,
    color: "#34495e",
    accentColor: "#5d6d7e",
    size: 48,
  },
};

export interface WaveSpawn {
  type: PathogenType;
  count: number;
  rows?: number[];
  delay: number;
  spacing: number;
}

export const WAVES: WaveSpawn[][] = [
  [{ type: "prokaryote", count: 5, delay: 2000, spacing: 3500 }],
  [
    { type: "prokaryote", count: 6, delay: 1500, spacing: 2800 },
    { type: "virus", count: 3, delay: 8000, spacing: 3500 },
  ],
  [
    { type: "virus", count: 6, delay: 1000, spacing: 2500 },
    { type: "parasite", count: 4, delay: 6000, spacing: 3500 },
  ],
  [
    { type: "prokaryote", count: 8, delay: 800, spacing: 1800 },
    { type: "protozoa", count: 4, delay: 5000, spacing: 3500 },
    { type: "virus", count: 5, delay: 12000, spacing: 2200 },
  ],
  [
    { type: "parasite", count: 6, delay: 1000, spacing: 2500 },
    { type: "fungi", count: 3, delay: 8000, spacing: 4500 },
    { type: "virus", count: 8, delay: 14000, spacing: 1500 },
  ],
  [
    { type: "protozoa", count: 6, delay: 1000, spacing: 2200 },
    { type: "fungi", count: 5, delay: 8000, spacing: 3000 },
    { type: "prion", count: 1, delay: 18000, spacing: 0 },
  ],
  [
    { type: "virus", count: 12, delay: 500, spacing: 1200 },
    { type: "parasite", count: 6, delay: 8000, spacing: 2000 },
    { type: "fungi", count: 4, delay: 16000, spacing: 2500 },
    { type: "prion", count: 2, delay: 24000, spacing: 4000 },
  ],
];

// ─── Difficulty System ────────────────────────────────────────────────────────
export type Difficulty = "Normal" | "Hard" | "Brutal";

export function getDifficulty(): Difficulty {
  if (typeof localStorage === "undefined") return "Normal";
  return (localStorage.getItem("difficulty") as Difficulty) ?? "Normal";
}

// Frozen base snapshots — ensures applyDifficulty is always idempotent
const _basePathogens = Object.fromEntries(
  Object.entries(PATHOGENS).map(([k, v]) => [k, { ...v }])
) as typeof PATHOGENS;

const _baseWaves: WaveSpawn[][] = WAVES.map((wave) =>
  wave.map((spawn) => ({ ...spawn }))
);

const _baseStartingAtp = 150;

const DIFF_MULT: Record<Difficulty, {
  hp: number; speed: number; damage: number; reward: number;
  atp: number; spacing: number; extraCount: number;
}> = {
  Normal: { hp: 1,    speed: 1,    damage: 1,    reward: 1,    atp: 1,    spacing: 1,    extraCount: 0 },
  Hard:   { hp: 1.4,  speed: 1.2,  damage: 1.3,  reward: 0.85, atp: 0.82, spacing: 0.82, extraCount: 1 },
  Brutal: { hp: 1.85, speed: 1.5,  damage: 1.6,  reward: 0.65, atp: 0.6,  spacing: 0.65, extraCount: 3 },
};

export function applyDifficulty(diff: Difficulty = getDifficulty()) {
  const m = DIFF_MULT[diff];

  // Scale pathogen stats
  for (const key of Object.keys(PATHOGENS) as PathogenType[]) {
    const base = _basePathogens[key];
    PATHOGENS[key].hp     = Math.round(base.hp     * m.hp);
    PATHOGENS[key].speed  = Math.round(base.speed  * m.speed * 10) / 10;
    PATHOGENS[key].damage = Math.round(base.damage  * m.damage);
    PATHOGENS[key].reward = Math.round(base.reward  * m.reward);
  }

  // Scale starting ATP (live binding — engine.ts sees this change)
  STARTING_ATP = Math.round(_baseStartingAtp * m.atp);

  // Scale wave spawn timing and enemy count
  for (let wi = 0; wi < WAVES.length; wi++) {
    for (let si = 0; si < WAVES[wi].length; si++) {
      const base = _baseWaves[wi][si];
      WAVES[wi][si].spacing = Math.max(600, Math.round(base.spacing * m.spacing));
      WAVES[wi][si].delay   = Math.max(400, Math.round(base.delay   * m.spacing));
      WAVES[wi][si].count   = base.count + m.extraCount;
    }
  }
}
