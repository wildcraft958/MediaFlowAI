/**
 * Badge — status / type / workspace pill badge
 *
 * Props:
 *   variant  'raw'|'enhanced'|'success'|'warning'|'danger'|'info'|'neutral'|'workspace'
 *   size     'sm' (default) | 'md'
 *   children text content — for workspace variant, children should be workspace name
 */

import React from 'react'
import clsx from 'clsx'

// ---------------------------------------------------------------------------
// Workspace-specific colors
// ---------------------------------------------------------------------------
const WS_COLORS = {
  'WS-DIGITAL-NEWS': {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  'WS-ENTERTAINMENT': {
    bg: 'bg-pink-500/20',
    text: 'text-pink-400',
    border: 'border-pink-500/30',
  },
  'WS-TECH-ANALYSIS': {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  'WS-LIFESTYLE': {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  'WS-SPORTS-LIVE': {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
}

// Fallback for unknown workspaces
const WS_FALLBACK = {
  bg: 'bg-gray-500/20',
  text: 'text-gray-400',
  border: 'border-gray-500/30',
}

// ---------------------------------------------------------------------------
// Variant class maps
// ---------------------------------------------------------------------------
const VARIANT_CLASSES = {
  raw: 'bg-[#e63946]/20 text-[#e63946] border border-[#e63946]/30',
  enhanced: 'bg-[#ff8fa3]/20 text-[#ff8fa3] border border-[#ff8fa3]/30',
  success: 'bg-[#4caf50]/20 text-[#4caf50] border border-[#4caf50]/30',
  warning: 'bg-[#ff9800]/20 text-[#ff9800] border border-[#ff9800]/30',
  danger: 'bg-[#e63946]/20 text-[#e63946] border border-[#e63946]/30',
  info: 'bg-[#2196f3]/20 text-[#2196f3] border border-[#2196f3]/30',
  neutral: 'bg-[#333333]/50 text-[#999999] border border-transparent',
}

// ---------------------------------------------------------------------------
// Size class maps
// ---------------------------------------------------------------------------
const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5 rounded-md',
  md: 'text-sm px-3 py-1 rounded-lg',
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
export default function Badge({ variant = 'neutral', size = 'sm', children }) {
  let variantClasses

  if (variant === 'workspace') {
    const ws = WS_COLORS[children] ?? WS_FALLBACK
    variantClasses = clsx(ws.bg, ws.text, 'border', ws.border)
  } else {
    variantClasses = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium uppercase tracking-wide whitespace-nowrap',
        SIZE_CLASSES[size] ?? SIZE_CLASSES.sm,
        variantClasses
      )}
    >
      {children}
    </span>
  )
}
