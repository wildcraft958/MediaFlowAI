/**
 * Login.jsx - Email/password login form with test credentials display
 * Full RBAC: admin / leadership / creator roles
 */

import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ChevronDown, ChevronUp, Copy, Check, LogIn } from 'lucide-react'
import useStore from '../store/useStore'

// Test users for competition demo — 4 roles matching PS §2 personas
const TEST_USERS = [
  { email: 'admin@mediaflow.ai',   password: 'Admin@123',   name: 'Admin',       role: 'admin',   persona: 'leadership', defaultPage: '/admin' },
  { email: 'cxo@mediaflow.ai',     password: 'CXO@123',     name: 'Sam Wilson',  role: 'cxo',     persona: 'leadership', defaultPage: '/executive' },
  { email: 'manager@mediaflow.ai',  password: 'Manager@123', name: 'Jordan Lee',  role: 'manager', persona: 'leadership', defaultPage: '/executive' },
  { email: 'analyst@mediaflow.ai',  password: 'Analyst@123', name: 'Alex Taylor', role: 'analyst', persona: 'creator',    defaultPage: '/explorer' },
]

const ROLE_COLORS = {
  admin:   { bg: 'rgba(230,57,70,0.15)',  border: 'rgba(230,57,70,0.4)',  text: '#ff8fa3' },
  cxo:     { bg: 'rgba(33,150,243,0.15)', border: 'rgba(33,150,243,0.4)', text: '#64b5f6' },
  manager: { bg: 'rgba(255,152,0,0.15)',  border: 'rgba(255,152,0,0.4)',  text: '#ffb74d' },
  analyst: { bg: 'rgba(76,175,80,0.15)',  border: 'rgba(76,175,80,0.4)',  text: '#81c784' },
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.leadership
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {role}
    </span>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // fallback silent fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-[#555] hover:text-[#a0a0a0] transition-colors"
      title={`Copy ${text}`}
    >
      {copied ? <Check size={12} className="text-[#4caf50]" /> : <Copy size={12} />}
    </button>
  )
}

export default function Login() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [shaking, setShaking]     = useState(false)
  const [credsOpen, setCredsOpen] = useState(true)

  const setUser  = useStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')

    const match = TEST_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )

    if (!match) {
      setShaking(true)
      setError('Invalid email or password')
      setTimeout(() => setShaking(false), 600)
      return
    }

    setLoading(true)
    // Small UX delay so the spinner shows (feels real)
    await new Promise((r) => setTimeout(r, 800))

    setUser({ name: match.name, email: match.email, role: match.role, persona: match.persona })
    navigate(match.defaultPage)
  }

  const fillCredentials = (user) => {
    setEmail(user.email)
    setPassword(user.password)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient red glow top */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-72 z-0"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(230,57,70,0.12), transparent)',
        }}
      />
      {/* Single top accent line */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-px z-10"
        style={{
          background: 'linear-gradient(90deg, transparent, #e63946, transparent)',
          opacity: 0.6,
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div
          className="rounded-3xl p-10"
          style={{
            background: '#111111',
            border: '1px solid #1f1f1f',
            boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 80px rgba(230,57,70,0.04)',
          }}
        >
          {/* Logo + Title */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{
                background: 'linear-gradient(135deg, #e63946, #c62828)',
                boxShadow: '0 0 32px rgba(230,57,70,0.35)',
              }}
              animate={{
                boxShadow: [
                  '0 0 24px rgba(230,57,70,0.3)',
                  '0 0 44px rgba(230,57,70,0.5)',
                  '0 0 24px rgba(230,57,70,0.3)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="text-white text-2xl font-black leading-none">M</span>
            </motion.div>
            <h1 className="text-2xl font-black text-white mb-0.5 tracking-tight">MediaFlow AI</h1>
            <p className="text-sm text-[#555]">Analytics Dashboard</p>
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            animate={shaking ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            {/* Email */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mediaflow.ai"
                autoComplete="email"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-[#444] focus:outline-none focus:ring-0"
                style={{
                  background: '#0d0d0d',
                  border: '1px solid #2a2a2a',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#e63946')}
                onBlur={(e)  => (e.target.style.borderColor = '#2a2a2a')}
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#a0a0a0] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm text-white placeholder-[#444] focus:outline-none focus:ring-0"
                  style={{
                    background: '#0d0d0d',
                    border: '1px solid #2a2a2a',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#e63946')}
                  onBlur={(e)  => (e.target.style.borderColor = '#2a2a2a')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#a0a0a0] transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  className="text-xs text-[#e63946] mb-3 text-center"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-70"
              style={{
                background: 'linear-gradient(135deg, #e63946, #c62828)',
                boxShadow: '0 0 24px rgba(230,57,70,0.35)',
              }}
            >
              {loading ? (
                <>
                  <motion.div
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </motion.form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#1f1f1f]" />
            <span className="text-[10px] font-medium text-[#333] uppercase tracking-wider">Test Credentials</span>
            <div className="flex-1 h-px bg-[#1f1f1f]" />
          </div>

          {/* Test Credentials collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setCredsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a] transition-all mb-2"
            >
              <span className="font-medium">For judges - click any row to fill form</span>
              {credsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <AnimatePresence initial={false}>
              {credsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid #1f1f1f', background: '#0d0d0d' }}
                  >
                    {TEST_USERS.map((user, idx) => (
                      <div
                        key={user.email}
                        className="group flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#1a1a1a] transition-colors"
                        style={{ borderBottom: idx < TEST_USERS.length - 1 ? '1px solid #1a1a1a' : 'none' }}
                        onClick={() => fillCredentials(user)}
                      >
                        {/* Role badge */}
                        <div className="flex-shrink-0 w-20">
                          <RoleBadge role={user.role} />
                        </div>

                        {/* Credentials */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-[#a0a0a0] font-mono truncate">{user.email}</span>
                            <CopyButton text={user.email} />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-[#555] font-mono">{user.password}</span>
                            <CopyButton text={user.password} />
                          </div>
                        </div>

                        {/* Use button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); fillCredentials(user) }}
                          className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#e63946] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: 'rgba(230,57,70,0.12)', border: '1px solid rgba(230,57,70,0.25)' }}
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#333] text-center mt-2">
                    Demo dashboard - mock data from enriched MediaFlow dataset (4,569 rows, seed=42)
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
