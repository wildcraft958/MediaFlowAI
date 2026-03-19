/**
 * App.jsx — Root router + auth guard + page-level code splitting
 *
 * Flow:
 *   Not logged in  → /login (role selection)
 *   Leadership     → /executive (default)
 *   Creator        → /explorer (default)
 *
 * All dashboard pages are wrapped in Layout.
 * ECharts 'frammer-dark' theme is registered once here.
 */

import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Layout from './components/layout/Layout'
import { registerFrammerTheme } from './theme/echarts'
import useStore from './store/useStore'

// Register ECharts theme before any chart renders
registerFrammerTheme()

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'))
const ExecutiveSummary = lazy(() => import('./pages/ExecutiveSummary'))
const UsageTrends    = lazy(() => import('./pages/UsageTrends'))
const TeamActivity   = lazy(() => import('./pages/TeamActivity'))
const PublishMetrics = lazy(() => import('./pages/PublishMetrics'))
const VideoExplorer  = lazy(() => import('./pages/VideoExplorer'))
const Admin          = lazy(() => import('./pages/Admin'))

// ─── Full-screen loading spinner ─────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] z-50">
      <div className="relative w-14 h-14">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#1f1f1f]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
          style={{ borderTopColor: '#e63946' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full bg-[#e63946] flex items-center justify-center">
            <span className="text-white text-xs font-black">F</span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-[11px] text-[#333] tracking-[0.2em] uppercase">Loading…</p>
    </div>
  )
}

// ─── Auth guard — redirects to /login if not authenticated ───────────────────
function RequireAuth({ children }) {
  const isLoggedIn = useStore((s) => s.isLoggedIn)
  const location = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

// ─── Dashboard page wrapper (Layout + auth) ───────────────────────────────────
function Page({ children }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  )
}

// ─── Root redirect — send to persona-appropriate default page ─────────────────
function RootRedirect() {
  const isLoggedIn = useStore((s) => s.isLoggedIn)
  const persona    = useStore((s) => s.persona)

  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <Navigate to={persona === 'creator' ? '/explorer' : '/executive'} replace />
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Root */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public — login / role selection */}
          <Route path="/login" element={<Login />} />

          {/* Protected dashboard routes */}
          <Route path="/executive" element={<Page><ExecutiveSummary /></Page>} />
          <Route path="/trends"    element={<Page><UsageTrends /></Page>} />
          <Route path="/team"      element={<Page><TeamActivity /></Page>} />
          <Route path="/publish"   element={<Page><PublishMetrics /></Page>} />
          <Route path="/explorer"  element={<Page><VideoExplorer /></Page>} />
          <Route path="/admin"     element={<Page><Admin /></Page>} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
