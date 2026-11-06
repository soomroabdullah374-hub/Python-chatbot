'use client';
import type { ReactNode } from 'react';

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
}

/** Segmented control (cb.css .seg / .seg-btn with aria-pressed). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  full = false,
  large = false,
  btnStyle,
  className = '',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  full?: boolean;
  large?: boolean;
  btnStyle?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`seg${full ? ' seg-full' : ''}${large ? ' seg-lg' : ''} ${className}`}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg-btn"
          aria-pressed={o.value === value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
          style={btnStyle}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
