/**
 * Layout.jsx - Main application shell
 *
 * Sidebar is a flex item (not fixed) — no gap, no marginLeft tricks.
 * Main content: flex-col, flex-1, overflow-hidden.
 * main: flex-1 overflow-y-auto (only scrollable region).
 * NLQ panel and button are siblings outside the content area, rendered at
 * end of flex row — their `position:fixed` is unaffected by layout.
 */

import React from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import NLQButton from '../nlq/NLQButton'
import NLQPanel from '../nlq/NLQPanel'

export default function Layout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-white">

      {/* Sidebar — flex item, animates its own width */}
      <Sidebar />

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

      {/* NLQ Floating Panel + Button — fixed position, must be outside any motion ancestor */}
      <NLQPanel />
      <NLQButton />
    </div>
  )
}
