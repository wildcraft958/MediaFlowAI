/**
 * TopNav.jsx — Sticky top navigation bar (64px tall)
 *
 * Left:    hamburger (mobile) + breadcrumb (current page name)
 * Center:  global search input (hidden on mobile)
 * Right:   COUNT/HOURS toggle · Role badge · Alert bell · CLIENT_1 badge
 *          (some controls hidden on small screens)
 */

import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Crown,
  Edit3,
  ChevronRight,
  X,
  AlertTriangle,
  Activity,
  Info,
  Menu,
} from 'lucide-react'
import CountHoursToggle from '../common/CountHoursToggle'
import useStore from '../../store/useStore'
import useIsMobile from '../../hooks/useIsMobile'
import clsx from 'clsx'

// ─── Route → Page name map ────────────────────────────────────────────────────
const PAGE_NAMES = {
  '/executive': 'Executive Summary',
  '/trends':    'Usage & Trends',
  '/team':      'Team Activity',
  '/publish':   'Publish Metrics',
  '/explorer':  'Video Explorer',
  '/admin':     'Admin',
}

// ─── Severity → color + icon ──────────────────────────────────────────────────
const SEVERITY_META = {
  warning: { color: '#ff9800', Icon: AlertTriangle },
  info:    { color: '#2196f3', Icon: Info           },
  neutral: { color: '#a0a0a0', Icon: Activity       },
  danger:  { color: '#e63946', Icon: AlertTriangle  },
  success: { color: '#4caf50', Icon: Activity       },
}

// ─── Role Badge (read-only — role is set at login) ───────────────────────────
function RoleBadge() {
  const user = useStore((s) => s.user)
  const role = user?.role || 'cxo'
  const isLeader = role === 'cxo' || role === 'admin' || role === 'manager'

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
        'border select-none',
        isLeader
          ? 'bg-accent/10 border-accent/30 text-accent'
          : 'bg-bg-card border-border-2 text-text-secondary',
      )}
    >
      {isLeader ? <Crown size={11} /> : <Edit3 size={11} />}
      {{ admin: 'Admin', cxo: 'CXO', manager: 'Manager', analyst: 'Analyst' }[role] || role}
    </span>
  )
}

// ─── Inbox Dropdown ───────────────────────────────────────────────────────────
function InboxDropdown({ messages, onMarkRead, onDismiss, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 bg-bg-card border border-border-2 rounded-card shadow-card-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-1">
        <span className="text-xs font-bold text-white uppercase tracking-wider">Agent Inbox</span>
        <button onClick={onClose} className="text-text-muted hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-72 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="py-8 text-center">
            <Bell size={20} className="text-text-muted mx-auto mb-2" />
            <p className="text-xs text-text-muted">No notifications</p>
          </div>
        ) : (
          messages.map((msg) => {
            const { color, Icon } = SEVERITY_META[msg.severity] || SEVERITY_META.neutral
            return (
              <div
                key={msg.id}
                onClick={() => onMarkRead(msg.id)}
                className={clsx(
                  'flex items-start gap-3 px-4 py-3 border-b border-border-1 last:border-0',
                  'cursor-pointer transition-colors hover:bg-bg-card-hover',
                  !msg.read && 'bg-bg-base/50',
                )}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}20` }}
                >
                  <Icon size={12} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <p className={clsx('text-xs font-semibold leading-tight', msg.read ? 'text-text-secondary' : 'text-white')}>
                      {msg.title}
                    </p>
                    {!msg.read && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
                    )}
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{msg.body}</p>
                  <p className="text-[10px] text-text-muted mt-1">{msg.time}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDismiss(msg.id) }}
                  className="text-text-muted hover:text-white transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={11} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </motion.div>
  )
}

// ─── Alert Bell ───────────────────────────────────────────────────────────────
function AlertBell() {
  const [open, setOpen]     = useState(false)
  const agentInboxCount     = useStore((s) => s.agentInboxCount)
  const agentMessages       = useStore((s) => s.agentMessages)
  const markMessageRead     = useStore((s) => s.markMessageRead)
  const dismissMessage      = useStore((s) => s.dismissMessage)
  const fetchInsights       = useStore((s) => s.fetchInsights)
  const insightsLoaded      = useStore((s) => s.insightsLoaded)

  // Fetch insights on mount and poll every 60s
  useEffect(() => {
    if (!insightsLoaded) fetchInsights()
    const interval = setInterval(() => fetchInsights(), 60000)
    return () => clearInterval(interval)
  }, [fetchInsights, insightsLoaded])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={clsx(
          'relative w-9 h-9 rounded-[10px] flex items-center justify-center transition-colors',
          open
            ? 'bg-bg-card-hover text-white'
            : 'text-text-muted hover:bg-bg-card hover:text-text-secondary',
        )}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {agentInboxCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
            <span className="text-[9px] font-bold text-white leading-none">{agentInboxCount}</span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <InboxDropdown
            messages={agentMessages}
            onMarkRead={markMessageRead}
            onDismiss={dismissMessage}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main TopNav ──────────────────────────────────────────────────────────────
export default function TopNav() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const [search, setSearch] = useState('')
  const toggleMobileMenu = useStore((s) => s.toggleMobileMenu)
  const isMobile = useIsMobile()

  const pageName = PAGE_NAMES[location.pathname] || 'Dashboard'

  // Very simple search: on Enter, navigate to video explorer with query
  const handleSearch = (e) => {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/explorer?q=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-2 sm:gap-4 px-3 sm:px-6"
      style={{
        height: 'var(--topnav-height, 64px)',
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #1f1f1f',
      }}
    >
      {/* ─── Left: Hamburger (mobile) + Breadcrumb ──────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isMobile && (
          <button
            onClick={toggleMobileMenu}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-text-muted hover:bg-bg-card hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        )}
        <span className="text-text-muted text-xs hidden sm:inline">MediaFlow AI</span>
        <ChevronRight size={12} className="text-text-muted hidden sm:inline" />
        <span className="text-white text-sm font-semibold truncate">{pageName}</span>
      </div>

      {/* ─── Center: Search (hidden on mobile) ─────────────────────────── */}
      <div className="flex-1 max-w-sm mx-auto relative hidden md:block">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          placeholder="Search videos, KPIs, workspaces..."
          className={clsx(
            'w-full pl-8 pr-4 py-2 rounded-[10px] text-sm',
            'bg-bg-card border border-border-1',
            'text-white placeholder-text-muted',
            'outline-none transition-all duration-150',
            'focus:border-accent/50 focus:shadow-[0_0_0_2px_rgba(230,57,70,0.1)]',
          )}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ─── Right: Controls ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        {/* COUNT / HOURS toggle — hidden on small screens */}
        <div className="hidden lg:block">
          <CountHoursToggle />
        </div>

        {/* Role badge (read-only) — hidden on very small screens */}
        <div className="hidden sm:block">
          <RoleBadge />
        </div>

        {/* Alert bell with inbox dropdown — always visible */}
        <AlertBell />

        {/* Client badge — hidden on small screens */}
        <div
          className={clsx(
            'hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px]',
            'bg-bg-card border border-border-2',
            'text-xs font-mono font-semibold text-text-secondary',
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          CLIENT_1
        </div>
      </div>
    </header>
  )
}
