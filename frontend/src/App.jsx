/**
 * App.jsx — Root router + auth guard + page-level code splitting
 *
 * Flow:
 *   /           → LandingPage (public — always visible)
 *   /login      → Login (public — role selection)
 *   Leadership  → /executive (default after login)
 *   Creator     → /explorer (default after login)
 *
 * All dashboard pages are wrapped in Layout.
 * ECharts 'dashboard-dark' theme is registered once here.
 */

import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import Layout from './components/layout/Layout'
import { registerDashboardTheme } from './theme/echarts'
import useStore from './store/useStore'

// Register ECharts theme before any chart renders
registerDashboardTheme()

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
const LandingPage    = lazy(() => import('./pages/LandingPage'))
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
            <span className="text-white text-xs font-black">M</span>
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

// ─── Admin guard — redirects non-admin users to /executive ───────────────────
function RequireAdmin({ children }) {
  const user = useStore((s) => s.user)

  if (user?.role !== 'admin') {
    return <Navigate to="/executive" replace />
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public landing page — always accessible */}
          <Route path="/" element={<LandingPage />} />

          {/* Public — login / role selection */}
          <Route path="/login" element={<Login />} />

          {/* Protected dashboard routes */}
          <Route path="/executive" element={<Page><ExecutiveSummary /></Page>} />
          <Route path="/trends"    element={<Page><UsageTrends /></Page>} />
          <Route path="/team"      element={<Page><TeamActivity /></Page>} />
          <Route path="/publish"   element={<Page><PublishMetrics /></Page>} />
          <Route path="/explorer"  element={<Page><VideoExplorer /></Page>} />
          <Route path="/admin"     element={<Page><RequireAdmin><Admin /></RequireAdmin></Page>} />

          {/* 404 — back to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
