import { useEffect, useRef, useState } from "react";
import type { GameState, DefenderType } from "./types";
import { DEFENDERS, PATHOGENS, CANVAS_W, CANVAS_H, WAVES, ROWS, INFLAMMATION_THRESHOLD, applyDifficulty, getDifficulty, type Difficulty, GRID_OFFSET_Y, CELL_H } from "./config";
import { createInitialState, tick, startWave, clickAtCanvas, hoverAtCanvas, canPlaceAt, recomputeInflammation } from "./engine";
import { enableAudio, playSound, playBackground, stopBackground, muteAudio, unmuteAudio, isAudioMuted, muteMusic, unmuteMusic, isMusicMuted, muteSfx, unmuteSfx, isSfxMuted } from "./audio";
import {
  drawBackground,
  drawDefender,
  drawPathogen,
  drawProjectile,
  drawEffect,
  drawAtpDrop,
  drawHoverCell,
  drawDefenderShape,
  drawPathogenShape,
} from "./draw";
import { AlertTriangle, Zap, Heart, Shield, Syringe, Menu, X, Play, Pause, BookOpen, Settings2 } from "lucide-react";

// ─── Animated background (same particles as landing page) ────────────────────
interface CellParticle {
  id: number; x: number; y: number; r: number;
  color: string; speed: number; opacity: number; wobble: number;
}

function useCells(count = 20) {
  const colors = ["#f5d76e","#e8e8f0","#9b59b6","#3498db","#e85a5a","#5a8c4f","#ff5e3a","#7d4f30"];
  const ref = useRef<CellParticle[]>([]);
  if (ref.current.length === 0) {
    ref.current = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: 10 + (i % 5) * 18 + Math.random() * 8,
      r: 8 + Math.random() * 14,
      color: colors[i % colors.length],
      speed: 0.006 + Math.random() * 0.008,
      opacity: 0.12 + Math.random() * 0.18,
      wobble: Math.random() * Math.PI * 2,
    }));
  }
  return ref.current;
}

