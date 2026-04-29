import type { Defender, Pathogen, Projectile, Effect, AtpDrop } from "./types";
import { DEFENDERS, PATHOGENS, CELL_W, CELL_H, GRID_OFFSET_X, GRID_OFFSET_Y, ROWS, COLS, INFLAMMATION_THRESHOLD } from "./config";

export function cellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: GRID_OFFSET_X + col * CELL_W + CELL_W / 2,
    y: GRID_OFFSET_Y + row * CELL_H + CELL_H / 2,
  };
}

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, inflammation: number[]) {
  // Deep tissue gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#2a0e15");
  bg.addColorStop(0.5, "#3d141d");
  bg.addColorStop(1, "#1f0a10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Floating cell debris
  for (let i = 0; i < 30; i++) {
    const x = ((i * 137 + time * 0.01) % w + w) % w;
    const y = (i * 71) % h;
    const r = 1 + (i % 3);
    ctx.fillStyle = `rgba(220, 100, 120, ${0.05 + (i % 5) * 0.02})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lanes (arteries)
  for (let r = 0; r < ROWS; r++) {
    const y = GRID_OFFSET_Y + r * CELL_H;
    const inflamed = inflammation[r] >= INFLAMMATION_THRESHOLD;
    const baseColor = inflamed ? "#7a2030" : "#4a1820";
    const accentColor = inflamed ? "#a83344" : "#6b252e";

    const grad = ctx.createLinearGradient(0, y, 0, y + CELL_H);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(0.5, accentColor);
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    ctx.fillRect(GRID_OFFSET_X - 30, y, COLS * CELL_W + 60, CELL_H);

    // Vessel walls
    ctx.fillStyle = inflamed ? "#5a1825" : "#2a0c12";
    ctx.fillRect(GRID_OFFSET_X - 30, y, COLS * CELL_W + 60, 4);
    ctx.fillRect(GRID_OFFSET_X - 30, y + CELL_H - 4, COLS * CELL_W + 60, 4);

    // Flowing red blood cells in background
    for (let i = 0; i < 8; i++) {
      const flowX = ((i * 211 - time * 0.04 + r * 50) % (COLS * CELL_W + 60) + (COLS * CELL_W + 60)) % (COLS * CELL_W + 60);
      const fx = GRID_OFFSET_X - 30 + flowX;
      const fy = y + 18 + ((i * 7) % (CELL_H - 36));
      ctx.fillStyle = `rgba(180, 50, 70, ${inflamed ? 0.25 : 0.18})`;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (inflamed) {
      ctx.strokeStyle = "rgba(255, 200, 50, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(GRID_OFFSET_X - 30, y + 4, COLS * CELL_W + 60, CELL_H - 8);
      ctx.setLineDash([]);
    }
  }

  // Grid cells (tower placement spots)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = GRID_OFFSET_X + c * CELL_W;
      const y = GRID_OFFSET_Y + r * CELL_H + 8;
      ctx.strokeStyle = "rgba(255, 220, 200, 0.06)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 20);
    }
  }
}

export function drawHoverCell(
  ctx: CanvasRenderingContext2D,
  row: number,
  col: number,
  selectedType: string | null,
  canPlace: boolean,
) {
  const x = GRID_OFFSET_X + col * CELL_W;
  const y = GRID_OFFSET_Y + row * CELL_H + 8;
  ctx.fillStyle = canPlace
    ? "rgba(120, 220, 130, 0.18)"
    : "rgba(220, 80, 80, 0.18)";
  ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 20);
  ctx.strokeStyle = canPlace ? "rgba(160, 255, 170, 0.7)" : "rgba(255, 120, 120, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, CELL_W - 4, CELL_H - 20);

  if (selectedType && canPlace) {
    const cfg = DEFENDERS[selectedType as keyof typeof DEFENDERS];
    if (cfg) {
      const center = cellCenter(row, col);
      ctx.globalAlpha = 0.5;
      drawDefenderShape(ctx, selectedType, center.x, center.y, 0);
      ctx.globalAlpha = 1;
    }
  }
}

export function drawDefenderShape(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, time: number) {
  const cfg = DEFENDERS[type as keyof typeof DEFENDERS];
  if (!cfg) return;

  const bob = Math.sin(time * 0.003 + x * 0.1) * 1.5;
  const cx = x;
  const cy = y + bob;

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, y + 32, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (type) {
    case "stem": {
      // ATP-producing yellow cell with mitochondria pattern
      drawCellBase(ctx, cx, cy, 26, cfg.color, cfg.accentColor);
      // Mitochondria swirl
      ctx.fillStyle = "#d4a017";
      for (let i = 0; i < 4; i++) {
        const a = time * 0.002 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 3, 6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // ATP letters glow
      ctx.fillStyle = "#fff8c0";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ATP", cx, cy + 3);
      break;
    }
    case "neutrophil": {
      // White blood cell with multi-lobed nucleus
      drawCellBase(ctx, cx, cy, 26, cfg.color, "#cfd8e5");
      // Multi-lobed nucleus (signature of neutrophils)
      ctx.fillStyle = "#5d3a8a";
      const lobePositions = [[-7, -3], [7, -3], [0, 6]];
      for (const [lx, ly] of lobePositions) {
        ctx.beginPath();
        ctx.arc(cx + lx, cy + ly, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Connector lines between lobes
      ctx.strokeStyle = "#5d3a8a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 3);
      ctx.lineTo(cx + 7, cy - 3);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 7, cy - 3);
      ctx.stroke();
      // Eyes
      drawEyes(ctx, cx, cy - 12, 0.6);
      break;
    }
    case "eosinophil": {
      // Red granule cell with chomping mouth
      drawCellBase(ctx, cx, cy, 28, cfg.color, "#ff8a8a");
      // Granules
      ctx.fillStyle = "#ffb84d";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + time * 0.001;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Big mouth
      ctx.fillStyle = "#3a0a14";
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 11, 0, Math.PI);
      ctx.fill();
      // Teeth
      ctx.fillStyle = "#fff8e0";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 9 + i * 6, cy + 4);
        ctx.lineTo(cx - 6 + i * 6, cy + 9);
        ctx.lineTo(cx - 3 + i * 6, cy + 4);
        ctx.fill();
      }
      drawEyes(ctx, cx, cy - 10, 0.55);
      break;
    }
    case "basophil": {
      // Purple granule cell
      drawCellBase(ctx, cx, cy, 26, cfg.color, "#c39bd3");
      // Dense dark granules
      ctx.fillStyle = "#4a235a";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 6 + (i % 3) * 4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Smoke chimney top
      const puff = Math.sin(time * 0.004) * 2;
      ctx.fillStyle = "rgba(180, 130, 200, 0.5)";
      ctx.beginPath();
      ctx.arc(cx + 16, cy - 14 + puff, 6, 0, Math.PI * 2);
      ctx.arc(cx + 22, cy - 18 + puff, 4, 0, Math.PI * 2);
      ctx.fill();
      drawEyes(ctx, cx - 4, cy - 8, 0.5);
      break;
    }
    case "monocyte": {
      // Big green squash-like cell
      drawCellBase(ctx, cx, cy, 30, cfg.color, "#7eb86b");
      // Kidney-shaped nucleus
      ctx.fillStyle = "#2d4a2a";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 12, 8, 0, Math.PI * 0.2, Math.PI * 1.8);
      ctx.fill();
      // Angry eyes
      drawAngryEyes(ctx, cx, cy - 12);
      break;
    }
    case "tcell": {
      // Buried mine - small mound with antenna
      ctx.fillStyle = "#5a3a25";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCellBase(ctx, cx, cy, 18, cfg.color, cfg.accentColor);
      // T receptor
      ctx.strokeStyle = "#3a1f10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx, cy - 22);
      ctx.moveTo(cx - 6, cy - 22);
      ctx.lineTo(cx + 6, cy - 22);
      ctx.stroke();
      ctx.fillStyle = "#ff5e3a";
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 22, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 22, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bcell": {
      // Blue cell with antibody on top
      drawCellBase(ctx, cx, cy, 26, cfg.color, "#5dade2");
      // Nucleus
      ctx.fillStyle = "#1a3a5a";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      // Antibody Y-shape on top
      ctx.strokeStyle = "#fff8e0";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy - 22);
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx - 6, cy - 28);
      ctx.moveTo(cx, cy - 22);
      ctx.lineTo(cx + 6, cy - 28);
      ctx.stroke();
      drawEyes(ctx, cx, cy - 4, 0.5);
      break;
    }
    case "platelet": {
      // Orange-red disk-shaped cell
      ctx.fillStyle = "#cc4520";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 24, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fire
      const flame = Math.sin(time * 0.01) * 2;
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 8);
      ctx.quadraticCurveTo(cx, cy - 22 + flame, cx + 8, cy - 8);
      ctx.fill();
      ctx.fillStyle = "#fff066";
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 8);
      ctx.quadraticCurveTo(cx, cy - 16 + flame, cx + 4, cy - 8);
      ctx.fill();
      drawAngryEyes(ctx, cx, cy - 2);
      break;
    }
  }
}

function drawCellBase(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, accent: string) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  grad.addColorStop(0, accent);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Membrane outline
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 5 * scale * 1.3, cy, 3 * scale * 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 * scale * 1.3, cy, 3 * scale * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx - 5 * scale * 1.3, cy, 1.5 * scale * 1.3, 0, Math.PI * 2);
  ctx.arc(cx + 5 * scale * 1.3, cy, 1.5 * scale * 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawAngryEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(cx - 7, cy, 4, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.arc(cx - 7, cy + 1, 2, 0, Math.PI * 2);
  ctx.arc(cx + 7, cy + 1, 2, 0, Math.PI * 2);
  ctx.fill();
  // Angry brows
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy - 6);
  ctx.lineTo(cx - 3, cy - 3);
  ctx.moveTo(cx + 11, cy - 6);
  ctx.lineTo(cx + 3, cy - 3);
  ctx.stroke();
}

export function drawDefender(ctx: CanvasRenderingContext2D, d: Defender, time: number) {
  const center = cellCenter(d.row, d.col);
  let yOffset = 0;
  let xOffset = 0;
  if (d.type === "monocyte" && d.state === "jumping") {
    const t = Math.min(1, (time - d.lastAction) / 600);
    yOffset = -Math.sin(t * Math.PI) * 50;
    xOffset = t * (d.data.targetX - center.x);
  }
  drawDefenderShape(ctx, d.type, center.x + xOffset, center.y + yOffset, time);

  // HP bar (only if damaged)
  if (d.hp < d.maxHp && d.maxHp > 1) {
    const w = 36;
    const x = center.x - w / 2;
    const y = center.y + 30;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = "#7d2020";
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = "#4ce04e";
    ctx.fillRect(x, y, w * (d.hp / d.maxHp), 3);
  }
}

export function drawPathogen(ctx: CanvasRenderingContext2D, p: Pathogen, time: number) {
  const cfg = PATHOGENS[p.type];
  const y = GRID_OFFSET_Y + p.row * CELL_H + CELL_H / 2;
  const cx = p.x;
  const cy = y + Math.sin(time * 0.005 + p.id) * 2;
  const size = cfg.size;

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, y + 28, size * 0.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (p.type) {
    case "parasite": {
      // Worm-like creature
      ctx.fillStyle = cfg.color;
      for (let i = 0; i < 4; i++) {
        const segX = cx + Math.sin(time * 0.005 + i) * 3 - i * 6 + 8;
        const segY = cy;
        ctx.beginPath();
        ctx.arc(segX, segY, size * 0.4 - i * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = cfg.accentColor;
      ctx.beginPath();
      ctx.arc(cx + 8, cy, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#ffeb00";
      ctx.beginPath();
      ctx.arc(cx + 4, cy - 4, 3, 0, Math.PI * 2);
      ctx.arc(cx + 12, cy - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx + 4, cy - 4, 1.5, 0, Math.PI * 2);
      ctx.arc(cx + 12, cy - 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "protozoa": {
      // Amoeba blob with pseudopods
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      const lobes = 6;
      for (let i = 0; i <= lobes; i++) {
        const a = (i / lobes) * Math.PI * 2;
        const r = size * 0.5 + Math.sin(a * 3 + time * 0.003) * 4;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Inner blob
      ctx.fillStyle = cfg.accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Vacuoles
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 4, 3, 0, Math.PI * 2);
      ctx.arc(cx + 5, cy + 3, 4, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#ffeb00";
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 8, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "fungi": {
      // Mushroom-like
      ctx.fillStyle = "#8b6f47";
      ctx.fillRect(cx - 6, cy - 2, 12, size * 0.5);
      // Cap
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 6, size * 0.55, size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Spots
      ctx.fillStyle = cfg.accentColor;
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 8, 3, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 4, 4, 0, Math.PI * 2);
      ctx.arc(cx, cy - 12, 3, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#ffeb00";
      ctx.beginPath();
      ctx.arc(cx - 4, cy + 4, 2.5, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy + 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx - 4, cy + 4, 1.2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy + 4, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "prokaryote": {
      // Rod-shaped bacteria with flagella
      const wiggle = Math.sin(time * 0.02 + p.id) * 3;
      // Flagella
      ctx.strokeStyle = cfg.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const fx = cx + 12 + i * 2;
        const fy = cy + Math.sin(i * 0.7 + time * 0.02) * 4;
        if (i === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
      // Body
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.ellipse(cx, cy, size * 0.5, size * 0.32, wiggle * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.accentColor;
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy - 2, size * 0.4, size * 0.22, wiggle * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#ffeb00";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 1, 0, Math.PI * 2);
      ctx.arc(cx + 4, cy - 2, 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "virus": {
      // Spiky icosahedron
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      const sides = 8;
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const r = size * 0.45;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // Spikes
      ctx.strokeStyle = cfg.accentColor;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + time * 0.001;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * size * 0.45, cy + Math.sin(a) * size * 0.45);
        ctx.lineTo(cx + Math.cos(a) * size * 0.65, cy + Math.sin(a) * size * 0.65);
        ctx.stroke();
        ctx.fillStyle = cfg.accentColor;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * size * 0.65, cy + Math.sin(a) * size * 0.65, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center crown
      ctx.fillStyle = "#ffeb00";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "prion": {
      // Twisted protein clump
      ctx.fillStyle = cfg.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + time * 0.001;
        const px = cx + Math.cos(a) * 8;
        const py = cy + Math.sin(a) * 8;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = cfg.accentColor;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Glowing core
      const pulseR = 4 + Math.sin(time * 0.008) * 2;
      ctx.fillStyle = "#ff3030";
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fill();
      // Mean eyes
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 10, 4, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy - 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c00";
      ctx.beginPath();
      ctx.arc(cx - 8, cy - 10, 2, 0, Math.PI * 2);
      ctx.arc(cx + 8, cy - 10, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  // Slow indicator
  if (p.slowUntil > time) {
    ctx.strokeStyle = "rgba(150, 220, 255, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Burn indicator
  if (p.burnUntil > time) {
    for (let i = 0; i < 3; i++) {
      const fx = cx + (Math.random() - 0.5) * size * 0.6;
      const fy = cy - size * 0.3 + Math.random() * size * 0.6;
      ctx.fillStyle = `rgba(255, ${100 + Math.random() * 100}, 30, 0.7)`;
      ctx.beginPath();
      ctx.arc(fx, fy, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // HP bar
  const w = size + 4;
  const bx = cx - w / 2;
  const by = cy - size * 0.7 - 8;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(bx - 1, by - 1, w + 2, 5);
  ctx.fillStyle = "#5a1010";
  ctx.fillRect(bx, by, w, 3);
  ctx.fillStyle = p.hp / p.maxHp > 0.5 ? "#4ce04e" : p.hp / p.maxHp > 0.25 ? "#f5c038" : "#e84040";
  ctx.fillRect(bx, by, w * Math.max(0, p.hp / p.maxHp), 3);
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  if (p.kind === "antibody") {
    // Y-shaped antibody
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y - 4);
    ctx.lineTo(p.x, p.y);
    ctx.moveTo(p.x + 4, p.y - 4);
    ctx.lineTo(p.x, p.y);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 6);
    ctx.stroke();
    // Glow
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "spore") {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawEffect(ctx: CanvasRenderingContext2D, e: Effect) {
  const t = e.age / e.duration;
  if (t > 1) return;

  switch (e.type) {
    case "explosion": {
      const r = (e.radius ?? 60) * t;
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      grad.addColorStop(0, `rgba(255, 240, 100, ${1 - t})`);
      grad.addColorStop(0.5, `rgba(255, 120, 30, ${0.7 - t * 0.7})`);
      grad.addColorStop(1, `rgba(180, 30, 30, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "spore-cloud": {
      const r = (e.radius ?? 50) * (0.5 + t * 0.7);
      ctx.globalAlpha = (1 - t) * 0.7;
      const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      grad.addColorStop(0, e.color);
      grad.addColorStop(1, "rgba(155, 89, 182, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "splash": {
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 8 + t * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "atp": {
      ctx.fillStyle = `rgba(255, 240, 120, ${1 - t})`;
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`+${e.text}`, e.x, e.y - t * 30);
      break;
    }
    case "text": {
      ctx.fillStyle = `${e.color}${Math.floor((1 - t) * 255).toString(16).padStart(2, "0")}`;
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(e.text || "", e.x, e.y - t * 25);
      break;
    }
  }
}

export function drawAtpDrop(ctx: CanvasRenderingContext2D, d: AtpDrop, time: number) {
  const bob = Math.sin(time * 0.005 + d.id) * 2;
  // Glow
  const glowGrad = ctx.createRadialGradient(d.x, d.y + bob, 0, d.x, d.y + bob, 18);
  glowGrad.addColorStop(0, "rgba(255, 240, 120, 0.6)");
  glowGrad.addColorStop(1, "rgba(255, 240, 120, 0)");
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(d.x, d.y + bob, 18, 0, Math.PI * 2);
  ctx.fill();
  // Crystal
  ctx.fillStyle = "#fff5a0";
  ctx.beginPath();
  ctx.moveTo(d.x, d.y + bob - 10);
  ctx.lineTo(d.x + 8, d.y + bob);
  ctx.lineTo(d.x, d.y + bob + 10);
  ctx.lineTo(d.x - 8, d.y + bob);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d4a017";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(d.x - 2, d.y + bob - 4);
  ctx.lineTo(d.x + 2, d.y + bob);
  ctx.lineTo(d.x - 2, d.y + bob + 4);
  ctx.closePath();
  ctx.fill();
}
