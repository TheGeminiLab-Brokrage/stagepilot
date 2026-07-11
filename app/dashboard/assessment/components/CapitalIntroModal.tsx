'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AiOrb, { type OrbStatus } from './AiOrb';

const YELLOW     = '#D7FF00';
const YELLOW_DIM = 'rgba(215,255,0,0.35)';

// When lip-sync videos are ready, place them at /intro/video-1.mp4 … video-8.mp4
// The video file replaces both the audio track and the SVG mouth animation.
const SLIDES = [
  {
    img:   '/assessment/intro/intro-1.png',
    audio: '/assessment/intro/one.wav',
    video: '/assessment/intro/video-1.mp4',
    title: 'كل النجوم صفراء',
    description: 'عند الدخول للتقييم، كل النجوم تكون باللون الأصفر — وهي تمثل المناطق التي لم تُجب عليها بعد.',
  },
  {
    img:   '/assessment/intro/intro-2.png',
    audio: '/assessment/intro/two.wav',
    video: '/assessment/intro/video-2.mp4',
    maxDuration: 14,
    title: 'حرّك المؤشر لمعاينة المخطط',
    description: 'عند تحريك المؤشر فوق أي منطقة، يظهر مخطط المشروع لمساعدتك في التعرف عليه.',
  },
  {
    img:   '/assessment/intro/intro-3.png',
    audio: '/assessment/intro/three.wav',
    video: '/assessment/intro/video-3.mp4',
    title: 'اضغط على النجمة لفتح النموذج',
    description: 'اضغط على أي نجمة صفراء لفتح نموذج التقييم. أدخل اسم المطور، اسم المشروع، بداية سعر المتر، والمساحة بالفدان ثم اضغط إرسال.',
  },
  {
    img:   '/assessment/intro/intro-4.png',
    audio: '/assessment/intro/four.wav',
    video: '/assessment/intro/video-4.mp4',
    title: 'إجابة صحيحة → نجمة خضراء',
    description: 'إذا كانت إجابتك صحيحة تتحول النجمة للأخضر. اضغط عليها مرة أخرى للإجابة على أسئلة تفصيلية عن المشروع.',
  },
  {
    img:   '/assessment/intro/intro-5.png',
    audio: '/assessment/intro/five.wav',
    video: '/assessment/intro/video-5.mp4',
    title: 'أسئلة تفصيلية عن المشروع',
    description: 'بعد الضغط على النجمة الخضراء، ستُجيب على أسئلة تفصيلية: أسعار الوحدات، أنواع التشطيبات، وشروط الدفع.',
  },
  {
    img:   '/assessment/intro/intro-6.png',
    audio: '/assessment/intro/six.wav',
    video: '/assessment/intro/video-6.mp4',
    title: 'إجابة خاطئة → نجمة حمراء',
    description: 'إذا كانت إجابتك خاطئة تتحول النجمة للأحمر وتُقفل تلقائياً ولا يمكن تعديل الإجابة.',
  },
  {
    img:   '/assessment/intro/intro-7.png',
    audio: '/assessment/intro/seven.wav',
    video: '/assessment/intro/video-7.mp4',
    title: 'أكمل جميع النجوم للإرسال',
    description: 'بعد الإجابة على جميع النجوم وإكمال الأسئلة التفصيلية للنجوم الخضراء، يُصبح زر "التالي" فعّالاً للانتقال للمسابقة.',
  },
  {
    img:   '/assessment/intro/intro-8.png',
    audio: '/assessment/intro/eight.wav',
    video: '/assessment/intro/video-8.mp4',
    title: 'تحميل التقرير النهائي',
    description: 'في نهاية التقييم، يمكنك تحميل تقرير كامل يوضح نتائجك ونقاط قوتك ومجالات التحسين.',
  },
];

