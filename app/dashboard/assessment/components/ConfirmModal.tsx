'use client';

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'red' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Go Back',
  variant = 'red',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const borderColor = variant === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(251,146,60,0.3)';
  const iconBg = variant === 'red' ? 'rgba(239,68,68,0.08)' : 'rgba(251,146,60,0.08)';
  const accentText = variant === 'red' ? 'rgba(239,68,68,0.9)' : 'rgba(251,146,60,0.9)';
  const icon = variant === 'red' ? '↗' : '⚠';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(10px)',
        animation: 'overlay-enter 0.18s ease forwards',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'linear-gradient(160deg, #111111 0%, #0a0a0a 100%)',
          border: `1px solid ${borderColor}`,
          borderRadius: 22,
          padding: '36px 32px 28px',
          maxWidth: 380,
          width: 'calc(100% - 40px)',
          textAlign: 'center',
          animation: 'modal-enter 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px ${borderColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: iconBg,
            border: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 24,
            boxShadow: `0 0 20px ${iconBg}`,
          }}
        >
          <span style={{ color: accentText }}>{icon}</span>
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily: 'var(--font-space)',
            fontSize: 21,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '-0.02em',
            margin: '0 0 10px',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>

        {/* Body */}
        <p
          style={{
            fontFamily: 'var(--font-montserrat)',
            fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.7,
            margin: '0 0 30px',
          }}
        >
          {body}
        </p>

        {/* Buttons — cancel on left (lime = safe), confirm on right (red = danger) */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 14,
              background: 'var(--tgl-lime)',
              color: '#000',
              fontFamily: 'var(--font-space)',
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(215,255,0,0.3)',
              letterSpacing: '-0.01em',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 14,
              background: 'transparent',
              color: accentText,
              fontFamily: 'var(--font-space)',
              fontSize: 13,
              fontWeight: 700,
              border: `1px solid ${borderColor}`,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
