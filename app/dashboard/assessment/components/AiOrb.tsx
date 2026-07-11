'use client';

import { useRef, useEffect } from 'react';

export type OrbStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending' | 'error';

interface AiOrbProps {
  status: OrbStatus;
  audioLevel: number;
  style?: React.CSSProperties;
}

interface Particle {
  x: number;
  y: number;
  phase: number;
  speed: number;
  radius: number;
  alphaPhase: number;
}

const SIZE = 240;
const CX = 120;
const CY = 120;
const BASE_RADIUS = 67;

function initParticles(): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * BASE_RADIUS * 0.65;
    out.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.6,
      radius: 1 + Math.random() * 1.5,
      alphaPhase: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

function blobNoise(nx: number, ny: number, t: number): number {
  return (
    Math.sin(nx * 2.1 + t * 1.3) * 0.5 +
    Math.cos(ny * 1.7 + t * 0.9) * 0.5
  );
}

const CFG = {
  idle:       { speed: 0.003, morphBase: 8,  morphAudio: 0,  glowAlpha: 0.18, rings: 1, strokeWidth: 1.5, shadowBlur: 6,  err: false },
  connecting: { speed: 0.010, morphBase: 14, morphAudio: 0,  glowAlpha: 0.25, rings: 1, strokeWidth: 1.5, shadowBlur: 10, err: false },
  listening:  { speed: 0.005, morphBase: 12, morphAudio: 16, glowAlpha: 0.25, rings: 2, strokeWidth: 1.5, shadowBlur: 10, err: false },
  speaking:   { speed: 0.018, morphBase: 18, morphAudio: 22, glowAlpha: 0.40, rings: 3, strokeWidth: 2,   shadowBlur: 16, err: false },
  ending:     { speed: 0.004, morphBase: 8,  morphAudio: 0,  glowAlpha: 0.18, rings: 1, strokeWidth: 1.5, shadowBlur: 6,  err: false },
  error:      { speed: 0.003, morphBase: 6,  morphAudio: 0,  glowAlpha: 0,    rings: 0, strokeWidth: 1.5, shadowBlur: 0,  err: true  },
} as const;

function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  status: OrbStatus,
  audioLevel: number,
  particles: Particle[],
  spinnerAngle: number,
) {
  const cfg = CFG[status];
  const morph = cfg.morphBase + cfg.morphAudio * audioLevel;

  ctx.clearRect(0, 0, SIZE, SIZE);

  // Glow rings
  for (let r = 0; r < cfg.rings; r++) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + r * 1.2);
    const rr = BASE_RADIUS + 12 + r * 14 + pulse * 10;
    const g = ctx.createRadialGradient(CX, CY, rr * 0.55, CX, CY, rr);
    const a = cfg.glowAlpha * 0.45 * (1 - r * 0.18);
    g.addColorStop(0, `rgba(215,255,0,${a})`);
    g.addColorStop(1, 'rgba(215,255,0,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, rr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Blob body — 64 point closed path
  const POINTS = 64;
  ctx.beginPath();
  for (let i = 0; i <= POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2;
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const r = BASE_RADIUS + blobNoise(nx, ny, t) * morph;
    const px = CX + nx * r;
    const py = CY + ny * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const bodyGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, BASE_RADIUS + morph);
  if (cfg.err) {
    bodyGrad.addColorStop(0,    'rgba(255,180,180,0.7)');
    bodyGrad.addColorStop(0.45, '#cc2222');
    bodyGrad.addColorStop(1,    '#0d0000');
  } else {
    bodyGrad.addColorStop(0,    'rgba(230,255,150,0.7)');
    bodyGrad.addColorStop(0.45, '#9bbf00');
    bodyGrad.addColorStop(1,    '#071000');
  }
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Blob outline stroke
  if (cfg.shadowBlur > 0) {
    ctx.save();
    ctx.shadowColor = cfg.err ? '#ff4444' : '#D7FF00';
    ctx.shadowBlur  = cfg.shadowBlur;
    ctx.strokeStyle = cfg.err ? '#ff4444' : '#D7FF00';
    ctx.lineWidth   = cfg.strokeWidth;
    ctx.stroke();
    ctx.restore();
  }

  // Stardust particles
  for (const p of particles) {
    const dx = Math.sin(t * p.speed * 60 + p.phase) * 4;
    const dy = Math.cos(t * p.speed * 55 + p.phase + 1) * 4;
    const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.2 + p.alphaPhase));
    ctx.beginPath();
    ctx.arc(CX + p.x + dx, CY + p.y + dy, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fill();
  }

  // Inner core highlight — 3D sheen
  const hg = ctx.createRadialGradient(CX - 16, CY - 16, 0, CX - 16, CY - 16, 32);
  hg.addColorStop(0, 'rgba(255,255,255,0.22)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(CX - 14, CY - 14, 30, 0, Math.PI * 2);
  ctx.fillStyle = hg;
  ctx.fill();

  // Connecting spinner
  if (status === 'connecting') {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(spinnerAngle);
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(215,255,0,0.7)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#D7FF00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, 0, BASE_RADIUS + 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export default function AiOrb({ status, audioLevel, style }: AiOrbProps) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const tRef           = useRef(0);
  const spinnerRef     = useRef(0);
  const rafRef         = useRef<number | undefined>(undefined);
  const particlesRef   = useRef<Particle[]>(initParticles());
  const statusRef      = useRef(status);
  const audioLevelRef  = useRef(audioLevel);

  // Keep refs current without restarting the loop
  useEffect(() => {
    statusRef.current     = status;
    audioLevelRef.current = audioLevel;
  }, [status, audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const s = statusRef.current;
      tRef.current    += CFG[s].speed;
      spinnerRef.current += 0.018;
      drawFrame(ctx, tRef.current, s, audioLevelRef.current, particlesRef.current, spinnerRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ display: 'block', ...style }}
    />
  );
}
