'use client'

import { useEffect, useRef } from 'react'

type OrbStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending' | 'error'

interface AiOrbProps {
  status: OrbStatus
  audioLevel?: number // 0–1 RMS volume
}

interface Particle {
  x: number
  y: number
  baseX: number
  baseY: number
  size: number
  phase: number     // unique phase offset for sin/cos drift
  speed: number     // drift speed multiplier
  opacity: number
}

function noise(x: number, y: number, t: number): number {
  const s = Math.sin(x * 2.3 + t) * Math.cos(y * 1.7 + t * 0.8)
  const s2 = Math.sin(x * 3.1 - t * 1.2) * Math.cos(y * 2.9 + t * 0.5)
  return (s + s2) * 0.5
}

function initParticles(count: number, size: number): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 0.3 + Math.random() * 0.65 // normalized 0–1 from center
    const bx = size / 2 + Math.cos(angle) * dist * size * 0.48
    const by = size / 2 + Math.sin(angle) * dist * size * 0.48
    particles.push({
      x: bx,
      y: by,
      baseX: bx,
      baseY: by,
      size: 0.8 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.7,
      opacity: 0.15 + Math.random() * 0.35,
    })
  }
  return particles
}

export default function AiOrb({ status, audioLevel = 0 }: AiOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const tRef = useRef(0)
  const particlesRef = useRef<Particle[] | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SIZE = canvas.width
    const cx = SIZE / 2
    const cy = SIZE / 2

    // Initialize particles once
    if (!particlesRef.current) {
      particlesRef.current = initParticles(20, SIZE)
    }
    const particles = particlesRef.current

    function draw() {
      tRef.current += getSpeed(status)

      const t = tRef.current
      const level = audioLevel

      ctx!.clearRect(0, 0, SIZE, SIZE)

      const baseRadius = SIZE * 0.28
      const morphStrength = getMorphStrength(status, level)
      const glowAlpha = getGlowAlpha(status)
      const coreAlpha = getCoreAlpha(status)

      // ── Stardust particles (canvas-drawn, smooth drift) ───────────
      for (const p of particles) {
        // Smooth sinusoidal drift around base position
        const driftX = Math.sin(t * p.speed + p.phase) * 8
        const driftY = Math.cos(t * p.speed * 0.7 + p.phase + 1.3) * 8
        p.x = p.baseX + driftX
        p.y = p.baseY + driftY

        // Smooth opacity breathing
        const breathe = 0.5 + 0.5 * Math.sin(t * p.speed * 0.5 + p.phase)
        const alpha = p.opacity * breathe

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255,255,255,${alpha})`
        ctx!.fill()
      }

      // ── Outer atmospheric glow rings ──────────────────────────────
      if (status !== 'error') {
        const ringCount = status === 'speaking' ? 3 : status === 'listening' ? 2 : 1
        for (let r = 0; r < ringCount; r++) {
          const ringPhase = (t * (0.4 + r * 0.2) + r * Math.PI * 0.7) % (Math.PI * 2)
          const ringScale = 1 + Math.sin(ringPhase) * 0.15 + r * 0.12
          const ringOpacity = glowAlpha * (0.18 - r * 0.05) * (status === 'speaking' ? 1.4 : 1)

          const grad = ctx!.createRadialGradient(cx, cy, baseRadius * ringScale * 0.6, cx, cy, baseRadius * ringScale * 1.4)
          grad.addColorStop(0, `rgba(215,255,0,${ringOpacity})`)
          grad.addColorStop(1, `rgba(215,255,0,0)`)

          ctx!.beginPath()
          ctx!.arc(cx, cy, baseRadius * ringScale * 1.4, 0, Math.PI * 2)
          ctx!.fillStyle = grad
          ctx!.fill()
        }
      }

      // ── Blob body ─────────────────────────────────────────────────
      const points = 64
      ctx!.beginPath()
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const nx = Math.cos(angle)
        const ny = Math.sin(angle)
        const n = noise(nx, ny, t * 0.6)
        const r = baseRadius + n * morphStrength

        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r

        if (i === 0) ctx!.moveTo(x, y)
        else ctx!.lineTo(x, y)
      }
      ctx!.closePath()

      const blobGrad = ctx!.createRadialGradient(cx - baseRadius * 0.2, cy - baseRadius * 0.2, 0, cx, cy, baseRadius * 1.2)
      if (status === 'error') {
        blobGrad.addColorStop(0, `rgba(255,80,80,${coreAlpha})`)
        blobGrad.addColorStop(0.5, `rgba(180,30,30,${coreAlpha * 0.8})`)
        blobGrad.addColorStop(1, `rgba(80,0,0,0)`)
      } else {
        const brightness = status === 'speaking' ? 1 : status === 'listening' ? 0.88 : 0.7
        blobGrad.addColorStop(0, `rgba(255,255,200,${coreAlpha * brightness})`)
        blobGrad.addColorStop(0.35, `rgba(215,255,0,${coreAlpha * brightness * 0.9})`)
        blobGrad.addColorStop(0.7, `rgba(140,200,0,${coreAlpha * brightness * 0.5})`)
        blobGrad.addColorStop(1, `rgba(60,100,0,0)`)
      }
      ctx!.fillStyle = blobGrad
      ctx!.fill()

      if (status !== 'error') {
        ctx!.strokeStyle = `rgba(215,255,0,${glowAlpha * 0.9})`
        ctx!.lineWidth = status === 'speaking' ? 2.5 : 1.5
        ctx!.shadowColor = '#D7FF00'
        ctx!.shadowBlur = status === 'speaking' ? 28 : status === 'listening' ? 18 : 10
        ctx!.stroke()
        ctx!.shadowBlur = 0
      }

      // ── Inner core highlight ──────────────────────────────────────
      const coreR = baseRadius * 0.38
      const coreGrad = ctx!.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, 0, cx, cy, coreR)
      if (status === 'error') {
        coreGrad.addColorStop(0, `rgba(255,160,160,${coreAlpha})`)
        coreGrad.addColorStop(1, `rgba(255,60,60,0)`)
      } else {
        coreGrad.addColorStop(0, `rgba(255,255,255,${coreAlpha * 0.95})`)
        coreGrad.addColorStop(0.5, `rgba(230,255,100,${coreAlpha * 0.5})`)
        coreGrad.addColorStop(1, `rgba(215,255,0,0)`)
      }
      ctx!.beginPath()
      ctx!.arc(cx - coreR * 0.25, cy - coreR * 0.25, coreR, 0, Math.PI * 2)
      ctx!.fillStyle = coreGrad
      ctx!.fill()

      // ── Connecting ring spinner ───────────────────────────────────
      if (status === 'connecting') {
        ctx!.save()
        ctx!.translate(cx, cy)
        ctx!.rotate(t * 2.5)
        ctx!.strokeStyle = 'rgba(215,255,0,0.7)'
        ctx!.lineWidth = 2
        ctx!.setLineDash([12, 20])
        ctx!.shadowColor = '#D7FF00'
        ctx!.shadowBlur = 12
        ctx!.beginPath()
        ctx!.arc(0, 0, baseRadius * 1.35, 0, Math.PI * 2)
        ctx!.stroke()
        ctx!.setLineDash([])
        ctx!.shadowBlur = 0
        ctx!.restore()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [status, audioLevel])

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={240}
    />
  )
}

function getSpeed(status: OrbStatus): number {
  switch (status) {
    case 'speaking':    return 0.035
    case 'listening':   return 0.022
    case 'connecting':  return 0.028
    case 'error':       return 0.015
    default:            return 0.008
  }
}

function getMorphStrength(status: OrbStatus, level: number): number {
  return status === 'speaking'
    ? 22 + level * 28
    : status === 'listening'
    ? 14 + level * 22
    : status === 'connecting'
    ? 10
    : 8
}

function getGlowAlpha(status: OrbStatus): number {
  switch (status) {
    case 'speaking':   return 0.85
    case 'listening':  return 0.65
    case 'connecting': return 0.5
    case 'error':      return 0.4
    default:           return 0.35
  }
}

function getCoreAlpha(status: OrbStatus): number {
  switch (status) {
    case 'speaking':   return 0.92
    case 'listening':  return 0.78
    case 'connecting': return 0.65
    case 'error':      return 0.7
    default:           return 0.55
  }
}
