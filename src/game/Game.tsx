import { useEffect, useRef, useState } from "react";
import type { GameState, DefenderType } from "./types";
import { DEFENDERS, PATHOGENS, CANVAS_W, CANVAS_H, WAVES, ROWS, INFLAMMATION_THRESHOLD } from "./config";
import { createInitialState, tick, startWave, clickAtCanvas, hoverAtCanvas, canPlaceAt } from "./engine";
import { enableAudio, playSound, playBackground, stopBackground } from "./audio";
import {
  drawBackground,
  drawDefender,
  drawPathogen,
  drawProjectile,
  drawEffect,
  drawAtpDrop,
  drawHoverCell,
  drawDefenderShape,
} from "./draw";
import { AlertTriangle, Zap, Heart, Shield } from "lucide-react";

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [, force] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();
    let raf = 0;
    let renderCounter = 0;

    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const s = stateRef.current;
      tick(s, dt);

      // Render
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawBackground(ctx, CANVAS_W, CANVAS_H, s.time, s.inflammation);
      // Hover cell preview
      if (s.hoveredCell && s.selectedType) {
        const can = canPlaceAt(s, s.hoveredCell.row, s.hoveredCell.col);
        drawHoverCell(ctx, s.hoveredCell.row, s.hoveredCell.col, s.selectedType, can);
      }
      // Defenders
      for (const d of s.defenders) drawDefender(ctx, d, s.time);
      // Pathogens
      for (const p of s.pathogens) drawPathogen(ctx, p, s.time);
      // Projectiles
      for (const p of s.projectiles) drawProjectile(ctx, p);
      // Drops
      for (const d of s.drops) drawAtpDrop(ctx, d, s.time);
      // Effects
      for (const e of s.effects) drawEffect(ctx, e);

      // Inflammation warning
      if (s.warningTime > s.time && s.warningRow !== null) {
        const flicker = Math.sin(s.time * 0.02) > 0;
        if (flicker) {
          ctx.fillStyle = "rgba(255, 200, 50, 0.18)";
          ctx.fillRect(0, 80 + s.warningRow * 110, CANVAS_W, 110);
        }
      }

      // Force UI re-render every ~6 frames for HUD updates
      renderCounter++;
      if (renderCounter % 6 === 0) {
        force((x) => (x + 1) % 100000);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    clickAtCanvas(stateRef.current, x, y);
    force((x) => (x + 1) % 100000);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    hoverAtCanvas(stateRef.current, x, y);
  };

  const selectDefender = (type: DefenderType) => {
    const s = stateRef.current;
    if ((s.cooldowns[type] ?? 0) > s.time) return;
    if (s.atp < DEFENDERS[type].cost) return;
    s.selectedType = s.selectedType === type ? null : type;
    force((x) => (x + 1) % 100000);
    try { playSound("ui_click"); } catch (e) {}
  };

  const startGame = () => {
    const s = stateRef.current;
    // Enable audio on first user gesture
    try { enableAudio(); playSound("ui_click"); } catch (e) {}
    s.status = "playing";
    startWave(s, 1);
    try { playBackground(); } catch (e) {}
    force((x) => (x + 1) % 100000);
  };

  const restartGame = () => {
    try { enableAudio(); playSound("ui_click"); } catch (e) {}
    stateRef.current = createInitialState();
    stateRef.current.status = "playing";
    startWave(stateRef.current, 1);
    try { playBackground(); } catch (e) {}
    force((x) => (x + 1) % 100000);
  };

  const nextWave = () => {
    const s = stateRef.current;
    if (s.inWave) return;
    if (s.wave >= WAVES.length) return;
    startWave(s, s.wave + 1);
    force((x) => (x + 1) % 100000);
  };

  const s = stateRef.current;
  const inflamedRows = s.inflammation.map((c, r) => (c >= INFLAMMATION_THRESHOLD ? r : -1)).filter((r) => r >= 0);
  const waveRemaining = s.spawnQueue.length + s.pathogens.length;

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden">
      {/* Top HUD */}
      <header className="flex items-center justify-between px-6 py-3 bg-card/80 backdrop-blur border-b border-border z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-lg shadow-rose-500/40">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Immune <span className="text-primary">Defense</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/15 border border-amber-500/30">
            <Zap className="w-4 h-4 text-amber-400" fill="currentColor" />
            <span className="font-mono font-bold text-amber-300 text-lg leading-none">{s.atp}</span>
            <span className="text-xs text-amber-400/70 leading-none mt-0.5">ATP</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-rose-500/15 border border-rose-500/30">
            <Heart className="w-4 h-4 text-rose-400" fill="currentColor" />
            <span className="font-mono font-bold text-rose-300 text-lg leading-none">
              Wave {s.wave || "—"}
              <span className="text-xs text-rose-400/70 ml-1">/ {WAVES.length}</span>
            </span>
          </div>
          {s.inWave && (
            <div className="text-sm text-muted-foreground">
              <span className="text-rose-300 font-mono">{waveRemaining}</span> pathogens remain
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {inflamedRows.length > 0 && (
            <div className="warning-flash flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-200">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-semibold">
                Inflammation: lane{inflamedRows.length > 1 ? "s" : ""} {inflamedRows.map((r) => r + 1).join(", ")}
              </span>
            </div>
          )}
          {!s.inWave && s.status === "playing" && s.wave < WAVES.length && (
            <button
              onClick={nextWave}
              className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition shadow-lg shadow-rose-600/30"
            >
              {s.wave === 0 ? "Start Wave 1" : `Begin Wave ${s.wave + 1}`}
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            className="px-3 py-1.5 rounded-md text-sm border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition"
          >
            How to play
          </button>
        </div>
      </header>

      {/* Main play area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              stateRef.current.hoveredCell = null;
            }}
            className="rounded-lg shadow-2xl border border-rose-900/40 max-w-full max-h-[calc(100vh-260px)]"
            style={{ cursor: s.selectedType ? "crosshair" : "default" }}
          />

          {/* Menu overlay */}
          {s.status === "menu" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-rose-800 shadow-2xl shadow-rose-500/50">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold mb-3 tracking-tight">
                Immune <span className="text-primary">Defense</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mb-2">
                Pathogens are invading the bloodstream.
              </p>
              <p className="text-muted-foreground max-w-md mb-8">
                Deploy white blood cells along the artery walls. Just don't overcrowd — too many cells trigger inflammation.
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-lg transition shadow-xl shadow-rose-600/40"
              >
                Begin Defense
              </button>
            </div>
          )}

          {/* Lost overlay */}
          {s.status === "lost" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-4 text-6xl">☠</div>
              <h2 className="text-4xl font-bold mb-2 text-rose-400">Infection Spread</h2>
              <p className="text-muted-foreground mb-1">The pathogens broke through your defenses.</p>
              <p className="text-muted-foreground mb-6">You held out until wave {s.wave}.</p>
              <button
                onClick={restartGame}
                className="px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Won overlay */}
          {s.status === "won" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-4 text-6xl">🛡</div>
              <h2 className="text-4xl font-bold mb-2 text-emerald-400">Immunity Achieved</h2>
              <p className="text-muted-foreground mb-6">All {WAVES.length} waves repelled. The body is safe.</p>
              <button
                onClick={restartGame}
                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom defender deck */}
      <div className="p-4 bg-card/80 backdrop-blur border-t border-border z-10">
        <div className="flex gap-3 justify-center flex-wrap">
          {(Object.keys(DEFENDERS) as DefenderType[]).map((type) => {
            const cfg = DEFENDERS[type];
            const cooldown = (s.cooldowns[type] ?? 0) - s.time;
            const onCooldown = cooldown > 0;
            const tooExpensive = s.atp < cfg.cost;
            const disabled = onCooldown || tooExpensive;
            const selected = s.selectedType === type;
            return (
              <button
                key={type}
                onClick={() => selectDefender(type)}
                disabled={disabled}
                className={`card-defender relative rounded-lg p-2 w-24 text-left ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                title={cfg.description}
              >
                <div className="h-14 flex items-center justify-center relative">
                  <DefenderIcon type={type} />
                </div>
                <div className="text-xs font-semibold text-foreground truncate">{cfg.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Zap className="w-3 h-3 text-amber-400" fill="currentColor" />
                  <span className={`text-xs font-mono font-bold ${tooExpensive ? "text-rose-400" : "text-amber-300"}`}>
                    {cfg.cost}
                  </span>
                </div>
                {onCooldown && (
                  <div className="cooldown-overlay rounded-lg">
                    <span className="text-sm font-bold text-white">{Math.ceil(cooldown / 1000)}s</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Help modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function DefenderIcon({ type }: { type: DefenderType }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 60, 60);
    drawDefenderShape(ctx, type, 30, 28, 0);
  }, [type]);
  return <canvas ref={ref} width={60} height={60} className="pointer-events-none" />;
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-card border border-border rounded-xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">How to Play</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold text-base mb-1 text-rose-300">The Battlefield</h3>
            <p className="text-muted-foreground">
              Five lanes of arteries run through the body. Pathogens enter from the right and march toward your bloodstream entry on the left. If even one breaks through, you lose.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1 text-amber-300">Resources</h3>
            <p className="text-muted-foreground">
              <strong className="text-amber-300">ATP</strong> is your currency. Stem Cells generate ATP drops that you click to collect. Each defender has an ATP cost and a cooldown before you can deploy it again.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1 text-yellow-300">⚠ Inflammation</h3>
            <p className="text-muted-foreground">
              Place too many cells in one lane (3+) and that lane becomes inflamed. Pathogens move slower through inflamed lanes — but Stem Cells in those lanes generate ATP at half speed. Plan your placement.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 text-rose-300">Defenders</h3>
            <ul className="space-y-1.5 text-muted-foreground">
              {(Object.keys(DEFENDERS) as DefenderType[]).map((t) => (
                <li key={t}>
                  <strong className="text-foreground">{DEFENDERS[t].name}</strong> — {DEFENDERS[t].description}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2 text-rose-300">Pathogens</h3>
            <ul className="space-y-1.5 text-muted-foreground">
              {(Object.keys(PATHOGENS) as (keyof typeof PATHOGENS)[]).map((t) => {
                const c = PATHOGENS[t];
                return (
                  <li key={t}>
                    <strong className="text-foreground">{c.name}</strong> — {c.hp} HP, speed {c.speed}, reward {c.reward} ATP
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
