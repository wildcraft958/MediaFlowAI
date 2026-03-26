/**
 * Layout.jsx - Main application shell
 *
 * Sidebar is a flex item on desktop (not fixed) — no gap, no marginLeft tricks.
 * On mobile (<768px), sidebar is hidden and rendered as a fixed overlay when toggled.
 * Main content: flex-col, flex-1, overflow-hidden.
 * main: flex-1 overflow-y-auto (only scrollable region).
 * NLQ panel and button are siblings outside the content area, rendered at
 * end of flex row — their `position:fixed` is unaffected by layout.
 */

import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import NLQButton from '../nlq/NLQButton'
import NLQPanel from '../nlq/NLQPanel'
import useStore from '../../store/useStore'
import useIsMobile from '../../hooks/useIsMobile'

const PATH_TO_TAB = {
  '/executive': 'executive',
  '/trends': 'trends',
  '/team': 'team',
  '/publish': 'publish',
  '/explorer': 'explorer',
  '/admin': 'admin',
  '/': 'executive',
}

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const showNLQ = pathname !== '/admin'
  const setActiveTab = useStore((s) => s.setActiveTab)
  const mobileMenuOpen = useStore((s) => s.mobileMenuOpen)
  const setMobileMenuOpen = useStore((s) => s.setMobileMenuOpen)
  const isMobile = useIsMobile()

  useEffect(() => {
    const tab = PATH_TO_TAB[pathname]
    if (tab) setActiveTab(tab)
  }, [pathname, setActiveTab])

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    if (!isMobile && mobileMenuOpen) {
      setMobileMenuOpen(false)
    }
  }, [isMobile, mobileMenuOpen, setMobileMenuOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-white">

      {/* Desktop: Sidebar as flex item */}
      {!isMobile && <Sidebar />}

      {/* Mobile: Sidebar as overlay */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <>
            <motion.div
              key="sidebar-backdrop"
              role="button"
              tabIndex={-1}
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="sidebar-backdrop"
              onClick={() => setMobileMenuOpen(false)}
            />
            <Sidebar isMobile onClose={() => setMobileMenuOpen(false)} />
          </>
        )}
      </AnimatePresence>

      {/* Main content area — grows to fill remaining width */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative">

        {/* Ambient top glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 z-0 overflow-hidden">
          <div
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(230,57,70,0.07), transparent)',
            }}
            className="w-full h-full"
          />
        </div>

        {/* Single red top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-px z-20 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, #e63946, transparent)',
            opacity: 0.4,
          }}
        />

        {/* Top Navigation */}
        <TopNav />

        {/* Page content — the only scrollable area */}
        <main className="flex-1 overflow-y-auto relative z-10 pb-20">
          {children}
        </main>
      </div>

      {/* NLQ Floating Panel + Button — hidden on Admin page to avoid duplicate chat UIs */}
      {showNLQ && <NLQPanel />}
      {showNLQ && <NLQButton />}
    </div>
  )
}