// ─── Modal ───────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function CapitalIntroModal({ onClose }: Props) {
  const [current, setCurrent]             = useState(0);
  const [audioEnded, setAudioEnded]       = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef   = useRef<number | null>(null);

  // Web Audio refs for real-time RMS level
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const sourceNodeRef  = useRef<MediaElementAudioSourceNode | null>(null);

  const [audioLevel, setAudioLevel] = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);

  const total  = SLIDES.length;
  const slide  = SLIDES[current];
  const isLast = current === total - 1;

  // Preload all images immediately so navigation is instant
  useEffect(() => {
    SLIDES.forEach(s => {
      const img = new window.Image();
      img.src = s.img;
    });
  }, []);

  // Play audio; drive progress bar + orb level via rAF
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets playback state when the active slide changes, not a render loop
    setAudioEnded(false);
    setAudioProgress(0);
    setIsPlaying(false);
    setAudioLevel(0);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }

    // Disconnect the previous slide's source node before creating a new one
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }

    const slideData = SLIDES[current];
    const audio = new Audio(slideData.audio);
    audioRef.current = audio;

    // Lazily create a shared AudioContext for the modal's lifetime
    if (!audioCtxRef.current) {
      try {
        const actx = new AudioContext();
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.connect(actx.destination);
        audioCtxRef.current = actx;
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
      } catch {}
    }

    // Wire this slide's Audio element into the shared analyser
    if (audioCtxRef.current && analyserRef.current) {
      try {
        const source = audioCtxRef.current.createMediaElementSource(audio);
        source.connect(analyserRef.current);
        sourceNodeRef.current = source;
      } catch {}
    }

    const finish = () => {
      setAudioEnded(true);
      setAudioProgress(1);
      setIsPlaying(false);
      setAudioLevel(0);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };

    audio.addEventListener('ended', finish);
    audio.addEventListener('play',  () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));

    const tick = () => {
      const cap = slideData.maxDuration ?? audio.duration;
      if (cap && cap > 0) {
        setAudioProgress(Math.min(audio.currentTime / cap, 1));
        if (slideData.maxDuration && audio.currentTime >= slideData.maxDuration) {
          audio.pause();
          finish();
          return;
        }
      }

      // Compute RMS amplitude for the orb
      if (analyserRef.current && analyserDataRef.current) {
        audioCtxRef.current?.resume().catch(() => {});
        analyserRef.current.getByteTimeDomainData(analyserDataRef.current);
        const d = analyserDataRef.current;
        let sum = 0;
        for (let i = 0; i < d.length; i++) { const v = (d[i] - 128) / 128; sum += v * v; }
        setAudioLevel(Math.min(Math.sqrt(sum / d.length) * 6, 1));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    audio.play().catch(() => finish());
    audio.addEventListener('play', () => { rafRef.current = requestAnimationFrame(tick); }, { once: true });

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch {}
        sourceNodeRef.current = null;
      }
    };
  }, [current]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(total - 1, c + 1)), [total]);

  const orbStatus: OrbStatus = audioEnded ? 'idle' : isPlaying ? 'speaking' : 'connecting';

  return (
    <>
    <style>{`
      @keyframes fadeSlide {
        from { opacity: 0; transform: scale(1.015); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes nextPulse {
        0%, 100% { box-shadow: 0 0 28px rgba(215,255,0,0.85), 0 0 54px rgba(215,255,0,0.4); }
        50%       { box-shadow: 0 0 44px rgba(215,255,0,1),    0 0 88px rgba(215,255,0,0.65); }
      }
      @keyframes barPulse {
        0%, 100% { box-shadow: 0 0 8px rgba(215,255,0,0.7),  0 0 18px rgba(215,255,0,0.35); }
        50%       { box-shadow: 0 0 16px rgba(215,255,0,1),   0 0 34px rgba(215,255,0,0.65); }
      }
    `}</style>
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 60, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          position: 'relative',
          background: 'rgba(10,10,10,0.98)',
          border: `1px solid ${YELLOW_DIM}`,
          borderRadius: 16,
          maxWidth: 680,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 0 40px rgba(215,255,0,0.08), 0 20px 60px rgba(0,0,0,0.7)',
          fontFamily: 'var(--font-space)',
          animation: 'modal-enter 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="إغلاق"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: 'rgba(0,0,0,0.55)', border: 'none',
            cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
            fontSize: 15, lineHeight: 1, padding: '5px 8px',
            borderRadius: 6, backdropFilter: 'blur(4px)',
          }}
        >
          ✕
        </button>

        {/* Screenshot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={slide.img}
          src={slide.img}
          alt={slide.title}
          style={{
            width: '100%',
            display: 'block',
            maxHeight: 340,
            objectFit: 'contain',
            background: '#000',
            animation: 'fadeSlide 0.22s ease forwards',
          }}
        />

        {/* Content — flex row: avatar left | text right */}
        <div style={{
          padding: '18px 22px 22px',
          display: 'flex',
          flexDirection: 'row',
          gap: 16,
          alignItems: 'center',
          direction: 'ltr',
        }}>

          {/* AI Orb avatar */}
          <div style={{ flexShrink: 0, width: 120, height: 120 }}>
            <AiOrb
              status={orbStatus}
              audioLevel={audioLevel}
              style={{ width: 120, height: 120 }}
            />
          </div>

          {/* Text + navigation column */}
          <div style={{ flex: 1, minWidth: 0, direction: 'rtl' }}>

            {/* Dots · progress bar · counter */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 10, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    style={{
                      width: i === current ? 20 : 7,
                      height: 7,
                      borderRadius: 4,
                      background: i === current ? YELLOW : 'rgba(255,255,255,0.15)',
                      border: 'none', cursor: 'pointer', padding: 0,
                      transition: 'width 200ms ease, background 200ms ease',
                    }}
                  />
                ))}
              </div>

              <div style={{
                flex: 1, height: 4, borderRadius: 99,
                background: 'rgba(255,255,255,0.1)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${audioProgress * 100}%`,
                  borderRadius: 99,
                  background: YELLOW,
                  boxShadow: audioEnded
                    ? '0 0 8px rgba(215,255,0,0.7), 0 0 18px rgba(215,255,0,0.35)'
                    : '0 0 6px rgba(215,255,0,0.4)',
                  animation: audioEnded ? 'barPulse 1.6s ease-in-out infinite' : 'none',
                }} />
              </div>

              <span style={{
                fontSize: 10, fontWeight: 700, color: YELLOW,
                background: 'rgba(215,255,0,0.1)',
                border: '1px solid rgba(215,255,0,0.25)',
                borderRadius: 5, padding: '2px 9px',
                letterSpacing: '0.05em', flexShrink: 0,
              }}>
                {current + 1} / {total}
              </span>
            </div>

            {/* Title */}
            <h2 style={{
              margin: '0 0 8px',
              fontSize: 17, fontWeight: 800,
              color: '#fff', letterSpacing: '-0.02em',
              direction: 'rtl',
            }}>
              {slide.title}
            </h2>

            {/* Description */}
            <p style={{
              margin: '0 0 18px',
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-montserrat)',
              lineHeight: 1.65,
              direction: 'rtl', textAlign: 'right',
            }}>
              {slide.description}
            </p>

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 10 }}>
              {current > 0 && (
                <button
                  onClick={prev}
                  style={{
                    flex: 1, padding: '12px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 13, fontWeight: 700,
                    fontFamily: 'var(--font-space)', cursor: 'pointer',
                  }}
                >
                  → السابق
                </button>
              )}
              <button
                onClick={isLast ? onClose : next}
                style={{
                  flex: 2, padding: '12px',
                  borderRadius: 10,
                  background: audioEnded || isLast ? YELLOW : 'rgba(215,255,0,0.1)',
                  border: audioEnded || isLast ? 'none' : '1px solid rgba(215,255,0,0.2)',
                  color: audioEnded || isLast ? '#000' : 'rgba(215,255,0,0.35)',
                  fontSize: 14, fontWeight: 800,
                  fontFamily: 'var(--font-space)',
                  letterSpacing: '-0.01em', cursor: 'pointer',
                  boxShadow: audioEnded || isLast
                    ? '0 0 28px rgba(215,255,0,0.85), 0 0 54px rgba(215,255,0,0.4)'
                    : 'none',
                  transition: 'background 400ms ease, color 400ms ease, box-shadow 400ms ease, border 400ms ease',
                  animation: audioEnded && !isLast ? 'nextPulse 1.6s ease-in-out infinite' : 'none',
                }}
              >
                {isLast ? 'ابدأ التقييم' : 'التالي ←'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
