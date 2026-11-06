// Icons extracted from design/preview/*.html (24×24, stroke = currentColor).
import type { CSSProperties, ReactNode } from 'react';

type IconDef = { sw?: number; cap?: boolean; join?: boolean; fill?: boolean; body: ReactNode };

const ICONS = {
  sidebar: { sw: 1.5, cap: true, join: true, body: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></> },
  panel: { sw: 1.5, cap: true, join: true, body: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></> },
  plus: { sw: 2, cap: true, body: <path d="M12 5v14M5 12h14" /> },
  search: { sw: 2, cap: true, body: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></> },
  bookmark: { sw: 1.75, join: true, body: <path d="M6.5 4h11v16l-5.5-3.8L6.5 20Z" /> },
  bookmarkFilled: { fill: true, body: <path d="M6.5 4h11v16l-5.5-3.8L6.5 20Z" /> },
  sliders: { sw: 1.75, cap: true, body: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></> },
  lock: { sw: 1.75, cap: true, join: true, body: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> },
  notExecuted: { sw: 2.25, cap: true, body: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></> },
  copy: { sw: 1.75, join: true, body: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5" /></> },
  check: { sw: 2.5, cap: true, join: true, body: <path d="m5 12 5 5 9-10" /> },
  stopSquare: { sw: 1.75, cap: true, join: true, body: <rect x="6" y="6" width="12" height="12" rx="2" /> },
  retry: { sw: 1.75, cap: true, join: true, body: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></> },
  arrowDown: { sw: 2, cap: true, join: true, body: <path d="M12 5v14M6 13l6 6 6-6" /> },
  stop: { fill: true, body: <rect x="4" y="4" width="16" height="16" rx="3" /> },
  arrowUp: { sw: 2.25, cap: true, join: true, body: <path d="M12 19V5M6 11l6-6 6 6" /> },
  pencil: { sw: 1.75, join: true, body: <path d="M4 20h4L19 9l-4-4L4 16Z" /> },
  dots: { fill: true, body: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></> },
  warning: { sw: 1.75, cap: true, join: true, body: <><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></> },
  thumbUp: { sw: 1.75, join: true, body: <path d="M7.5 10.5V20h-3v-9.5Zm0 0L11 3.5a2 2 0 0 1 2 2v4h5.3a2 2 0 0 1 2 2.3l-1.1 6.5a2 2 0 0 1-2 1.7H7.5" /> },
  arrowRight: { sw: 2, cap: true, join: true, body: <path d="M5 12h14M13 6l6 6-6 6" /> },
  arrowUpRight: { sw: 2, cap: true, join: true, body: <path d="M7 17 17 7M8 7h9v9" /> },
  bulb: { sw: 1.75, cap: true, join: true, body: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" /> },
  alertCircle: { sw: 2, cap: true, body: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></> },
  clock: { sw: 1.75, cap: true, join: true, body: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
  unsaved: { sw: 1.75, cap: true, join: true, body: <><path d="M5 5h11l3 3v11H5Z" /><path d="M5 5l14 14" /></> },
  wifi: { sw: 1.75, cap: true, join: true, body: <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01" /> },
  chevronRight: { sw: 2, cap: true, join: true, body: <path d="m9 6 6 6-6 6" /> },
  bug: { sw: 1.75, cap: true, join: true, body: <><rect x="7" y="8" width="10" height="12" rx="5" /><path d="M12 8V5M9 5l1.5 1.5M15 5l-1.5 1.5M3 13h4M17 13h4M4 19l3-2M20 19l-3-2" /></> },
  target: { sw: 1.75, cap: true, join: true, body: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></> },
  x: { sw: 2.5, cap: true, body: <path d="M7 7l10 10M17 7 7 17" /> },
  trash: { sw: 1.75, cap: true, join: true, body: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" /> },
  user: { sw: 1.75, cap: true, join: true, body: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
  shield: { sw: 1.75, cap: true, join: true, body: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" /> },
  menu: { sw: 1.75, cap: true, body: <path d="M4 7h16M4 12h16M4 17h10" /> },
  newChat: { sw: 1.75, cap: true, join: true, body: <path d="M12 20h8M4 20h4L19 9l-4-4L4 16Z" /> },
  close: { sw: 1.75, cap: true, body: <path d="M6 6l12 12M18 6 6 18" /> },
  grid: { sw: 1.75, body: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></> },
  list: { sw: 1.75, cap: true, body: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /> },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  strokeWidth,
  className,
  style,
  color,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  color?: string;
}) {
  const def: IconDef = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
      fill={def.fill ? color ?? 'currentColor' : 'none'}
      stroke={def.fill ? 'none' : color ?? 'currentColor'}
      strokeWidth={def.fill ? undefined : strokeWidth ?? def.sw ?? 1.75}
      strokeLinecap={def.cap ? 'round' : undefined}
      strokeLinejoin={def.join ? 'round' : undefined}
    >
      {def.body}
    </svg>
  );
}

/** The CodeBloom mark: indigo tile, white petals, coral centre (accent used for the logo only). */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="7" fill="#4F46E5" />
      <g fill="#FFFFFF" fillOpacity="0.94">
        <ellipse cx="12" cy="7.6" rx="2.5" ry="3.4" />
        <ellipse cx="12" cy="16.4" rx="2.5" ry="3.4" />
        <ellipse cx="7.6" cy="12" rx="3.4" ry="2.5" />
        <ellipse cx="16.4" cy="12" rx="3.4" ry="2.5" />
      </g>
      <circle cx="12" cy="12" r="2.1" fill="#F97362" />
    </svg>
  );
}