function AnimatedBackground() {
  const cells = useCells(20);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t = 0;
    let raf = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      // Lane lines
      for (let i = 0; i < 5; i++) {
        const ly = (i / 4.5) * h * 0.9 + h * 0.05;
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.3 + Math.sin(t * 0.4 + i) * 0.2, "rgba(180,30,50,0.09)");
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
      }

      // Moving cells
      for (const cell of cells) {
        cell.x += cell.speed;
        if (cell.x > 110) cell.x = -10;
        const cx = (cell.x / 100) * w;
        const baseY = (cell.y / 100) * h;
        const cy = baseY + Math.sin(t * 1.2 + cell.wobble) * 6;

        // Glow
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell.r * 2.5);
        grd.addColorStop(0, cell.color + "33");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cell.r * 2.5, cell.r * 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.globalAlpha = cell.opacity + Math.sin(t * 1.5 + cell.wobble) * 0.04;
        ctx.fillStyle = cell.color;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cell.r, cell.r * 0.78, t * 0.3 + cell.wobble, 0, Math.PI * 2);
        ctx.fill();

        // Nucleus
        ctx.globalAlpha = cell.opacity * 0.5;
        ctx.fillStyle = "#00000044";
        ctx.beginPath();
        ctx.ellipse(cx - cell.r * 0.15, cy - cell.r * 0.1, cell.r * 0.35, cell.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Vignette
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [cells]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

export function Game({ onMainMenu }: { onMainMenu?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const [, force] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [muted, setMuted] = useState<boolean>(isAudioMuted());
  const [difficulty, setDifficultyState] = useState<Difficulty>(getDifficulty());
  const [shouldUnpauseOnClose, setShouldUnpauseOnClose] = useState(false);
  const [shoveMode, setShoveMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Start music as soon as game opens
  useEffect(() => {
    try { enableAudio(); playBackground(); } catch (e) {}
  }, []);

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
          ctx.fillRect(0, GRID_OFFSET_Y + s.warningRow * CELL_H, CANVAS_W, CELL_H);
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
      // If shove mode, try to remove defender under cursor
      hoverAtCanvas(stateRef.current, x, y);
      const hovered = stateRef.current.hoveredCell;
      if (shoveMode && hovered && stateRef.current.status === "playing") {
        const row = hovered.row;
        const col2 = hovered.col;
        const defenderIndex = stateRef.current.defenders.findIndex((d) => d.row === row && d.col === col2);
        if (defenderIndex >= 0) {
          const def = stateRef.current.defenders[defenderIndex];
          const refund = Math.floor((DEFENDERS[def.type].cost || 0) / 2);
          stateRef.current.atp += refund;
          stateRef.current.defenders.splice(defenderIndex, 1);
          recomputeInflammation(stateRef.current);
          try { playSound("ui_click"); } catch (e) {}
          force((x) => (x + 1) % 100000);
          return;
        }
      }

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
    // Apply difficulty scaling before creating the game state
    applyDifficulty();
    // Enable audio on first user gesture
    try { enableAudio(); playSound("ui_click"); } catch (e) {}
    s.status = "playing";
    startWave(s, 1);
    try { playBackground(); } catch (e) {}
    force((x) => (x + 1) % 100000);
  };

  const restartGame = () => {
    try { enableAudio(); playSound("ui_click"); } catch (e) {}
    applyDifficulty();
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
    // clear awaiting state and unpause before starting next wave
    s.awaitingNextWave = false;
    s.paused = false;
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
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
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
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.06em" }}
            >
              {s.wave === 0 ? "Start Wave 1" : `Begin Wave ${s.wave + 1}`}
            </button>
          )}
          {/* Single menu button */}
          <button
            onClick={() => {
              // Auto-pause when opening menu (music keeps playing)
              if (!stateRef.current.paused) {
                stateRef.current.paused = true;
                setShouldUnpauseOnClose(true);
              }
              setShowMenu(true);
              try { playSound("ui_click"); } catch (e) {}
              force((x) => (x + 1) % 100000);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition"
            style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, letterSpacing: "0.04em" }}
          >
            <Menu className="w-4 h-4" />
            Menu
          </button>
        </div>
      </header>

      {/* Main play area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden" style={{ minHeight: 0, background: "linear-gradient(160deg,#1a0308 0%,#2a0808 50%,#160210 100%)" }}>
        {/* Animated particle background fills the side panels */}
        <AnimatedBackground />
        {/* Subtle scanlines */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px)" }} />
        <div
          className="relative"
          style={{
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
            height: "100%",
            width: "auto",
            maxWidth: "100%",
            zIndex: 2,
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              stateRef.current.hoveredCell = null;
            }}
            className="absolute inset-0 w-full h-full rounded-lg shadow-2xl border border-rose-900/40"
            style={{ cursor: s.selectedType ? "crosshair" : "default" }}
          />

          {/* Menu overlay */}
          {s.status === "menu" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-rose-800 shadow-2xl shadow-rose-500/50">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl font-bold mb-3 tracking-tight" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
                Immune <span className="text-primary">Defense</span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-md mb-2" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Pathogens are invading the bloodstream.
              </p>
              <p className="text-muted-foreground max-w-md mb-8" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
                Deploy white blood cells along the artery walls. Just don't overcrowd — too many cells trigger inflammation.
              </p>
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-lg transition shadow-xl shadow-rose-600/40"
                style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}
              >
                Begin Defense
              </button>
            </div>
          )}

          {/* Lost overlay */}
          {s.status === "lost" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-4 text-6xl">☠</div>
              <h2 className="text-4xl font-bold mb-2 text-rose-400" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Infection Spread</h2>
              <p className="text-muted-foreground mb-1" style={{ fontFamily: "'Rajdhani', sans-serif" }}>The pathogens broke through your defenses.</p>
              <p className="text-muted-foreground mb-6" style={{ fontFamily: "'Rajdhani', sans-serif" }}>You held out until wave {s.wave}.</p>
              <button
                onClick={restartGame}
                className="px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
                style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Won overlay */}
          {s.status === "won" && (
            <div className="absolute inset-0 rounded-lg bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center px-8">
              <div className="mb-4 text-6xl">🛡</div>
              <h2 className="text-4xl font-bold mb-2 text-emerald-400" style={{ fontFamily: "'Cinzel Decorative', serif" }}>Immunity Achieved</h2>
              <p className="text-muted-foreground mb-6" style={{ fontFamily: "'Rajdhani', sans-serif" }}>All {WAVES.length} waves repelled. The body is safe.</p>
              <button
                onClick={restartGame}
                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
                style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, letterSpacing: "0.08em" }}
              >
                Play Again
              </button>
            </div>
          )}

          {/* Wave cleared / Awaiting next wave overlay */}
          {s.awaitingNextWave && s.status === "playing" && (
            <div className="absolute inset-0 rounded-lg flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg" />
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-4">
                <h2 className="text-3xl font-bold mb-2 text-amber-300" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
                  Wave {s.wave} cleared!
                </h2>
                <p className="text-muted-foreground mb-4">Prepare your defenses before the next onslaught.</p>
                <button
                  onClick={() => {
                    try { playSound("ui_click"); } catch (e) {}
                    // ensure awaiting flag cleared and game unpaused
                    stateRef.current.awaitingNextWave = false;
                    stateRef.current.paused = false;
                    nextWave();
                    force((x) => (x + 1) % 100000);
                  }}
                  className="px-6 py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-lg shadow-rose-600/30"
                  style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}
                >
                  Begin the next wave
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom defender deck */}
      <div className="p-4 bg-card/80 backdrop-blur border-t border-border z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 flex items-center gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                setShoveMode((v) => !v);
                try { playSound("ui_click"); } catch (e) {}
                force((x) => (x + 1) % 100000);
              }}
              title="Inject (remove defenders)"
              className={`card-defender relative rounded-lg p-2 w-28 text-left flex flex-col items-center justify-center ${shoveMode ? "selected" : ""}`}
            >
              <div className="h-16 flex items-center justify-center relative">
                <Syringe className="w-9 h-9 text-rose-400" />
              </div>
              <div className="text-xs font-semibold text-foreground truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>INJECT</div>
            </button>
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
                  className={`card-defender relative rounded-lg p-2 w-28 text-left ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                  title={cfg.description}
                >
                  <div className="h-16 flex items-center justify-center relative">
                    <DefenderIcon type={type} />
                  </div>
                  <div className="text-xs font-semibold text-foreground truncate" style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700 }}>{cfg.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Zap className="w-3 h-3 text-amber-400" fill="currentColor" />
                    <span className={`text-xs font-mono font-bold ${tooExpensive ? "text-rose-400" : "text-amber-300"}`} style={{ fontFamily: "'Rajdhani', sans-serif" }}>
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
      </div>

      {/* Menu popup */}
      {showMenu && (
        <MenuModal
          onClose={() => {
            setShowMenu(false);
            if (shouldUnpauseOnClose) {
              stateRef.current.paused = false;
              setShouldUnpauseOnClose(false);
              force((x) => (x + 1) % 100000);
            }
          }}
          onHowToPlay={() => {
            setShowMenu(false);
            setShowHelp(true);
          }}
          onSettings={() => {
            setShowMenu(false);
            setShowSettings(true);
          }}
          onMainMenu={() => {
            setShowMenu(false);
            setShouldUnpauseOnClose(false);
            stateRef.current = createInitialState();
            if (onMainMenu) onMainMenu();
            else force((x) => (x + 1) % 100000);
          }}
        />
      )}

      {/* Help modal */}
      {showHelp && (
        <HelpModal
          onClose={() => {
            setShowHelp(false);
            setShowMenu(true);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false);
            setShowMenu(true);
          }}
          muted={muted}
          onToggleMute={() => {
            try { playSound("ui_click"); } catch (e) {}
            if (muted) {
              unmuteAudio();
              setMuted(false);
            } else {
              muteAudio();
              setMuted(true);
            }
          }}
          onRestart={() => {
            try { playSound("ui_click"); } catch (e) {}
            restartGame();
            setShowSettings(false);
          }}
          difficulty={difficulty}
          onDifficultyChange={(d) => {
            localStorage.setItem("difficulty", d);
            setDifficultyState(d);
            try { playSound("ui_click"); } catch (e) {}
          }}
        />
      )}
      
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

function PathogenIcon({ type }: { type: keyof typeof PATHOGENS }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);
    drawPathogenShape(ctx, type, 24, 24, 0);
  }, [type]);
  return <canvas ref={ref} width={48} height={48} className="pointer-events-none" />;
}

function MenuModal({ onClose, onHowToPlay, onSettings, onMainMenu }: {
  onClose: () => void;
  onHowToPlay: () => void;
  onSettings: () => void;
  onMainMenu: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const menuBtn: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    gap: "0.5rem", padding: "0.8rem 1rem", borderRadius: "0.75rem",
    fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em",
    cursor: "pointer", transition: "all 0.15s ease",
    fontFamily: "system-ui, sans-serif",
    background: "rgba(18,3,8,0.7)", color: "#ccaabb",
    border: "1px solid #4a0e0e",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "360px", width: "100%",
          background: "rgba(40,6,10,0.97)",
          border: "2px solid #7a1c1c",
          borderRadius: "1.75rem",
          boxShadow: "0 0 60px rgba(200,20,40,0.15), 0 8px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "1.25rem 1.5rem",
          background: "rgba(25,4,8,0.8)",
          borderBottom: "1px solid #5a1010",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{
            fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.2em",
            color: "#fff", fontFamily: "'Courier New', monospace",
          }}>
            PAUSED
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#664455", fontSize: "1.4rem", lineHeight: 1,
              transition: "color 0.15s",
              padding: "2px 6px", borderRadius: "0.4rem",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffaabb")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#664455")}
          >×</button>
        </div>

        {/* Buttons */}
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>

          {/* Resume — green accent like original, but refined */}
          <button
            onClick={onClose}
            style={{
              ...menuBtn,
              background: "linear-gradient(135deg,#16a34a,#15803d)",
              color: "#fff",
              border: "2px solid #22c55e",
              boxShadow: "0 0 20px rgba(34,197,94,0.25)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#22c55e,#16a34a)"; e.currentTarget.style.boxShadow = "0 0 28px rgba(34,197,94,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#16a34a,#15803d)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(34,197,94,0.25)"; }}
          >
            <Play style={{ width: "1rem", height: "1rem" }} /> Resume
          </button>

          {/* How to Play */}
          <button
            onClick={onHowToPlay}
            style={menuBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(30,8,14,0.9)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#7a1c1c"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(18,3,8,0.7)"; e.currentTarget.style.color = "#ccaabb"; e.currentTarget.style.borderColor = "#4a0e0e"; }}
          >
            <BookOpen style={{ width: "1rem", height: "1rem", color: "#38bdf8" }} /> How to Play
          </button>

          {/* Settings */}
          <button
            onClick={onSettings}
            style={menuBtn}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(30,8,14,0.9)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#7a1c1c"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(18,3,8,0.7)"; e.currentTarget.style.color = "#ccaabb"; e.currentTarget.style.borderColor = "#4a0e0e"; }}
          >
            <Settings2 style={{ width: "1rem", height: "1rem", color: "#f87171" }} /> Settings
          </button>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(100,15,25,0.5)", margin: "0.2rem 0" }} />

          {/* Main Menu — danger red tone */}
          <button
            onClick={onMainMenu}
            style={{
              ...menuBtn,
              background: "linear-gradient(135deg,#7f1d1d,#5a0f0f)",
              color: "#ffbbcc",
              border: "2px solid #aa2233",
              borderBottom: "4px solid #440a10",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#991b1b,#7f1d1d)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "linear-gradient(135deg,#7f1d1d,#5a0f0f)"; e.currentTarget.style.color = "#ffbbcc"; }}
          >
            <Shield style={{ width: "1rem", height: "1rem" }} /> Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <style>{`.help-scroll::-webkit-scrollbar{width:6px}.help-scroll::-webkit-scrollbar-track{background:rgba(20,2,6,0.8);border-radius:999px}.help-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#aa2233,#6b0011);border-radius:999px}.help-scroll::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#cc3344,#880016)}.help-scroll{scrollbar-width:thin;scrollbar-color:#aa2233 rgba(20,2,6,0.8)}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "860px", width: "100%", maxHeight: "90vh",
          background: "rgba(40,6,10,0.97)",
          border: "2px solid #7a1c1c",
          borderRadius: "1.75rem",
          boxShadow: "0 0 60px rgba(200,20,40,0.15), 0 8px 40px rgba(0,0,0,0.6)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
          fontFamily: "system-ui, sans-serif",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header band — matches MenuModal/SettingsModal */}
        <div style={{
          padding: "1.25rem 1.5rem",
          background: "rgba(25,4,8,0.8)",
          borderBottom: "1px solid #5a1010",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.2em",
            color: "#fff", fontFamily: "'Courier New', monospace",
          }}>HOW TO PLAY</div>
        </div>

        {/* Scrollable content */}
        <div className="help-scroll" style={{ overflowY: "auto", padding: "2rem 2.5rem 2.5rem" }}>

        {/* Intro blurbs */}
        <div style={{ marginBottom: "1.5rem", lineHeight: 1.7, fontSize: "0.95rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#ee3344", fontWeight: 700 }}>Goal:</span>{" "}
            <span style={{ color: "#ccc" }}>Defend your body from pathogens by placing immune cells across 5 artery lanes.</span>
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>ATP:</span>{" "}
            <span style={{ color: "#ccc" }}>Your currency — earned over time and by defeating pathogens. Click ATP drops to collect them!</span>
          </p>
                      <p>
              <span style={{ color: "#e7522c", fontWeight: 700 }}>Inject: </span>
              Remove a defender to recover half of its ATP cost.
            </p>
          <p>
            <span style={{ color: "#f59e0b", fontWeight: 700 }}>⚠ Inflammation:</span>{" "}
            <span style={{ color: "#ccc" }}>Place 3+ defenders in one lane and it becomes inflamed — pathogens slow, but Stem Cells generate ATP at half speed.</span>
          </p>
        </div>

        {/* Defenders */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ color: "#ee3344", fontSize: "1rem" }}>♡</span>
            <span style={{ color: "#ee3344", fontWeight: 800, letterSpacing: "0.18em", fontSize: "0.85rem", textTransform: "uppercase" }}>Defenders</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
            {(Object.keys(DEFENDERS) as DefenderType[]).map((type) => {
              const cfg = DEFENDERS[type];
              const defenderDescriptions: Record<string, string> = {
                stem:       "Generates ATP drops over time. Your economic backbone — place early and often.",
                neutrophil: "Fires antibodies at the first pathogen in its lane. Reliable long-range attacker.",
                eosinophil: "Chomps pathogens that wander close. Tough melee fighter with big HP.",
                basophil:   "Releases toxic spore clouds that slow and damage nearby pathogens.",
                monocyte:   "Leaps forward and squashes the first pathogen in its lane. One-time use.",
                tcell:      "A buried mine that detonates on contact, dealing massive area damage.",
                bcell:      "Fires antibody bursts across 3 adjacent lanes simultaneously. Premium power.",
                platelet:   "Ignites the entire lane in fire, burning all pathogens passing through.",
              };
              return (
                <div key={type} style={{
                  background: "rgba(18,3,8,0.8)", border: "1px solid #4a0e0e",
                  borderRadius: "0.875rem", padding: "1rem", textAlign: "center",
                }}>
                  <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
                    <DefenderIcon type={type} />
                  </div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.4rem" }}>{cfg.name}</div>
                  <div style={{ display: "flex", gap: "0.35rem", justifyContent: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ background: "#1a3a10", color: "#4ade80", fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "999px" }}>⚡ {cfg.cost} ATP</span>
                    <span style={{ background: "#3a1010", color: "#f87171", fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "999px" }}>♥ {(cfg as any).hp ?? 1}</span>
                  </div>
                  <div style={{ color: "#888", fontSize: "0.75rem", lineHeight: 1.4 }}>{defenderDescriptions[type] ?? cfg.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pathogens */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ color: "#ee3344", fontSize: "1rem" }}>☣</span>
            <span style={{ color: "#ee3344", fontWeight: 800, letterSpacing: "0.18em", fontSize: "0.85rem", textTransform: "uppercase" }}>Pathogens</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {(Object.keys(PATHOGENS) as (keyof typeof PATHOGENS)[]).sort((a, b) => {
              const order: Record<string, number> = { low: 0, medium: 1, high: 2, extreme: 3 };
              const getLevel = (hp: number) => hp >= 500 ? "extreme" : hp >= 300 ? "high" : hp >= 200 ? "medium" : "low";
              return order[getLevel(PATHOGENS[a].hp)] - order[getLevel(PATHOGENS[b].hp)];
            }).map((type) => {
              const c = PATHOGENS[type];
              const threatColor = c.hp >= 500 ? "#7c3aed" : c.hp >= 300 ? "#ef4444" : c.hp >= 200 ? "#f59e0b" : "#22c55e";
              const threatLabel = c.hp >= 500 ? "EXTREME" : c.hp >= 300 ? "HIGH" : c.hp >= 200 ? "MEDIUM" : "LOW";
              const descFallbacks: Record<string, string> = {
                prokaryote: "Fast rod-shaped bacteria with flagella. Weak but arrives in swarms early on.",
                virus: "Spiky icosahedral particle — the fastest pathogen. Fragile but dangerously quick.",
                parasite: "Segmented worm that wiggles through your defenses at moderate speed.",
                protozoa: "Amoeba-like blob with pseudopods. Harder to kill and hits reasonably hard.",
                fungi: "Mushroom-shaped invader with high HP. Slow but absorbs a lot of punishment.",
                prion: "Misfolded protein cluster — the final boss. Massive HP, crushing damage, and a pulsing core that resists most attacks.",
              };
              const description = (c as any).description || descFallbacks[type.toLowerCase()] || "";
              return (
                <div key={type} style={{
                  background: "rgba(18,3,8,0.8)", border: "1px solid #4a0e0e",
                  borderRadius: "0.875rem", padding: "0.875rem 1rem",
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.4rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
                    <div style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <PathogenIcon type={type} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <span style={{ color: "#fff", fontWeight: 700 }}>{c.name}</span>
                        <span style={{ background: threatColor + "33", color: threatColor, fontSize: "0.6rem", fontWeight: 800, padding: "2px 7px", borderRadius: "999px", letterSpacing: "0.1em" }}>{threatLabel}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                        <span style={{ background: "#0a1a0a", color: "#4ade80", fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", border: "1px solid #1a4a1a" }}>HP {c.hp}</span>
                        <span style={{ background: "#0a0a1a", color: "#60a5fa", fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", border: "1px solid #1a1a4a" }}>SPD {c.speed}</span>
                        <span style={{ background: "#1a0a0a", color: "#f87171", fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", border: "1px solid #4a1a1a" }}>DMG {c.damage ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ color: "#888", fontSize: "0.78rem", lineHeight: 1.4 }}>{description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "0.9rem",
            borderRadius: "1rem", fontWeight: 700, fontSize: "1rem",
            letterSpacing: "0.12em", cursor: "pointer",
            background: "linear-gradient(135deg,#7f1d1d,#5a0f0f)",
            color: "#ffbbcc", border: "2px solid #aa2233",
            borderBottom: "5px solid #440a10",
          }}
        >← BACK</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ onClose, muted, onToggleMute, onRestart, difficulty, onDifficultyChange }: {
  onClose: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
}) {
  const [musicOn, setMusicOn] = useState(!isMusicMuted());
  const [sfxOn, setSfxOn] = useState(!isSfxMuted());
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const section: React.CSSProperties = {
    borderRadius: "1.25rem", background: "rgba(18,3,8,0.7)",
    border: "1px solid #4a0e0e", padding: "1.25rem 1.5rem", marginBottom: "0.875rem",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "400px", width: "100%",
          background: "rgba(40,6,10,0.97)", border: "2px solid #7a1c1c",
          borderRadius: "1.75rem",
          boxShadow: "0 0 60px rgba(200,20,40,0.15), 0 8px 40px rgba(0,0,0,0.6)",
          overflow: "hidden",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "1.5rem", textAlign: "center",
          background: "rgba(25,4,8,0.8)", borderBottom: "1px solid #5a1010",
        }}>
          <div style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "0.18em", color: "#fff", fontFamily: "'Courier New', monospace" }}>
            SETTINGS
          </div>
        </div>

        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          {/* Audio */}
          <div style={section}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "#663344", marginBottom: "0.875rem" }}>Audio</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>Music</div>
                <div style={{ color: "#554455", fontSize: "0.75rem", marginTop: "2px" }}>Background soundtrack</div>
              </div>
              <SettingsToggle on={musicOn} onToggle={() => {
                const n = !musicOn; setMusicOn(n);
                try { playSound("ui_click"); } catch (e) {}
                if (n) { unmuteMusic(); try { playBackground(); } catch (e) {} } else { muteMusic(); }
              }} />
            </div>
            <div style={{ height: "1px", background: "rgba(100,15,25,0.4)", margin: "1rem 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>Sound Effects</div>
                <div style={{ color: "#554455", fontSize: "0.75rem", marginTop: "2px" }}>Attacks, explosions & UI</div>
              </div>
              <SettingsToggle on={sfxOn} onToggle={() => {
                const n = !sfxOn; setSfxOn(n);
                if (n) { unmuteSfx(); try { playSound("ui_click"); } catch (e) {} } else { muteSfx(); }
              }} />
            </div>
          </div>

          {/* Difficulty */}
          <div style={section}>
            <div style={{ fontSize: "0.62rem", letterSpacing: "0.22em", textTransform: "uppercase", color: "#663344", marginBottom: "0.875rem" }}>Difficulty</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["Normal", "Hard", "Brutal"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onDifficultyChange(d)}
                  style={{
                    flex: 1, padding: "0.5rem 0", borderRadius: "0.6rem",
                    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer",
                    transition: "all 0.15s",
                    background: difficulty === d ? "linear-gradient(135deg,#ee3344,#aa0022)" : "rgba(35,6,10,0.7)",
                    color: difficulty === d ? "#fff" : "#664455",
                    border: difficulty === d ? "2px solid #cc1133" : "1px solid #3a0810",
                    boxShadow: difficulty === d ? "0 0 16px rgba(200,20,40,0.35)" : "none",
                  }}
                >{d}</button>
              ))}
            </div>
          </div>

          {/* Restart */}
          <div style={section}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: 700 }}>Restart</div>
                <div style={{ color: "#554455", fontSize: "0.75rem", marginTop: "2px" }}>Restart the current run</div>
              </div>
              <button
                onClick={onRestart}
                style={{
                  padding: "0.4rem 0.9rem", borderRadius: "0.5rem", fontSize: "0.8rem",
                  fontWeight: 700, cursor: "pointer", background: "#be123c",
                  color: "#fff", border: "none",
                }}
              >Restart</button>
            </div>
          </div>

          {/* Version */}
          <div style={{
            textAlign: "center", padding: "0.625rem", borderRadius: "0.75rem",
            background: "rgba(14,2,6,0.5)", border: "1px solid #2a0810", marginBottom: "1rem",
          }}>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "#441a22" }}>IMMUNE DEFENSE · VERSION 1.0.0</span>
          </div>
        </div>

        {/* Back */}
        <div style={{ padding: "0 1.25rem 1.5rem" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "0.9rem", borderRadius: "1rem",
              fontWeight: 700, fontSize: "1rem", letterSpacing: "0.12em", cursor: "pointer",
              background: "linear-gradient(135deg,#7f1d1d,#5a0f0f)",
              color: "#ffbbcc", border: "2px solid #aa2233", borderBottom: "5px solid #440a10",
            }}
          >← BACK</button>
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "60px", height: "32px", borderRadius: "32px", padding: "4px",
        background: on ? "linear-gradient(135deg,#ee3344,#aa0022)" : "rgba(50,10,16,0.8)",
        border: on ? "2px solid #cc1133" : "2px solid #441122",
        boxShadow: on ? "0 0 16px rgba(200,20,40,0.4)" : "none",
        cursor: "pointer", transition: "all 0.25s ease",
        display: "flex", alignItems: "center",
      }}
    >
      <div style={{
        width: "20px", height: "20px", borderRadius: "50%",
        background: on ? "#fff" : "#553344",
        transform: on ? "translateX(28px)" : "translateX(0)",
        transition: "transform 0.25s ease, background 0.25s ease",
      }} />
    </button>
  );
}