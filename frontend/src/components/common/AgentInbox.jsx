/**
 * AgentInbox — HITL agent inbox widget (collapsible)
 *
 * Props:
 *   count       number — unread / pending count
 *   items       [{ id, type:'notify'|'question'|'review', title, body, timestamp, workspace? }]
 *   onItemClick fn(item)
 *   className   string
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  HelpCircle,
  Eye,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Inbox,
  Check,
  X,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ---------------------------------------------------------------------------
// Type config
// ---------------------------------------------------------------------------
const TYPE_CONFIG = {
  notify: {
    icon: Bell,
    color: 'text-[#2196f3]',
    bg: 'bg-[#2196f3]/10',
    border: 'border-[#2196f3]/20',
    label: 'Notification',
    actions: ['Acknowledge'],
  },
  question: {
    icon: HelpCircle,
    color: 'text-[#ff9800]',
    bg: 'bg-[#ff9800]/10',
    border: 'border-[#ff9800]/20',
    label: 'Question',
    actions: ['Approve', 'Deny'],
  },
  review: {
    icon: Eye,
    color: 'text-[#9c27b0]',
    bg: 'bg-[#9c27b0]/10',
    border: 'border-[#9c27b0]/20',
    label: 'Review',
    actions: ['Approve', 'Deny'],
  },
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------
function relativeTime(timestamp) {
  if (!timestamp) return ''
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// InboxItem
// ---------------------------------------------------------------------------
function InboxItem({ item, onItemClick }) {
  const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.notify
  const Icon = config.icon
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      className={[
        'flex items-start gap-3 p-3 rounded-xl border transition-colors duration-150',
        'bg-[#0d0d0d] hover:bg-[#111111]',
        config.border,
        onItemClick ? 'cursor-pointer' : '',
      ].join(' ')}
      onClick={() => onItemClick?.(item)}
    >
      {/* Type icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}
      >
        <Icon size={14} className={config.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-xs font-medium text-white truncate">{item.title}</p>
          <span className="text-[10px] text-[#555555] flex-shrink-0">
            {relativeTime(item.timestamp)}
          </span>
        </div>
        {item.body && (
          <p className="text-[11px] text-[#a0a0a0] leading-relaxed line-clamp-2">
            {item.body}
          </p>
        )}
        {item.workspace && (
          <span className="inline-block mt-1 text-[10px] text-[#555555]">
            {item.workspace}
          </span>
        )}

        {/* Action buttons */}
        <div
          className="flex items-center gap-1.5 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          {config.actions.includes('Approve') && (
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#4caf50]/15 text-[#4caf50] hover:bg-[#4caf50]/25 transition-colors"
            >
              <Check size={10} />
              Approve
            </button>
          )}
          {config.actions.includes('Deny') && (
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#e63946]/15 text-[#e63946] hover:bg-[#e63946]/25 transition-colors"
            >
              <X size={10} />
              Deny
            </button>
          )}
          {config.actions.includes('Acknowledge') && (
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#2196f3]/15 text-[#2196f3] hover:bg-[#2196f3]/25 transition-colors"
            >
              <CheckCircle size={10} />
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentInbox
// ---------------------------------------------------------------------------
export default function AgentInbox({
  count = 0,
  items = [],
  onItemClick,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false)

  const effectiveCount = count || items.length

  return (
    <div
      className={`bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden ${className}`}
    >
      {/* Header / collapsed view */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Inbox size={15} className="text-[#a0a0a0]" />
          <span className="text-sm font-semibold text-white">Agent Inbox</span>
          {effectiveCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#e63946] text-white text-[10px] font-bold">
              {effectiveCount > 99 ? '99+' : effectiveCount}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-[#555555]" />
        ) : (
          <ChevronDown size={14} className="text-[#555555]" />
        )}
      </button>

      {/* Expanded item list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1f1f1f] px-3 py-3 space-y-2 max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="w-10 h-10 rounded-xl bg-[#1f1f1f] flex items-center justify-center">
                    <CheckCircle size={18} className="text-[#4caf50]/60" />
                  </div>
                  <p className="text-xs text-[#555555]">No pending items</p>
                </div>
              ) : (
                items.map((item) => (
                  <InboxItem
                    key={item.id}
                    item={item}
                    onItemClick={onItemClick}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
