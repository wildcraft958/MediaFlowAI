/**
 * KPICard — animated metric card with trend indicator
 *
 * @param {object}   props
 * @param {string}   props.title       - KPI label
 * @param {number|string} props.value  - Current metric value (number animates)
 * @param {string}   [props.unit='']   - Unit suffix (%, hrs, etc.)
 * @param {'up'|'down'|'neutral'} [props.trend] - Trend direction
 * @param {number}   [props.trendValue]  - Trend magnitude (e.g. 5.2 for +5.2%)
 * @param {string}   [props.trendLabel] - Trend description text
 * @param {React.ComponentType} [props.icon] - Lucide icon component
 * @param {boolean}  [props.accent=false] - Red glow border treatment
 * @param {boolean}  [props.loading=false] - Show skeleton state
 * @param {string}   [props.subtitle]   - Secondary descriptor below value
 */

import React, { useEffect, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

// ---------------------------------------------------------------------------
// useCountUp — counts from 0 to `target` over `duration` ms using rAF
// ---------------------------------------------------------------------------
function useCountUp(target, duration = 1200) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const numericTarget = parseFloat(target)
  const isNumeric = !isNaN(numericTarget)

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(target)
      return
    }
    startRef.current = null

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = eased * numericTarget

      // Preserve decimal places from the original target
      const decimals = (String(target).split('.')[1] || '').length
      setDisplay(parseFloat(current.toFixed(decimals)))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplay(target) // snap to exact final value
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, isNumeric, numericTarget])

  return display
}

// ---------------------------------------------------------------------------
// Trend badge
// ---------------------------------------------------------------------------
function TrendBadge({ trend, trendValue, trendLabel }) {
  if (!trend || trend === 'neutral') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1f1f1f] text-[#a0a0a0]">
          <Minus size={11} />
          {trendValue != null ? `${Math.abs(trendValue)}%` : '-'}
        </span>
        {trendLabel && (
          <span className="text-xs text-[#555555] truncate">{trendLabel}</span>
        )}
      </div>
    )
  }

  const isUp = trend === 'up'
  const Icon = isUp ? TrendingUp : TrendingDown
  const colorClass = isUp
    ? 'bg-[#0d2b0d] text-[#4caf50]'
    : 'bg-[#2b0d0d] text-[#e63946]'

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        <Icon size={11} />
        {trendValue != null
          ? `${isUp ? '+' : '-'}${Math.abs(trendValue)}%`
          : ''}
      </span>
      {trendLabel && (
        <span className="text-xs text-[#555555] truncate">{trendLabel}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------
function Skeleton() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-8 h-8 bg-[#1f1f1f] rounded-xl" />
        <div className="w-24 h-4 bg-[#1f1f1f] rounded" />
      </div>
      <div className="mb-3">
        <div className="w-32 h-8 bg-[#1f1f1f] rounded mb-1.5" />
        <div className="w-20 h-3 bg-[#1f1f1f] rounded" />
      </div>
      <div className="w-28 h-5 bg-[#1f1f1f] rounded-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPICard
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// CSS-3D tilt hook — tracks mouse position within card
// ---------------------------------------------------------------------------
function useTilt() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 })

  const handleMouse = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }
  const handleLeave = () => {
    x.set(0)
    y.set(0)
  }
  return { rotateX, rotateY, handleMouse, handleLeave }
}

export default function KPICard({
  title,
  value,
  unit = '',
  trend,
  trendValue,
  trendLabel,
  icon: Icon,
  accent = false,
  loading = false,
  subtitle,
  tooltip,
}) {
  const animatedValue = useCountUp(value, 1200)
  const { rotateX, rotateY, handleMouse, handleLeave } = useTilt()

  if (loading) return <Skeleton />

  const formatValue = (v) => {
    if (typeof v === 'string') return v
    const n = parseFloat(v)
    if (isNaN(n)) return v
    const decimals = (String(value).split('.')[1] || '').length
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  return (
    <motion.div
      title={tooltip || undefined}
      style={{ rotateX, rotateY, transformPerspective: 800, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileTap={{ scale: 0.98 }}
      className={[
        'relative rounded-2xl p-4 sm:p-6 cursor-default overflow-hidden',
        // Glassmorphism base
        'bg-white/[0.03] backdrop-blur-sm',
        // Border
        accent
          ? 'border border-[#e63946]/40 shadow-[0_0_32px_rgba(230,57,70,0.15),0_4px_24px_rgba(0,0,0,0.5)]'
          : 'border border-white/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.4)]',
        'transition-shadow duration-300',
      ].join(' ')}
    >
      {/* Subtle inner gloss — top highlight line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Accent glow strip */}
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#e63946] to-transparent" />
      )}

      {/* Background glow blob (accent only) */}
      {accent && (
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#e63946]/10 blur-2xl pointer-events-none" />
      )}

      {/* Top row: icon + title */}
      <div className="flex items-start justify-between mb-4">
        {Icon && (
          <div
            className={[
              'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
              accent ? 'bg-[#e63946]/15 ring-1 ring-[#e63946]/25' : 'bg-white/[0.06]',
            ].join(' ')}
            style={{ transform: 'translateZ(8px)' }}
          >
            <Icon
              size={16}
              className={accent ? 'text-[#e63946]' : 'text-[#a0a0a0]'}
            />
          </div>
        )}
        <span
          className={[
            'text-xs font-medium tracking-wide uppercase truncate',
            Icon ? 'ml-3 flex-1' : 'flex-1',
            'text-[#a0a0a0]',
          ].join(' ')}
        >
          {title}
        </span>
      </div>

      {/* Value block — lifted layer for depth */}
      <div className="mb-3" style={{ transform: 'translateZ(12px)' }}>
        <div className="flex items-baseline gap-1">
          <span className="kpi-number text-2xl sm:text-3xl font-bold text-white leading-none">
            {formatValue(animatedValue)}
          </span>
          {unit && (
            <span className="text-sm text-[#a0a0a0] font-medium">{unit}</span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-[#555555] mt-1 truncate">{subtitle}</p>
        )}
      </div>

      {/* Trend — only show if there's an actual value to display */}
      {trendValue != null && (
        <TrendBadge
          trend={trend}
          trendValue={trendValue}
          trendLabel={trendLabel}
        />
      )}
    </motion.div>
  )
}
