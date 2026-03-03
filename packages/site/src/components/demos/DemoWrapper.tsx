import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b' }}>
          <strong>Demo error:</strong> {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

interface DemoWrapperProps {
  title?: string;
  description?: string;
  height?: number;
  children: ReactNode;
}

export function DemoWrapper({ title, description, height = 400, children }: DemoWrapperProps) {
  const border = 'var(--sl-color-gray-5)';
  const headerBg = 'var(--sl-color-gray-6)';
  const titleColor = 'var(--sl-color-white)';
  const descColor = 'var(--sl-color-gray-2)';

  return (
    <div style={{
      margin: '1.5rem 0',
      border: `1px solid ${border}`,
      borderRadius: 10,
      overflow: 'hidden',
      maxWidth: '100%',
    }}>
      {(title || description) && (
        <div style={{
          padding: '0.6rem 1rem',
          borderBottom: `1px solid ${border}`,
          background: headerBg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          minHeight: 40,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <div style={{
                fontWeight: 600,
                fontSize: '0.85rem',
                color: titleColor,
                letterSpacing: '-0.01em',
              }}>{title}</div>
            )}
            {description && (
              <div style={{
                fontSize: '0.78rem',
                color: descColor,
                marginTop: title ? 2 : 0,
                lineHeight: 1.4,
              }}>{description}</div>
            )}
          </div>
        </div>
      )}
      <div style={{ height }}>
        <DemoErrorBoundary>{children}</DemoErrorBoundary>
      </div>
    </div>
  );
}
