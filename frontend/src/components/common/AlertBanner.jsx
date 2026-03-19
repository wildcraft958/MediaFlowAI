/**
 * AlertBanner — stacked alert notifications at the top of page content
 *
 * Props:
 *   alerts    [{ id, message, severity: 'error'|'warning'|'info', workspace? }]
 *   onDismiss fn(id) — called when X is clicked
 */

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, AlertTriangle, Info, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------
const SEVERITY_STYLES = {
  error: {
    border: 'border-l-[#e63946]',
    icon: AlertCircle,
    iconColor: 'text-[#e63946]',
    bg: 'bg-[#e63946]/8',
    text: 'text-[#ff8fa3]',
  },
  warning: {
    border: 'border-l-[#ff9800]',
    icon: AlertTriangle,
    iconColor: 'text-[#ff9800]',
    bg: 'bg-[#ff9800]/8',
    text: 'text-[#ffb74d]',
  },
  info: {
    border: 'border-l-[#2196f3]',
    icon: Info,
    iconColor: 'text-[#2196f3]',
    bg: 'bg-[#2196f3]/8',
    text: 'text-[#64b5f6]',
  },
}

// ---------------------------------------------------------------------------
// Single alert item
// ---------------------------------------------------------------------------
function AlertItem({ alert, onDismiss }) {
  const { id, message, severity = 'info', workspace } = alert
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info
  const SeverityIcon = style.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scaleY: 0.8 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      exit={{ opacity: 0, y: -12, scaleY: 0.85, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className={[
        'flex items-start gap-3 px-4 py-3',
        'border-l-4 rounded-xl',
        'border border-[#2a2a2a]',
        style.border,
        style.bg,
      ].join(' ')}
    >
      {/* Bell + severity icon combo */}
      <div className="flex-shrink-0 flex items-center gap-1.5 mt-0.5">
        <Bell size={13} className={style.iconColor} />
        <SeverityIcon size={14} className={style.iconColor} />
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${style.text} leading-relaxed`}>
          {message}
        </p>
        {workspace && (
          <p className="text-xs text-[#555555] mt-0.5">
            Workspace: <span className="text-[#a0a0a0]">{workspace}</span>
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss?.(id)}
        className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[#555555] hover:text-white hover:bg-[#ffffff]/10 transition-colors mt-0.5"
        aria-label="Dismiss alert"
      >
        <X size={13} />
      </button>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// AlertBanner
// ---------------------------------------------------------------------------
export default function AlertBanner({ alerts = [], onDismiss }) {
  if (alerts.length === 0) return null

  return (
    <div className="w-full space-y-2 mb-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}
