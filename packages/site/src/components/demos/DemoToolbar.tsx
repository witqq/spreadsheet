import type { CSSProperties, ReactNode } from 'react';

interface DemoToolbarProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function DemoToolbar({ children, style }: DemoToolbarProps) {
  return (
    <div
      style={{
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid var(--sl-color-gray-5)',
        background: 'var(--sl-color-gray-7, var(--sl-color-gray-6))',
        flexShrink: 0,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface StatusTextProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function StatusText({ children, style }: StatusTextProps) {
  return (
    <span
      style={{
        fontSize: '0.78rem',
        color: 'var(--sl-color-gray-2)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
