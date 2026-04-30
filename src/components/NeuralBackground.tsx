import { useRef, useEffect, useCallback, useState } from "react";

// ─── Symbols that get "sucked" into the black hole ─────────────────────
const MATH_SYMBOLS = [
  "∑",
  "∫",
  "π",
  "∞",
  "√",
  "Δ",
  "θ",
  "λ",
  "α",
  "β",
  "γ",
  "σ",
  "μ",
  "∂",
  "∇",
  "⊕",
  "⊗",
  "≈",
  "≠",
  "≤",
  "≥",
  "∈",
  "∉",
  "⊂",
  "∪",
  "∩",
];
const CODE_SYMBOLS = [
  "</>",
  "{}",
  "=>",
  "&&",
  "||",
  "!=",
  "++",
  "--",
  "//",
  "**",
  "fn()",
  "let",
  "var",
  "if",
  "for",
  "map",
  "0x",
  "[]",
  "()",
];
const CHART_SYMBOLS = ["◔", "◑", "◕", "●", "◐", "◒", "◓", "◴", "◵", "◶", "◷"];
const ALL_SYMBOLS = [...MATH_SYMBOLS, ...CODE_SYMBOLS, ...CHART_SYMBOLS];

// ─── Colour palette that blends with the professional theme ────────────
const COLORS = [
  "rgba(88, 60, 200, ", // primary purple
  "rgba(100, 80, 220, ", // violet
  "rgba(60, 130, 220, ", // blue
  "rgba(70, 160, 200, ", // teal-blue
  "rgba(120, 80, 200, ", // soft purple
  "rgba(50, 110, 190, ", // deep blue
  "rgba(140, 100, 230, ", // lavender
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface Particle {
  x: number;
  y: number;
  angle: number;
  radius: number;
  symbol: string;
  color: string;
  size: number;
  speed: number;
  orbitSpeed: number;
  opacity: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
}

function createParticle(cx: number, cy: number, maxRadius: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const radius = maxRadius * (0.5 + Math.random() * 0.5);
  const maxLife = 350 + Math.random() * 450;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    angle,
    radius,
    symbol: randomFrom(ALL_SYMBOLS),
    color: randomFrom(COLORS),
    size: 11 + Math.random() * 14,
    speed: 0.12 + Math.random() * 0.35,
    orbitSpeed: (0.001 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1),
    opacity: 0.45 + Math.random() * 0.35,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    life: 0,
    maxLife,
  };
}

// ─── Accretion-disk ring particles (decorative) ────────────────────────
interface RingParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  color: string;
  opacity: number;
}

function createRingParticle(baseRadius: number): RingParticle {
  return {
    angle: Math.random() * Math.PI * 2,
    radius: baseRadius * (0.7 + Math.random() * 0.6),
    speed: (0.005 + Math.random() * 0.012) * (Math.random() > 0.5 ? 1 : -1),
    size: 1 + Math.random() * 2,
    color: randomFrom(COLORS),
    opacity: 0.2 + Math.random() * 0.35,
  };
}

function isReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── The main component — now a contained element, NOT full-screen ─────
export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [reducedMotion] = useState(() => isReducedMotion());
  const particlesRef = useRef<Particle[]>([]);
  const ringRef = useRef<RingParticle[]>([]);
  const frameRef = useRef(0);
  const initRef = useRef(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || window.innerWidth;
    const h = rect?.height || 500;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const cx = w / 2;
    const cy = h / 2;
    const isMobile = w < 768;
    const maxRadius = Math.max(w, h) * 0.55;
    const holeRadius = isMobile ? 22 : 40;
    const particleCount = isMobile ? 30 : 65;
    const ringCount = isMobile ? 30 : 70;

    if (!initRef.current) {
      particlesRef.current = [];
      for (let i = 0; i < particleCount; i++) {
        const p = createParticle(cx, cy, maxRadius);
        p.life = Math.random() * p.maxLife;
        p.radius = maxRadius * (0.15 + Math.random() * 0.85);
        particlesRef.current.push(p);
      }

      ringRef.current = [];
      for (let i = 0; i < ringCount; i++) {
        ringRef.current.push(createRingParticle(holeRadius * 3));
      }
      initRef.current = true;
    }

    return { w, h, cx, cy, maxRadius, holeRadius, dpr };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dims = initCanvas();
    if (!dims) return;

    function update() {
      if (!ctx || !dims) return;
      const { w, h, cx, cy, maxRadius, holeRadius, dpr } = dims;
      frameRef.current++;
      const frame = frameRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ── Clear with transparent / very light wash ──
      ctx.clearRect(0, 0, w, h);

      // ── Subtle radial glow behind the black hole (theme-appropriate) ──
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * 0.6);
      ambientGrad.addColorStop(0, "rgba(88, 60, 200, 0.04)");
      ambientGrad.addColorStop(0.4, "rgba(60, 130, 220, 0.02)");
      ambientGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ambientGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Accretion disk glow ──
      ctx.globalCompositeOperation = "source-over";
      const diskGrad = ctx.createRadialGradient(cx, cy, holeRadius * 0.5, cx, cy, holeRadius * 4);
      diskGrad.addColorStop(0, "rgba(88, 60, 200, 0.06)");
      diskGrad.addColorStop(0.3, "rgba(60, 130, 220, 0.04)");
      diskGrad.addColorStop(0.6, "rgba(120, 80, 200, 0.02)");
      diskGrad.addColorStop(1, "transparent");
      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, holeRadius * 4, holeRadius * 2, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // ── Ring particles (accretion disk detail) ──
      for (const rp of ringRef.current) {
        rp.angle += rp.speed;
        const rpx = cx + Math.cos(rp.angle) * rp.radius;
        const rpy = cy + Math.sin(rp.angle) * rp.radius * 0.4;
        ctx.globalAlpha = rp.opacity * (0.5 + 0.5 * Math.sin(frame * 0.02 + rp.angle));
        ctx.fillStyle = rp.color + "0.6)";
        ctx.beginPath();
        ctx.arc(rpx, rpy, rp.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Symbol particles spiralling inward ──
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life++;

        // Spiral inward
        p.radius -= p.speed;
        p.angle += p.orbitSpeed;

        // Gravitational acceleration
        if (p.radius < maxRadius * 0.3) {
          p.speed *= 1.006;
          p.orbitSpeed *= 1.004;
        }
        if (p.radius < holeRadius * 2.5) {
          p.speed *= 1.025;
          p.orbitSpeed *= 1.015;
        }

        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
        p.rotation += p.rotSpeed;

        // Fade in at start, fade out near center
        let alpha = p.opacity;
        if (p.life < 40) alpha *= p.life / 40;
        if (p.radius < holeRadius * 3) {
          alpha *= Math.max(0, (p.radius - holeRadius * 0.3) / (holeRadius * 2.7));
        }

        // Scale down near center
        const scale = Math.max(0.15, Math.min(1, p.radius / (maxRadius * 0.25)));
        const drawSize = p.size * scale;

        // Draw subtle glow behind symbol
        const glowSize = drawSize * 1.5;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glow.addColorStop(0, p.color + (alpha * 0.15).toFixed(3) + ")");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2);

        // Draw symbol
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.font = `600 ${Math.round(drawSize)}px 'Inter', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color + "0.85)";
        ctx.shadowColor = p.color + "0.3)";
        ctx.shadowBlur = 6;
        ctx.fillText(p.symbol, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Respawn if consumed by black hole
        if (p.radius <= holeRadius * 0.3 || p.life > p.maxLife) {
          particlesRef.current[i] = createParticle(cx, cy, maxRadius);
        }
      }
      ctx.globalAlpha = 1;

      // ── Black hole core — a subtle dark vortex ──
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, holeRadius);
      coreGrad.addColorStop(0, "rgba(20, 15, 40, 0.7)");
      coreGrad.addColorStop(0.5, "rgba(30, 20, 60, 0.4)");
      coreGrad.addColorStop(0.8, "rgba(40, 30, 80, 0.15)");
      coreGrad.addColorStop(1, "rgba(60, 40, 120, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      // ── Event horizon rings ──
      const pulseIntensity = 0.5 + 0.5 * Math.sin(frame * 0.012);

      ctx.strokeStyle = `rgba(88, 60, 200, ${0.12 + pulseIntensity * 0.12})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(88, 60, 200, 0.3)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, holeRadius + 1.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(60, 130, 220, ${0.08 + pulseIntensity * 0.08})`;
      ctx.shadowColor = "rgba(60, 130, 220, 0.2)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(cx, cy, holeRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ── Subtle lensing ring ──
      const lensGrad = ctx.createRadialGradient(cx, cy, holeRadius + 8, cx, cy, holeRadius + 30);
      lensGrad.addColorStop(0, `rgba(88, 60, 200, ${0.02 + pulseIntensity * 0.015})`);
      lensGrad.addColorStop(1, "transparent");
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, holeRadius + 30, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(update);
    }

    if (!reducedMotion) {
      update();
    } else {
      update();
      cancelAnimationFrame(animRef.current);
    }

    const handleResize = () => {
      cancelAnimationFrame(animRef.current);
      initRef.current = false;
      dims = initCanvas();
      if (dims && !reducedMotion) update();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [initCanvas, reducedMotion]);

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
      id="neural-background"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: "block" }}
      />
    </div>
  );
}
