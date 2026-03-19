/**
 * InsightsPanel — AI-generated insights card with colored dot list
 *
 * Props:
 *   insights  [{ text, type: 'warning'|'success'|'info', highlight? }]
 *   title     string (default "AI Insights")
 *   loading   bool
 */

import React from 'react'
import { Sparkles } from 'lucide-react'

// ---------------------------------------------------------------------------
// Dot colors per type
// ---------------------------------------------------------------------------
const DOT_COLORS = {
  warning: 'bg-[#e63946]',
  success: 'bg-[#4caf50]',
  info: 'bg-[#2196f3]',
}

const DOT_TEXT = {
  warning: 'text-[#e63946]',
  success: 'text-[#4caf50]',
  info: 'text-[#2196f3]',
}

// ---------------------------------------------------------------------------
// Single insight item
// ---------------------------------------------------------------------------
function InsightItem({ insight }) {
  const { text, type = 'info', highlight } = insight
  const dotColor = DOT_COLORS[type] ?? DOT_COLORS.info
  const highlightColor = DOT_TEXT[type] ?? DOT_TEXT.info

  // Split text around highlighted portion if provided
  let content
  if (highlight && text.includes(highlight)) {
    const parts = text.split(highlight)
    content = (
      <>
        {parts[0]}
        <span className={`font-semibold ${highlightColor}`}>{highlight}</span>
        {parts.slice(1).join(highlight)}
      </>
    )
  } else {
    content = text
  }

  return (
    <li className="flex items-start gap-3 py-2.5 border-b border-[#1f1f1f]/60 last:border-0">
      {/* Colored dot */}
      <span
        className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`}
      />
      {/* Text */}
      <p className="text-sm text-[#a0a0a0] leading-relaxed flex-1">{content}</p>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Skeleton loading
// ---------------------------------------------------------------------------
function InsightSkeleton() {
  return (
    <div className="space-y-3 animate-pulse py-1">
      {[80, 65, 72].map((w, i) => (
        <div key={i} className="flex items-start gap-3 py-2">
          <div className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2a2a2a]" />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3 bg-[#1f1f1f] rounded"
              style={{ width: `${w}%` }}
            />
            <div
              className="h-3 bg-[#1f1f1f] rounded"
              style={{ width: `${w - 20}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// InsightsPanel
// ---------------------------------------------------------------------------
export default function InsightsPanel({
  insights = [],
  title = 'AI Insights',
  loading = false,
}) {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 relative overflow-hidden">
      {/* Left red accent border */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#e63946] rounded-l-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 pl-1">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-[#e63946]" />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {/* Model badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1f1f1f] text-[#555555] border border-[#2a2a2a] tracking-wide uppercase">
          claude-3.5-sonnet
        </span>
      </div>

      {/* Content */}
      <div className="pl-1">
        {loading ? (
          <InsightSkeleton />
        ) : insights.length === 0 ? (
          <p className="text-sm text-[#555555] py-4 text-center">
            No insights available
          </p>
        ) : (
          <ul className="space-y-0">
            {insights.map((insight, i) => (
              <InsightItem key={i} insight={insight} />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#1f1f1f] pl-1">
        <p className="text-[10px] text-[#555555] tracking-wide">
          Generated from live data
        </p>
      </div>
    </div>
  )
}
