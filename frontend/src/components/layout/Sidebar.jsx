/**
 * Sidebar.jsx - Collapsible left sidebar navigation
 *
 * - Flex item (not fixed) — eliminates the gap issue
 * - Logo area: when collapsed, hover over "F" shows a ChevronRight expand button
 * - Logo area: when expanded, shows "Frammer AI" text + ChevronLeft collapse button
 * - NavLinks with lucide icons, active red styling
 * - RBAC: Admin item only shown for admin role
 * - Creator role: Video Explorer appears first
 * - User name + role badge at very bottom
 */

import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BarChart2,
  Play,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Crown,
  Edit3,
  LogOut,
} from 'lucide-react'
import useStore from '../../store/useStore'
import clsx from 'clsx'

// Role badge color mapping
const ROLE_COLORS = {
  admin:      { bg: 'rgba(230,57,70,0.15)',  border: 'rgba(230,57,70,0.35)',  text: '#ff8fa3'  },
  leadership: { bg: 'rgba(33,150,243,0.12)', border: 'rgba(33,150,243,0.3)',  text: '#64b5f6'  },
  creator:    { bg: 'rgba(76,175,80,0.12)',  border: 'rgba(76,175,80,0.3)',   text: '#81c784'  },
}

const BASE_NAV_ITEMS = [
  { id: 'executive', label: 'Executive Summary', icon: LayoutDashboard, path: '/executive' },
  { id: 'trends',    label: 'Usage & Trends',    icon: TrendingUp,      path: '/trends'    },
  { id: 'team',      label: 'Team Activity',     icon: Users,           path: '/team'      },
  { id: 'publish',   label: 'Publish Metrics',   icon: BarChart2,       path: '/publish'   },
  { id: 'explorer',  label: 'Video Explorer',    icon: Play,            path: '/explorer'  },
]

const ADMIN_ITEM = {
  id: 'admin', label: 'Admin', icon: ShieldCheck, path: '/admin',
}

function getNavItems() {
  return BASE_NAV_ITEMS
}

// Tooltip on hover for collapsed items
function NavTooltip({ label, children }) {
  return (
    <div className="relative group">
      {children}
      <div
        className={clsx(
          'absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50',
          'px-2.5 py-1.5 rounded-lg',
          'bg-[#1a1a1a] border border-[#2a2a2a]',
          'text-xs font-medium text-white whitespace-nowrap',
          'pointer-events-none opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150',
          'shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        )}
      >
        {label}
        <span
          className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
          style={{ borderRightColor: '#2a2a2a' }}
        />
      </div>
    </div>
  )
}

// Single Nav Item
function SidebarNavItem({ item, collapsed }) {
  const Icon = item.icon

  const linkContent = (active) => (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-[10px] mx-2 transition-all duration-150 relative',
        active
          ? 'bg-[rgba(230,57,70,0.14)] text-white border border-[rgba(230,57,70,0.18)]'
          : 'text-[#666666] hover:bg-[#1e1e1e] hover:text-[#c0c0c0] border border-transparent',
      )}
    >
      {active && (
        <motion.span
          layoutId="activeIndicator"
          className="absolute left-0 inset-y-0 w-[3px] bg-accent rounded-r-full"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        size={18}
        strokeWidth={active ? 2.5 : 2}
        className={active ? 'text-accent flex-shrink-0' : 'flex-shrink-0'}
      />

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )

  const navLink = (
    <NavLink to={item.path} end>
      {({ isActive }) => linkContent(isActive)}
    </NavLink>
  )

  return collapsed ? (
    <NavTooltip label={item.label}>{navLink}</NavTooltip>
  ) : (
    navLink
  )
}

export default function Sidebar() {
  const collapsed     = useStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useStore((s) => s.toggleSidebar)
  const user          = useStore((s) => s.user)
  const logout        = useStore((s) => s.logout)
  const navigate      = useNavigate()

  const role    = user?.role || 'leadership'
  const isAdmin = role === 'admin'

  const navItems    = getNavItems()
  const AvatarIcon  = role === 'creator' ? Edit3 : Crown
  const avatarColor = ROLE_COLORS[role] || ROLE_COLORS.leadership

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <motion.aside
      className={clsx(
        'flex-shrink-0 flex flex-col h-full z-30',
        'bg-[#111111] border-r border-[#272727]',
        'overflow-hidden',
      )}
      initial={false}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: 'tween', duration: 0.22, ease: 'easeInOut' }}
    >
      {/* ── Logo header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center border-b border-[#1f1f1f]"
        style={{ height: 64 }}
      >
        {collapsed ? (
          /* Collapsed: "F" logo, hover shows expand arrow */
          <div className="group relative w-full flex items-center justify-center">
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_16px_rgba(230,57,70,0.35)]">
              <span className="text-white text-sm font-black leading-none select-none">F</span>
            </div>

            {/* Hover overlay — expand button */}
            <button
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              className={clsx(
                'absolute inset-0 flex items-center justify-center rounded-none',
                'bg-[#0d0d0d]/80 opacity-0 group-hover:opacity-100',
                'transition-opacity duration-150 cursor-pointer',
              )}
            >
              <ChevronRight size={16} className="text-[#a0a0a0]" />
            </button>
          </div>
        ) : (
          /* Expanded: logo + brand text + collapse button */
          <div className="flex items-center gap-3 px-3 w-full">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_16px_rgba(230,57,70,0.35)]">
              <span className="text-white text-sm font-black leading-none select-none">F</span>
            </div>

            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden whitespace-nowrap"
              >
                <p className="text-sm font-bold text-white leading-tight">Frammer AI</p>
                <p className="text-[10px] text-[#555555] leading-tight mt-0.5">Analytics Dashboard</p>
              </motion.div>
            </AnimatePresence>

            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* ── Main Nav ────────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <SidebarNavItem key={item.id} item={item} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-4 my-3 border-t border-[#1f1f1f]" />
            <SidebarNavItem item={ADMIN_ITEM} collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* ── Bottom: Logout + User ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[#1f1f1f] px-3 pb-4 pt-2 space-y-2">
        {/* Logout */}
        {collapsed ? (
          <NavTooltip label="Logout">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center py-2.5 rounded-[10px] text-[#555] hover:text-[#e63946] hover:bg-[#e63946]/10 transition-all duration-150"
            >
              <LogOut size={15} />
            </button>
          </NavTooltip>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 py-2 px-3 rounded-[10px] text-[#555] hover:text-[#e63946] hover:bg-[#e63946]/10 transition-all duration-150 text-xs font-medium"
          >
            <LogOut size={14} />
            <span className="whitespace-nowrap">Logout</span>
          </button>
        )}

        {/* User info */}
        {collapsed ? (
          <NavTooltip label={`${user?.name || 'Guest'} · ${role}`}>
            <div
              className="mx-auto w-8 h-8 rounded-full flex items-center justify-center cursor-default"
              style={{ background: avatarColor.bg, border: `1px solid ${avatarColor.border}` }}
            >
              <AvatarIcon size={14} style={{ color: avatarColor.text }} />
            </div>
          </NavTooltip>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2.5 px-1"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: avatarColor.bg, border: `1px solid ${avatarColor.border}` }}
            >
              <AvatarIcon size={14} style={{ color: avatarColor.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name || 'Guest'}</p>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ background: avatarColor.bg, border: `1px solid ${avatarColor.border}`, color: avatarColor.text }}
              >
                {role}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.aside>
  )
}
