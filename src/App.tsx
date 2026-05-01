import { useState, useEffect, useRef } from "react";
import { Game } from "./game/Game";
import {
  muteMusic, unmuteMusic, isMusicMuted,
  muteSfx, unmuteSfx, isSfxMuted,
  enableAudio, playBackground, tryAutoplay, playSound,
} from "./game/audio";
import { drawDefenderShape, drawPathogenShape } from "./game/draw";
import type { DefenderType, PathogenType } from "./game/types";

type Page = "landing" | "game" | "help" | "settings";

// ─── Floating Cell background particle ───────────────────────────────────────
interface CellParticle {
  id: number;
  x: number;
  y: number;
  r: number;
  color: string;
  speed: number;
  opacity: number;
  wobble: number;
}

function useCells(count = 20) {
  const colors = [
    "#f5d76e", "#e8e8f0", "#9b59b6", "#3498db",
    "#e85a5a", "#5a8c4f", "#ff5e3a", "#7d4f30",
  ];
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

// ─── Landing Page ─────────────────────────────────────────────────────────────
function LandingPage({ onPlay, onHelp, onSettings }: {
  onPlay: () => void; onHelp: () => void; onSettings: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const audioStarted = useRef(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  // Ensure audio context is running and play a click SFX
  const ensureAudio = () => {
    try {
      enableAudio();
      if (!audioStarted.current) {
        audioStarted.current = true;
        setTimeout(() => { try { playBackground(); } catch (e) {} }, 100);
      }
      playSound("ui_click");
    } catch (e) {}
  };

  const btnBase: React.CSSProperties = {
    width: "100%",
    border: "none",
    borderRadius: "1rem",
    cursor: "pointer",
    fontWeight: 700,
    letterSpacing: "0.1em",
    transition: "all 0.13s ease",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg,#1a0308 0%,#2a0808 50%,#160210 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: "system-ui, sans-serif",
      userSelect: "none",
    }}>
      <AnimatedBackground />

      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.025) 3px,rgba(0,0,0,0.025) 4px)",
      }} />

      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column", alignItems: "center",
        maxWidth: "360px", width: "100%", margin: "0 1rem",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}>
        {/* Logo + Title — no card box */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          marginBottom: "2rem",
        }}>
          {/* Logo orb */}
          <div style={{ position: "relative", marginBottom: "1.5rem" }}>
            <div style={{
              width: "96px", height: "96px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulseOrb 2.4s ease-in-out infinite",
              background: "radial-gradient(circle at 35% 35%, #ff3355, #6b0011)",
              overflow: "hidden",
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="72" height="72">
                <defs>
                  <radialGradient id="lg" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ff8fa8"/>
                    <stop offset="100%" stopColor="#c0304d"/>
                  </radialGradient>
                </defs>
                <circle cx="16" cy="16" r="14" fill="url(#lg)"/>
                <path d="M16 6 L24 10 V17 C24 21 20 25 16 26 C12 25 8 21 8 17 V10 Z" fill="rgba(255,255,255,0.92)"/>
                <path d="M13 17 L15.5 19.5 L20 14" stroke="#c0304d" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "2px solid rgba(200,20,40,0.5)",
              animation: "ripple 2.4s ease-out infinite",
            }} />
          </div>

          {/* Title */}
          <div style={{ lineHeight: 0.9, textAlign: "center", marginBottom: "0.6rem" }}>
            <div style={{
              fontSize: "5.5rem", fontWeight: 900, letterSpacing: "0.08em",
              color: "#fff", textShadow: "0 0 40px rgba(255,80,100,0.6)",
              fontFamily: "'Cinzel Decorative', serif",
            }}>IMMUNE</div>
            <div style={{
              fontSize: "6.2rem", fontWeight: 900, letterSpacing: "0.04em",
              background: "linear-gradient(135deg,#ff6680,#ff2244)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              fontFamily: "'Cinzel Decorative', serif",
              filter: "drop-shadow(0 0 20px rgba(255,50,80,0.7))",
            }}>DEFENSE</div>
          </div>

          <div style={{
            fontSize: "0.68rem", letterSpacing: "0.28em", color: "#884455",
            textTransform: "uppercase", marginTop: "0.35rem",
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
          }}>Tower Defense · Immunology</div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", width: "100%" }}>
          {/* PLAY */}
          <button
            onClick={() => { ensureAudio(); onPlay(); }}
            onMouseEnter={() => setHover("play")}
            onMouseLeave={() => setHover(null)}
            style={{
              ...btnBase,
              padding: "1.1rem 2rem",
              fontSize: "1.55rem",
              fontWeight: 900,
              color: "#fff",
              background: hover === "play"
                ? "linear-gradient(135deg,#ff5544,#cc1133)"
                : "linear-gradient(135deg,#ee3344,#aa0022)",
              borderBottom: hover === "play" ? "3px solid #770011" : "6px solid #770011",
              transform: hover === "play" ? "translateY(3px) scale(1.01)" : "scale(1)",
              boxShadow: hover === "play"
                ? "0 4px 32px rgba(220,30,50,0.55)"
                : "0 6px 24px rgba(200,20,40,0.35)",
            }}
          >▶ &nbsp;PLAY</button>

          {/* HOW TO PLAY */}
          <button
            onClick={() => { ensureAudio(); onHelp(); }}
            onMouseEnter={() => setHover("help")}
            onMouseLeave={() => setHover(null)}
            style={{
              ...btnBase,
              padding: "0.85rem 2rem",
              fontSize: "1rem",
              color: hover === "help" ? "#ffbbcc" : "#cc6677",
              background: hover === "help" ? "rgba(110,18,28,0.7)" : "rgba(70,8,16,0.6)",
              border: `2px solid ${hover === "help" ? "#cc3344" : "#551122"}`,
              borderBottom: hover === "help" ? "4px solid #880022" : "6px solid #3a0810",
              backdropFilter: "blur(6px)",
              transform: hover === "help" ? "translateY(2px)" : "translateY(0)",
            }}
          >HOW TO PLAY</button>

          {/* SETTINGS */}
          <button
            onClick={() => { ensureAudio(); onSettings(); }}
            onMouseEnter={() => setHover("settings")}
            onMouseLeave={() => setHover(null)}
            style={{
              ...btnBase,
              padding: "0.85rem 2rem",
              fontSize: "1rem",
              color: hover === "settings" ? "#cc8899" : "#774455",
              background: hover === "settings" ? "rgba(70,15,30,0.7)" : "rgba(40,6,14,0.5)",
              border: `2px solid ${hover === "settings" ? "#772233" : "#330a14"}`,
              borderBottom: hover === "settings" ? "4px solid #551122" : "6px solid #220610",
              backdropFilter: "blur(6px)",
              transform: hover === "settings" ? "translateY(2px)" : "translateY(0)",
            }}
          >⚙ &nbsp;SETTINGS</button>
        </div>
      </div>

      <style>{`
        @keyframes pulseOrb {
          0%,100% { box-shadow: 0 0 0 4px rgba(200,20,40,0.2), 0 0 40px rgba(200,20,40,0.35); }
          50%      { box-shadow: 0 0 0 10px rgba(200,20,40,0.1), 0 0 65px rgba(200,20,40,0.5); }
        }
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Help Page ────────────────────────────────────────────────────────────────
// ─── Mini canvas icons for defenders ─────────────────────────────────────────
function DefenderMiniIcon({ type }: { type: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    drawDefenderShape(ctx, type as DefenderType, 32, 32, 0);
  }, [type]);
  return <canvas ref={ref} width={64} height={64} style={{ display: "block" }} />;
}

function lighten(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 80);
  const g = Math.min(255, ((n >> 8) & 0xff) + 80);
  const b = Math.min(255, (n & 0xff) + 80);
  return `rgb(${r},${g},${b})`;
}

function drawInnerDetail(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, color: string) {
  ctx.save();
  switch (type) {
    case "stem":
      ctx.fillStyle = "#d4a017";
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 3, 6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#fff8c0";
      ctx.font = "bold 8px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ATP", cx, cy + 3);
      break;
    case "neutrophil":
      ctx.fillStyle = "#5d3a8a";
      [[-7,-3],[7,-3],[0,6]].forEach(([lx,ly]) => {
        ctx.beginPath(); ctx.arc(cx+lx, cy+ly, 5, 0, Math.PI*2); ctx.fill();
      });
      break;
    case "eosinophil":
      ctx.fillStyle = "#ffb84d";
      for (let i = 0; i < 7; i++) {
        const a = (i/7)*Math.PI*2;
        ctx.beginPath(); ctx.arc(cx+Math.cos(a)*10, cy+Math.sin(a)*10, 2.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = "#3a0a14";
      ctx.beginPath(); ctx.arc(cx, cy+4, 9, 0, Math.PI); ctx.fill();
      break;
    case "basophil":
      ctx.fillStyle = "#4a235a";
      for (let i = 0; i < 10; i++) {
        const a = (i/10)*Math.PI*2; const r2 = 6+(i%3)*3;
        ctx.beginPath(); ctx.arc(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2, 2, 0, Math.PI*2); ctx.fill();
      }
      break;
    case "monocyte":
      ctx.fillStyle = "#2d4a2a";
      ctx.beginPath(); ctx.ellipse(cx, cy+2, 12, 8, 0, Math.PI*0.2, Math.PI*1.8); ctx.fill();
      break;
    case "tcell":
      ctx.strokeStyle = "#3a1f10"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy-14); ctx.lineTo(cx, cy-22);
      ctx.moveTo(cx-6, cy-22); ctx.lineTo(cx+6, cy-22);
      ctx.stroke();
      ctx.fillStyle = "#ff5e3a";
      ctx.beginPath(); ctx.arc(cx-6, cy-22, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+6, cy-22, 3, 0, Math.PI*2); ctx.fill();
      break;
    case "bcell":
      ctx.fillStyle = "#1a3a5a";
      ctx.beginPath(); ctx.arc(cx, cy+2, 8, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#fff8e0"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy-12); ctx.lineTo(cx, cy-21);
      ctx.moveTo(cx, cy-21); ctx.lineTo(cx-6, cy-27);
      ctx.moveTo(cx, cy-21); ctx.lineTo(cx+6, cy-27);
      ctx.stroke();
      break;
    case "platelet":
      ctx.fillStyle = "#ffaa00";
      ctx.beginPath();
      ctx.moveTo(cx-6, cy-6);
      ctx.quadraticCurveTo(cx, cy-18, cx+6, cy-6);
      ctx.fill();
      ctx.fillStyle = "#fff066";
      ctx.beginPath();
      ctx.moveTo(cx-3, cy-6);
      ctx.quadraticCurveTo(cx, cy-13, cx+3, cy-6);
      ctx.fill();
      break;
  }
  ctx.restore();
}

// ─── Mini canvas icons for pathogens ─────────────────────────────────────────
function PathogenMiniIcon({ type }: { type: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    drawPathogenShape(ctx, type as PathogenType, 32, 32);
  }, [type]);
  return <canvas ref={ref} width={64} height={64} style={{ display: "block" }} />;
}


function HelpPage({ onBack }: { onBack: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const defenders = [
    { type: "stem",       name: "Stem Cell",   color: "#f5d76e", cost: 50,  hp: 100, desc: "Generates ATP drops over time. Your economic backbone — place early and often." },
    { type: "neutrophil", name: "Neutrophil",  color: "#e8e8f0", cost: 100, hp: 120, desc: "Fires antibodies at the first pathogen in its lane. Reliable long-range attacker." },
    { type: "eosinophil", name: "Eosinophil",  color: "#e85a5a", cost: 150, hp: 200, desc: "Chomps pathogens that wander close. Tough melee fighter with big HP." },
    { type: "basophil",   name: "Basophil",    color: "#9b59b6", cost: 175, hp: 130, desc: "Releases toxic spore clouds that slow and damage nearby pathogens." },
    { type: "monocyte",   name: "Monocyte",    color: "#5a8c4f", cost: 50,  hp: 1,   desc: "Leaps forward and squashes the first pathogen in its lane. One-time use." },
    { type: "tcell",      name: "T Cell",      color: "#7d4f30", cost: 25,  hp: 1,   desc: "A buried mine that detonates on contact, dealing massive area damage." },
    { type: "bcell",      name: "B Cell",      color: "#3498db", cost: 325, hp: 120, desc: "Fires antibody bursts across 3 adjacent lanes simultaneously. Premium power." },
    { type: "platelet",   name: "Platelets",   color: "#ff5e3a", cost: 125, hp: 1,   desc: "Ignites the entire lane in fire, burning all pathogens passing through." },
  ];

  const pathogens = [
    {
      type: "prokaryote", name: "Prokaryote", color: "#27ae60",
      hp: 150, speed: 22, damage: 6,
      desc: "Fast rod-shaped bacteria with flagella. Weak but arrives in swarms early on.",
      threat: "low",
    },
    {
      type: "virus", name: "Virus", color: "#c0392b",
      hp: 120, speed: 28, damage: 8,
      desc: "Spiky icosahedral particle — the fastest pathogen. Fragile but dangerously quick.",
      threat: "low",
    },
    {
      type: "parasite", name: "Parasite", color: "#8b4789",
      hp: 200, speed: 18, damage: 8,
      desc: "Segmented worm that wiggles through your defenses at moderate speed.",
      threat: "medium",
    },
    {
      type: "protozoa", name: "Protozoa", color: "#5a7d2a",
      hp: 280, speed: 14, damage: 10,
      desc: "Amoeba-like blob with pseudopods. Harder to kill and hits reasonably hard.",
      threat: "medium",
    },
    {
      type: "fungi", name: "Fungi", color: "#c08552",
      hp: 380, speed: 12, damage: 12,
      desc: "Mushroom-shaped invader with high HP. Slow but absorbs a lot of punishment.",
      threat: "high",
    },
    {
      type: "prion", name: "Prion", color: "#34495e",
      hp: 600, speed: 10, damage: 18,
      desc: "Misfolded protein cluster — the final boss. Massive HP, crushing damage, and a pulsing core that resists most attacks.",
      threat: "extreme",
    },
  ];

  const threatColors: Record<string, string> = {
    low: "#22c55e", medium: "#f59e0b", high: "#ef4444", extreme: "#a855f7",
  };

  const card: React.CSSProperties = {
    background: "rgba(20,4,8,0.75)",
    border: "1px solid #4a0e18",
    borderRadius: "1rem",
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.4rem",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center",
      background: "linear-gradient(160deg,#1a0308 0%,#2a0808 50%,#160210 100%)",
      position: "relative", overflow: "hidden", padding: "1.5rem",
      fontFamily: "system-ui, sans-serif",
    }}>
      <AnimatedBackground />
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: "860px", width: "100%",
        borderRadius: "1.75rem",
        border: "2px solid #7a1c1c",
        background: "rgba(40,6,10,0.93)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 0 60px rgba(200,20,40,0.15), 0 8px 40px rgba(0,0,0,0.6)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        marginTop: "1rem",
        marginBottom: "1rem",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "1.25rem 1.5rem",
          background: "rgba(25,4,8,0.8)",
          borderBottom: "1px solid #5a1010",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontSize: "1.4rem", fontWeight: 900, letterSpacing: "0.2em",
            color: "#fff", fontFamily: "'Courier New', monospace",
          }}>HOW TO PLAY</div>
        </div>

        {/* This is the container that makes it scrollable */}
        <div className="how-to-play-scroll-container" style={{ 
            maxHeight: "80vh", 
            overflowY: "auto", 
            padding: "2.5rem" 
        }}>
          <div style={{ color: "#bb8899", fontSize: "0.92rem", lineHeight: 1.7, marginBottom: "1.75rem" }}>
            <p style={{ marginBottom: "0.6rem" }}>
              <span style={{ color: "#ff6677", fontWeight: 700 }}>Goal: </span>
              Defend your body from pathogens by placing immune cells across 5 artery lanes
            </p>
            <p style={{ marginBottom: "0.6rem" }}>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>ATP: </span>
              Your currency — earned over time and by defeating pathogens. Click ATP drops to collect them!
            </p>
            <p>
              <span style={{ color: "#e7522c", fontWeight: 700 }}>Inject: </span>
              Remove a defender to recover half of its ATP cost.
            </p>
                        <p>
              <span style={{ color: "#fb923c", fontWeight: 700 }}>⚠ Inflammation: </span>
              Place 3+ defenders in one lane and it becomes inflamed — pathogens slow, but Stem Cells generate ATP at half speed.
            </p>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <div style={{
              color: "#ff6677", fontWeight: 800, fontSize: "1rem",
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: "1rem", borderBottom: "1px solid #4a1020", paddingBottom: "0.4rem",
            }}>🛡 Defenders</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))", gap: "0.75rem" }}>
              {defenders.map((d) => (
                <div key={d.type} style={card}>
                  <DefenderMiniIcon type={d.type} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>{d.name}</div>
                    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", margin: "0.25rem 0" }}>
                      <span style={{ fontSize: "0.7rem", background: "#1a0e00", color: "#fbbf24", borderRadius: "0.3rem", padding: "1px 5px", border: "1px solid #7a4a00" }}>
                        ⚡{d.cost} ATP
                      </span>
                      <span style={{ fontSize: "0.7rem", background: "#0a1a0a", color: "#4ade80", borderRadius: "0.3rem", padding: "1px 5px", border: "1px solid #1a4a1a" }}>
                        ❤ {d.hp}
                      </span>
                    </div>
                    <div style={{ color: "#886677", fontSize: "0.74rem", lineHeight: 1.4 }}>{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <div style={{
              color: "#ff6677", fontWeight: 800, fontSize: "1rem",
              letterSpacing: "0.12em", textTransform: "uppercase",
              marginBottom: "1rem", borderBottom: "1px solid #4a1020", paddingBottom: "0.4rem",
            }}>☣ Pathogens</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" }}>
              {pathogens.map((p) => (
                <div key={p.type} style={{
                  ...card,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                }}>
                  <PathogenMiniIcon type={p.type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem" }}>{p.name}</span>
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", padding: "1px 5px", borderRadius: "0.3rem",
                        background: threatColors[p.threat] + "22",
                        color: threatColors[p.threat],
                        border: `1px solid ${threatColors[p.threat]}55`,
                      }}>{p.threat}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.68rem", background: "#0a1a0a", color: "#4ade80", borderRadius: "0.3rem", padding: "1px 4px", border: "1px solid #1a4a1a" }}>
                        HP {p.hp}
                      </span>
                      <span style={{ fontSize: "0.68rem", background: "#0a0a1a", color: "#60a5fa", borderRadius: "0.3rem", padding: "1px 4px", border: "1px solid #1a1a4a" }}>
                        SPD {p.speed}
                      </span>
                      <span style={{ fontSize: "0.68rem", background: "#1a0a0a", color: "#f87171", borderRadius: "0.3rem", padding: "1px 4px", border: "1px solid #4a1a1a" }}>
                        DMG {p.damage}
                      </span>
                    </div>
                    <div style={{ color: "#776677", fontSize: "0.74rem", lineHeight: 1.4 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { playSound("ui_click"); onBack(); }}
            style={{
              width: "100%", padding: "0.9rem",
              borderRadius: "1rem", fontWeight: 700, fontSize: "1rem",
              letterSpacing: "0.12em", cursor: "pointer",
              background: "linear-gradient(135deg,#7f1d1d,#5a0f0f)",
              color: "#ffbbcc",
              border: "2px solid #aa2233",
              borderBottom: "5px solid #440a10",
            }}
          >← BACK</button>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
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
        boxShadow: on ? "0 2px 6px rgba(0,0,0,0.4)" : "none",
      }} />
    </button>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ onBack }: { onBack: () => void }) {
  const [musicOn, setMusicOn] = useState(!isMusicMuted());
  const [sfxOn, setSfxOn] = useState(!isSfxMuted());
  const [difficulty, setDifficulty] = useState<"Normal"|"Hard"|"Brutal">(
    () => (localStorage.getItem("difficulty") as "Normal"|"Hard"|"Brutal") ?? "Normal"
  );
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 60); return () => clearTimeout(t); }, []);

  const section: React.CSSProperties = {
    borderRadius: "1.25rem",
    background: "rgba(18,3,8,0.7)",
    border: "1px solid #4a0e0e",
    padding: "1.25rem 1.5rem",
    marginBottom: "0.875rem",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: "0.62rem", letterSpacing: "0.22em",
    textTransform: "uppercase", color: "#663344",
    marginBottom: "0.875rem",
  };
  const row: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };
  const settingTitle: React.CSSProperties = { color: "#fff", fontWeight: 700, fontSize: "0.95rem" };
  const settingDesc: React.CSSProperties = { color: "#554455", fontSize: "0.75rem", marginTop: "2px" };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#1a0308 0%,#2a0808 50%,#160210 100%)",
      position: "relative", overflow: "hidden", padding: "1.5rem",
      fontFamily: "system-ui, sans-serif",
    }}>
      <AnimatedBackground />
      <div style={{
        position: "relative", zIndex: 10,
        maxWidth: "400px", width: "100%",
        borderRadius: "1.75rem",
        border: "2px solid #7a1c1c",
        background: "rgba(40,6,10,0.92)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 60px rgba(200,20,40,0.15), 0 8px 40px rgba(0,0,0,0.6)",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "1.5rem", textAlign: "center",
          background: "rgba(25,4,8,0.8)",
          borderBottom: "1px solid #5a1010",
        }}>
          <div style={{
            fontSize: "1.75rem", fontWeight: 900, letterSpacing: "0.18em",
            color: "#fff", fontFamily: "'Courier New',monospace",
          }}>SETTINGS</div>
        </div>

        <div style={{ padding: "1.25rem 1.25rem 0" }}>
          {/* Audio */}
          <div style={section}>
            <div style={sectionLabel}>Audio</div>
            <div style={row}>
              <div>
                <div style={settingTitle}>Music</div>
                <div style={settingDesc}>Background soundtrack</div>
              </div>
              <Toggle on={musicOn} onToggle={() => {
                const n = !musicOn;
                setMusicOn(n);
                playSound("ui_click");
                if (n) {
                  unmuteMusic();
                  try { playBackground(); } catch (e) {}
                } else {
                  muteMusic();
                }
              }} />
            </div>
            <div style={{ height: "1px", background: "rgba(100,15,25,0.4)", margin: "1rem 0" }} />
            <div style={row}>
              <div>
                <div style={settingTitle}>Sound Effects</div>
                <div style={settingDesc}>Attacks, explosions & UI</div>
              </div>
              <Toggle on={sfxOn} onToggle={() => {
                const n = !sfxOn;
                setSfxOn(n);
                if (n) unmuteSfx();
                else muteSfx();
                // Play click sound before muting (or after unmuting)
                if (n) playSound("ui_click");
              }} />
            </div>
          </div>

          {/* Difficulty */}
          <div style={section}>
            <div style={sectionLabel}>Difficulty</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {(["Normal","Hard","Brutal"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    setDifficulty(d);
                    localStorage.setItem("difficulty", d);
                    playSound("ui_click");
                  }}
                  style={{
                    flex: 1, padding: "0.5rem 0",
                    borderRadius: "0.6rem",
                    fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em",
                    cursor: "pointer",
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

          {/* Version */}
          <div style={{
            textAlign: "center", padding: "0.625rem",
            borderRadius: "0.75rem",
            background: "rgba(14,2,6,0.5)",
            border: "1px solid #2a0810",
            marginBottom: "1rem",
          }}>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: "#441a22" }}>
              IMMUNE DEFENSE · VERSION 1.0.0
            </span>
          </div>
        </div>

        {/* Back */}
        <div style={{ padding: "0 1.25rem 1.5rem" }}>
          <button
            onClick={() => { playSound("ui_click"); onBack(); }}
            style={{
              width: "100%", padding: "0.9rem",
              borderRadius: "1rem", fontWeight: 700, fontSize: "1rem",
              letterSpacing: "0.12em", cursor: "pointer",
              background: "linear-gradient(135deg,#7f1d1d,#5a0f0f)",
              color: "#ffbbcc",
              border: "2px solid #aa2233",
              borderBottom: "5px solid #440a10",
            }}
          >← BACK</button>
        </div>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState<Page>("landing");

  useEffect(() => {
    tryAutoplay();
  }, []);

  return (
    <>
      {page === "landing" && (
        <LandingPage
          onPlay={() => setPage("game")}
          onHelp={() => setPage("help")}
          onSettings={() => setPage("settings")}
        />
      )}
      {page === "game" && <Game onMainMenu={() => setPage("landing")} />}
      {page === "help" && <HelpPage onBack={() => setPage("landing")} />}
      {page === "settings" && <SettingsPage onBack={() => setPage("landing")} />}
    </>
  );
}

export default App;
