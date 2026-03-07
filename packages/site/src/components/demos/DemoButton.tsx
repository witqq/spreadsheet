import type { CSSProperties, ReactNode, MouseEvent } from 'react';

export type DemoButtonVariant = 'default' | 'primary' | 'toggle';

interface DemoButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: DemoButtonVariant;
  active?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: '6px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
  lineHeight: 1.4,
  border: '1px solid var(--sl-color-gray-5)',
  background: 'var(--sl-color-gray-6)',
  color: 'var(--sl-color-white)',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  whiteSpace: 'nowrap',
};

const variants: Record<
  DemoButtonVariant,
  { normal: CSSProperties; hover: CSSProperties; active?: CSSProperties }
> = {
  default: {
    normal: {},
    hover: { background: 'var(--sl-color-gray-5)' },
  },
  primary: {
    normal: {
      background: 'var(--sl-color-accent, #3b82f6)',
      borderColor: 'var(--sl-color-accent, #3b82f6)',
      color: '#fff',
      fontWeight: 600,
    },
    hover: { filter: 'brightness(1.1)' },
  },
  toggle: {
    normal: {
      borderRadius: 999,
      padding: '5px 14px',
    },
    hover: { background: 'var(--sl-color-gray-5)' },
    active: {
      background: 'color-mix(in srgb, var(--sl-color-accent, #22c55e) 15%, transparent)',
      borderColor: 'var(--sl-color-accent, #22c55e)',
      color: 'var(--sl-color-accent, #22c55e)',
    },
  },
};

export function DemoButton({
  children,
  onClick,
  variant = 'default',
  active = false,
  disabled,
  style,
}: DemoButtonProps) {
  const v = variants[variant];
  const merged: CSSProperties = {
    ...base,
    ...v.normal,
    ...(active && v.active ? v.active : {}),
    ...(disabled ? { opacity: 0.5, cursor: 'default' } : {}),
    ...style,
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={merged}
      aria-pressed={variant === 'toggle' ? active : undefined}
      onMouseEnter={(e) => {
        if (disabled) return;
        Object.assign(e.currentTarget.style, v.hover);
      }}
      onMouseLeave={(e) => {
        const restore = { ...base, ...v.normal, ...(active && v.active ? v.active : {}), ...style };
        Object.assign(e.currentTarget.style, restore);
        // Reset filter if it was set
        if (v.hover.filter) e.currentTarget.style.filter = '';
      }}
    >
      {children}
    </button>
  );
}
