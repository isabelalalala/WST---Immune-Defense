export type DefenderType =
  | "stem"
  | "neutrophil"
  | "eosinophil"
  | "basophil"
  | "monocyte"
  | "tcell"
  | "bcell"
  | "platelet";

export type PathogenType =
  | "parasite"
  | "protozoa"
  | "fungi"
  | "prokaryote"
  | "virus"
  | "prion";

export interface DefenderConfig {
  type: DefenderType;
  name: string;
  description: string;
  cost: number;
  hp: number;
  cooldown: number;
  color: string;
  accentColor: string;
}

export interface PathogenConfig {
  type: PathogenType;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  color: string;
  accentColor: string;
  size: number;
}

export interface Defender {
  id: number;
  type: DefenderType;
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  lastAction: number;
  state: string;
  data: Record<string, number>;
}

export interface Pathogen {
  id: number;
  type: PathogenType;
  row: number;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  reward: number;
  attackingId: number | null;
  lastAttack: number;
  slowUntil: number;
  burnUntil: number;
  burnTick: number;
  pulse: number;
}

export interface Projectile {
  id: number;
  row: number;
  x: number;
  y: number;
  vx: number;
  damage: number;
  kind: "antibody" | "spore" | "shot";
  color: string;
  effect?: "slow" | "burn";
}

export interface Effect {
  id: number;
  type: "explosion" | "spore-cloud" | "splash" | "atp" | "text";
  x: number;
  y: number;
  age: number;
  duration: number;
  color: string;
  text?: string;
  radius?: number;
  row?: number;
  damage?: number;
  hit?: Set<number>;
}

export interface AtpDrop {
  id: number;
  x: number;
  y: number;
  vy: number;
  targetY: number;
  age: number;
  amount: number;
  spawnedAt: number;
}

export interface GameState {
  atp: number;
  wave: number;
  waveProgress: number;
  inWave: boolean;
  spawnQueue: { type: PathogenType; row: number; delay: number }[];
  spawnTimer: number;
  defenders: Defender[];
  pathogens: Pathogen[];
  projectiles: Projectile[];
  effects: Effect[];
  drops: AtpDrop[];
  selectedType: DefenderType | null;
  cooldowns: Record<string, number>;
  inflammation: number[];
  warningRow: number | null;
  warningTime: number;
  status: "menu" | "playing" | "won" | "lost";
  time: number;
  lastAtpAuto: number;
  hoveredCell: { row: number; col: number } | null;
}
