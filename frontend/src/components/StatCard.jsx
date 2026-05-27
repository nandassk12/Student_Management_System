import { useEffect, useRef, useState } from 'react'

// ─── Count-up hook: animates from 0 → target over `duration` ms ──────────────
function useCountUp(target, duration = 800, startOnMount = true) {
  const [value, setValue]   = useState(0)
  const rafRef              = useRef(null)
  const startTimeRef        = useRef(null)
  const hasStarted          = useRef(false)

  useEffect(() => {
    if (!startOnMount || target === undefined || target === null) return
    if (hasStarted.current) return
    hasStarted.current = true

    const numericTarget = typeof target === 'string'
      ? parseFloat(target.replace(/[^0-9.]/g, ''))
      : Number(target)

    if (isNaN(numericTarget) || numericTarget === 0) {
      setValue(numericTarget || 0)
      return
    }

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed  = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * numericTarget))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setValue(numericTarget)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration, startOnMount])

  return value
}

// ─── Format number for display ────────────────────────────────────────────────
function formatValue(value, prefix = '', suffix = '', isAmount = false) {
  if (isAmount) {
    // Compact: 1200 → 1.2K, 1500000 → 1.5M
    if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M${suffix}`
    if (value >= 1_000)     return `${prefix}${(value / 1_000).toFixed(1)}K${suffix}`
    return `${prefix}${value}${suffix}`
  }
  return `${prefix}${value.toLocaleString()}${suffix}`
}

// ─── Trend arrow ─────────────────────────────────────────────────────────────
function TrendBadge({ trend, trendLabel }) {
  if (!trend) return null
  const isUp = trend > 0
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 7px',
        borderRadius: '999px',
        fontSize: '0.6875rem',
        fontWeight: '600',
        background: isUp ? '#dcfce7' : '#fee2e2',
        color: isUp ? '#16a34a' : '#dc2626',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {isUp ? '▲' : '▼'} {Math.abs(trend)}%{trendLabel ? ` ${trendLabel}` : ''}
    </span>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - label      {string}   — card title e.g. "Total Students"
 *  - value      {number}   — numeric value
 *  - icon       {ReactNode} — icon element
 *  - prefix     {string}   — prepended to value (e.g. "₹")
 *  - suffix     {string}   — appended to value
 *  - isAmount   {boolean}  — compact formatting (K / M)
 *  - color      {string}   — accent colour for icon bg & number
 *  - trend      {number}   — optional % change (positive = green, negative = red)
 *  - trendLabel {string}   — e.g. "vs last month"
 *  - loading    {boolean}  — show skeleton
 */
export default function StatCard({
  label      = 'Stat',
  value      = 0,
  icon       = null,
  prefix     = '',
  suffix     = '',
  isAmount   = false,
  color      = '#1e3a5f',
  trend,
  trendLabel,
  loading    = false,
}) {
  const animated = useCountUp(loading ? 0 : value, 800, !loading)

  // Derive a very light tint from the colour for the icon circle background
  const iconBg = color === '#1e3a5f' ? '#eff6ff'
               : color === '#16a34a' ? '#dcfce7'
               : color === '#dc2626' ? '#fee2e2'
               : color === '#d97706' ? '#fef9c3'
               : '#f1f5f9'

  const [hovered, setHovered] = useState(false)

  if (loading) {
    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        {/* Icon skeleton */}
        <div
          style={{
            width: '44px', height: '44px', borderRadius: '0.625rem',
            background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s linear infinite',
          }}
        />
        {/* Value skeleton */}
        <div
          style={{
            width: '60%', height: '28px', borderRadius: '0.375rem',
            background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s linear infinite',
          }}
        />
        {/* Label skeleton */}
        <div
          style={{
            width: '80%', height: '14px', borderRadius: '0.375rem',
            background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.6s linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label={label}
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        padding: '1.375rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        cursor: 'default',
        transition: 'box-shadow 200ms, transform 200ms',
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Top row: icon + trend badge ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Icon circle */}
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '0.625rem',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        {/* Trend badge (top right) */}
        {trend !== undefined && (
          <TrendBadge trend={trend} trendLabel={trendLabel} />
        )}
      </div>

      {/* ── Value + label ── */}
      <div>
        <p
          style={{
            fontSize: '1.75rem',
            fontWeight: '800',
            color: '#0f172a',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            margin: 0,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {formatValue(animated, prefix, suffix, isAmount)}
        </p>
        <p
          style={{
            marginTop: '0.3rem',
            fontSize: '0.8125rem',
            fontWeight: '500',
            color: '#64748b',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {label}
        </p>
      </div>
    </div>
  )
}
