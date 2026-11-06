import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tone = 'warn' | 'danger' | 'info' | 'neutral' | 'success';

const TONE: Record<Tone, { cls: string; color: string; title: string; body: string }> = {
  warn: { cls: 'banner banner-warn', color: '#B45309', title: 'var(--warning-text)', body: '#4A3410' },
  danger: { cls: 'banner banner-danger', color: '#DC2626', title: 'var(--danger-text)', body: '#7A271A' },
  info: { cls: 'banner banner-info', color: '#4F46E5', title: 'var(--primary-text)', body: 'var(--primary-text)' },
  neutral: { cls: 'banner', color: '#52525B', title: 'var(--text)', body: 'var(--text-2)' },
  success: { cls: 'banner banner-success', color: '#15803D', title: 'var(--success)', body: 'var(--text-2)' },
};

/** Recovery banner (design/preview/components.html §08). */
export function Banner({
  tone,
  icon,
  title,
  children,
  action,
}: {
  tone: Tone;
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={`${t.cls} pop`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} color={t.color} style={{ flex: 'none', marginTop: 1 }} />
      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <strong style={{ fontWeight: 600, color: t.title }}>{title}</strong>
        {children && <span style={{ color: t.body }}>{children}</span>}
      </div>
      {action}
    </div>
  );
}
