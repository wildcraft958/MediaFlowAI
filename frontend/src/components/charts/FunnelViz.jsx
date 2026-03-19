/**
 * FunnelViz - 3D trapezoid CSS funnel (clip-path based)
 * Proper flex layout: LEFT label | CENTER trapezoid | RIGHT badge
 * No absolute positioning — eliminates text overlap entirely.
 */

import React from 'react'
import { motion } from 'framer-motion'

const STAGE_COLORS = [
  {
    bg:    'linear-gradient(180deg, #1e3d6e 0%, #163058 100%)',
    depth: '#0d1e3a',
    badge: '#1565C0',
    label: '#64b5f6',
  },
  {
    bg:    'linear-gradient(180deg, #1b5e3e 0%, #134a30 100%)',
    depth: '#0a2e1e',
    badge: '#2e7d32',
    label: '#81c784',
  },
  {
    bg:    'linear-gradient(180deg, #2e1b3a 0%, #1a0d24 100%)',
    depth: '#180a1a',
    badge: '#6a1b9a',
    label: '#ce93d8',
  },
]

function Skeleton() {
  return (
    <div className="px-4 py-4 animate-pulse space-y-3">
      {[100, 85, 70].map((w, i) => (
        <div
          key={i}
          className="h-24 bg-[#1a1a1a] rounded-xl"
          style={{ width: `${w}%`, margin: '0 auto' }}
        />
      ))}
    </div>
  )
}

export default function FunnelViz({ stages = [], loading = false }) {
  if (loading) return <Skeleton />
  if (!stages.length) return null

  const maxCount = Math.max(...stages.map((s) => s.count || 1))
  const getWidth = (count) => Math.max(50, (count / maxCount) * 100)

  return (
    <div className="w-full py-4 select-none">
      {stages.map((stage, idx) => {
        const nextStage  = stages[idx + 1]
        const colors     = STAGE_COLORS[idx] || STAGE_COLORS[STAGE_COLORS.length - 1]
        const stageWidth = getWidth(stage.count)
        const nextWidth  = nextStage ? getWidth(nextStage.count) : stageWidth * 0.82

        const topInset = (100 - stageWidth) / 2
        const botInset = (100 - nextWidth)  / 2
        const clipPath = `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - botInset}% 100%, ${botInset}% 100%)`

        const subtitle =
          idx === 0 ? 'Uploaded'
          : idx === 1 ? 'AI Processed'
          : 'Published'

        const convLabel =
          idx === 0 ? 'Baseline'
          : `${stage.pct ?? 100}% rate`

        return (
          <React.Fragment key={stage.name || idx}>
            {/* Drop connector */}
            {idx > 0 && (
              <motion.div
                className="flex justify-center items-center py-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.2 + 0.1 }}
              >
                {(() => {
                  const prevCount = stages[idx - 1].count
                  const dropPct   = ((1 - stage.count / prevCount) * 100).toFixed(1)
                  const dropCount = prevCount - stage.count
                  if (parseFloat(dropPct) > 0.1) {
                    return (
                      <div className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                        <span className="text-[#e63946]">▼</span>
                        <span className="font-semibold text-[#e63946]">{dropPct}% drop</span>
                        <span className="text-[#444]">·</span>
                        <span className="text-[#666]">{dropCount.toLocaleString()} videos</span>
                      </div>
                    )
                  }
                  return (
                    <div className="flex items-center gap-2 text-xs text-[#4caf50]">
                      <span>✓</span>
                      <span>100% pass-through</span>
                    </div>
                  )
                })()}
              </motion.div>
            )}

            {/* Stage row — proper flex: no absolute positioning */}
            <motion.div
              className="flex items-center"
              style={{ height: 96 }}
              initial={{ opacity: 0, scaleX: 0.85 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: idx * 0.2, duration: 0.45, ease: 'easeOut' }}
            >
              {/* LEFT: stage name */}
              <div className="flex-shrink-0 w-24 flex justify-end pr-3">
                <span
                  className="text-[10px] font-bold tracking-[0.12em] uppercase text-right"
                  style={{ color: colors.label }}
                >
                  {stage.name}
                </span>
              </div>

              {/* CENTER: trapezoid — clip-path contained, text stays inside */}
              <div className="flex-1 relative min-w-0" style={{ height: '100%' }}>
                {/* 3D depth shadow */}
                <div
                  className="absolute"
                  style={{
                    bottom: -5, left: `${botInset}%`, right: `${botInset}%`,
                    height: 8, background: colors.depth,
                    filter: 'blur(3px)', borderRadius: '0 0 4px 4px', zIndex: 0,
                  }}
                />
                {/* Bottom edge */}
                <div
                  className="absolute"
                  style={{
                    bottom: -2, left: `${botInset}%`, right: `${botInset}%`,
                    height: 5, background: colors.depth,
                    zIndex: 1, borderRadius: '0 0 3px 3px',
                  }}
                />

                {/* Trapezoid — clip-path applied; text inside is always within shape */}
                <div
                  className="relative w-full h-full flex items-center justify-center"
                  style={{
                    clipPath,
                    background: colors.bg,
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))',
                    zIndex: 2,
                  }}
                >
                  {/* Constrain text to narrowest part of trapezoid */}
                  <div
                    className="text-center pointer-events-none"
                    style={{ width: `${Math.min(stageWidth, nextWidth) - 8}%` }}
                  >
                    <p className="text-lg font-black text-white leading-none tabular-nums">
                      {stage.count.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-white/50 mt-1 truncate">
                      {convLabel}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT: % badge + label */}
              <div className="flex-shrink-0 w-24 flex flex-col items-start pl-3 gap-0.5">
                <div
                  className="px-2.5 py-1 rounded text-sm font-bold text-white"
                  style={{ background: colors.badge, minWidth: 50, textAlign: 'center' }}
                >
                  {stage.pct ?? 100}%
                </div>
                <span
                  className="text-[9px] leading-tight"
                  style={{ color: colors.label, opacity: 0.7 }}
                >
                  {subtitle}
                </span>
              </div>
            </motion.div>
          </React.Fragment>
        )
      })}

      {/* Footer */}
      {stages.length >= 2 && (
        <motion.div
          className="mt-5 pt-4 border-t border-[#1f1f1f] text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: stages.length * 0.2 + 0.1 }}
        >
          {(() => {
            const first      = stages[0]
            const last       = stages[stages.length - 1]
            const overallPct = ((last.count / first.count) * 100).toFixed(1)
            const lost       = first.count - last.count
            return (
              <p className="text-xs text-[#555]">
                Overall conversion <span className="text-white font-semibold">{overallPct}%</span>
                {' · '}{lost.toLocaleString()} videos lost in funnel
              </p>
            )
          })()}
        </motion.div>
      )}
    </div>
  )
}
