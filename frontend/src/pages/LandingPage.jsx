/**
 * LandingPage.jsx - Public marketing landing page for MediaFlow AI Analytics Dashboard
 *
 * Dark theme (#0a0a0a bg, #e63946 accent), framer-motion scroll animations,
 * lucide-react icons, react-router-dom navigation.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap,
  ArrowRight,
  Play,
  BarChart2,
  MessageSquare,
  TrendingUp,
  Shield,
  Settings,
} from 'lucide-react'

// ─── Shared animation variant ─────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
}

// ─── Mini bar chart data (hero preview mockup) ────────────────────────────────
const barHeights = [
  28, 45, 35, 60, 42, 55, 38, 70, 52, 48, 65, 44, 58, 40, 72, 50, 62, 35,
  54, 46, 68, 39, 57, 63,
]

// ─── Feature cards ────────────────────────────────────────────────────────────
const features = [
  {
    icon: BarChart2,
    title: 'Executive Summary',
    desc: 'Real-time KPI tracking for high-level oversight. Get a birds-eye view of your entire production ecosystem instantly.',
    highlight: false,
  },
  {
    icon: MessageSquare,
    title: 'Natural Language Query',
    desc: "Conversational data analysis with drag-and-drop context. Ask 'How did our engagement trend last week?' and get answers.",
    highlight: false,
  },
  {
    icon: TrendingUp,
    title: 'Usage & Team Trends',
    desc: "Deep dives into production and performance trends. Identify bottlenecks and optimise your team's creative output.",
    highlight: false,
  },
  {
    icon: Zap,
    title: 'Publish Metrics',
    desc: 'Tracking the final mile of content delivery and engagement across platforms. Monitor your ROI in real-time.',
    highlight: false,
  },
  {
    icon: Shield,
    title: 'Admin Controls',
    desc: 'Granular permissions and access management for teams. Keep your data secure with enterprise-grade security protocols.',
    highlight: false,
  },
  {
    icon: Settings,
    title: '+1 / The MediaFlow Engine',
    desc: 'Proprietary AI content-awareness that connects all your data together seamlessly.',
    highlight: true,
  },
]

// ─── Footer link groups ────────────────────────────────────────────────────────
const footerLinks = [
  {
    heading: 'Product',
    links: ['Features', 'Integrations', 'Pricing', 'Changelog'],
  },
  {
    heading: 'Resources',
    links: ['Documentation', 'API Reference', 'Guides', 'Support'],
  },
  {
    heading: 'Company',
    links: ['About Us', 'Blog', 'Careers', 'Legal'],
  },
]

// ─── KPI cards for hero mockup ────────────────────────────────────────────────
const kpiCards = [
  { label: 'Total Uploaded', value: '4,179', delta: '+12.3%', up: true },
  { label: 'Published', value: '3,188', delta: '+8.1%', up: true },
  { label: 'Overall PCR', value: '69.8%', delta: '-2.1%', up: false },
  { label: 'Avg Processing', value: '4.2h', delta: '-15%', up: true },
]

// ─── Suite preview cards ──────────────────────────────────────────────────────
const suiteCards = [
  {
    label: 'Operations Dashboard',
    desc: '5 purpose-built tabs tracking the full Upload → Process → Publish funnel across 5 workspaces.',
    stat: '19 KPIs · 4,569 videos',
    icon: BarChart2,
    accent: '#e63946',
    gradient: 'linear-gradient(135deg, rgba(230,57,70,0.15) 0%, rgba(10,10,10,0) 100%)',
  },
  {
    label: 'Natural Language Interface',
    desc: 'Ask questions in plain English - the SQL-of-Thought agent translates, executes, and narrates results.',
    stat: 'Gemini 2.0 Flash · multi-turn',
    icon: MessageSquare,
    accent: '#6366f1',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(10,10,10,0) 100%)',
  },
  {
    label: 'Performance Analytics',
    desc: 'Workspace PCR variance (38–92%), Chronos forecasting, and cross-dimension heatmaps.',
    stat: '30-day forecast · D1×D2 drill-down',
    icon: TrendingUp,
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(10,10,10,0) 100%)',
  },
]

// ─── LandingPage ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#ffffff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* ── Top accent line ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, #e63946, transparent)',
          opacity: 0.6,
          zIndex: 100,
        }}
      />

      {/* ── Fixed Navbar ────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          height: '60px',
        }}
      >
        {/* Left - logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 15,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>
            MediaFlow AI
          </span>
        </div>

        {/* Center - nav links (hidden on narrow viewports) */}
        <div
          className="hidden md:flex"
          style={{ gap: '2rem' }}
        >
          {['Features', 'Pricing', 'Solutions'].map((link) => (
            <button
              key={link}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#666',
                fontSize: 14,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
            >
              {link}
            </button>
          ))}
        </div>

        {/* Right - CTA buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              fontSize: 14,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
          >
            Log In
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
              border: 'none',
              borderRadius: 8,
              padding: '0.45rem 1rem',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Go to Dashboard
          </button>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 1.5rem 80px',
          position: 'relative',
        }}
      >
        {/* Ambient red glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(230,57,70,0.08), transparent)',
            pointerEvents: 'none',
          }}
        />

        {/* Badge */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(230,57,70,0.12)',
            border: '1px solid rgba(230,57,70,0.3)',
            borderRadius: 100,
            padding: '0.3rem 0.9rem',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#e63946',
            marginBottom: '1.8rem',
            textTransform: 'uppercase',
          }}
        >
          <Zap size={11} />
          Next-Gen Media Analytics
        </motion.div>

        {/* H1 */}
        <motion.h1
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.05 }}
          style={{
            fontSize: 'clamp(2.6rem, 7vw, 5rem)',
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            maxWidth: 820,
            margin: '0 auto 1.4rem',
          }}
        >
          Elevate Your
          <br />
          Media Operations with{' '}
          <span style={{ color: '#e63946' }}>Intelligent Analytics</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{
            color: '#888',
            fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
            maxWidth: 580,
            margin: '0 auto 2.4rem',
            lineHeight: 1.65,
          }}
        >
          The 5+1 analytical suite for video production. Streamline workflows
          and gain deep insights with MediaFlow AI.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <button
            onClick={() => navigate('/login')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
              border: 'none',
              borderRadius: 10,
              padding: '0.75rem 1.5rem',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'opacity 0.2s, transform 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.88'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Enter Dashboard
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '0.75rem 1.5rem',
              color: '#ccc',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#444'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a'
              e.currentTarget.style.color = '#ccc'
            }}
          >
            <Play size={14} />
            Watch Demo
          </button>
        </motion.div>

        {/* ── Dashboard Preview Mockup ─────────────────────────────────────── */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{
            marginTop: '3.5rem',
            width: '100%',
            maxWidth: 860,
            borderRadius: 16,
            border: '1px solid #1e1e1e',
            background: '#0d0d0d',
            overflow: 'hidden',
            boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px #1a1a1a',
          }}
        >
          {/* Browser chrome */}
          <div
            style={{
              background: '#141414',
              borderBottom: '1px solid #1e1e1e',
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
            <div
              style={{
                marginLeft: '0.75rem',
                flex: 1,
                background: '#0a0a0a',
                borderRadius: 5,
                padding: '0.25rem 0.75rem',
                fontSize: 11,
                color: '#444',
                textAlign: 'left',
              }}
            >
              app.mediaflow.ai/executive
            </div>
          </div>

          {/* Mockup body */}
          <div style={{ padding: '1.25rem 1.25rem 1.5rem' }}>
            {/* KPI cards row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              {kpiCards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: '#111',
                    border: '1px solid #1e1e1e',
                    borderRadius: 10,
                    padding: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                    {card.value}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: card.up ? '#34d399' : '#f87171',
                    }}
                  >
                    {card.delta}
                  </div>
                </div>
              ))}
            </div>

            {/* Mini bar chart */}
            <div
              style={{
                background: '#111',
                border: '1px solid #1e1e1e',
                borderRadius: 10,
                padding: '1rem 1rem 0.75rem',
              }}
            >
              <div style={{ fontSize: 11, color: '#555', marginBottom: '0.75rem', textAlign: 'left' }}>
                Daily Upload Volume - Last 24 days
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 5,
                  height: 72,
                }}
              >
                {barHeights.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      borderRadius: 3,
                      background:
                        i === barHeights.length - 1
                          ? 'linear-gradient(180deg, #e63946 0%, #c1121f 100%)'
                          : 'rgba(230,57,70,0.25)',
                      transition: 'background 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Features Section ────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '6rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              marginBottom: '0.75rem',
            }}
          >
            Analytics for Every Stage
          </h2>
          <p style={{ color: '#666', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
            From upload to publish - every step of your production pipeline,
            visualised and quantified.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {features.map((feat, i) => {
            const Icon = feat.icon
            return (
              <motion.div
                key={feat.title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                style={{
                  background: feat.highlight
                    ? 'rgba(230,57,70,0.06)'
                    : '#0d0d0d',
                  border: feat.highlight
                    ? '1px solid rgba(230,57,70,0.25)'
                    : '1px solid #1a1a1a',
                  borderRadius: 16,
                  padding: '1.5rem',
                  transition: 'border-color 0.2s, transform 0.2s',
                  cursor: 'default',
                }}
                whileHover={{ y: -3 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(230,57,70,0.12)',
                    border: '1px solid rgba(230,57,70,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                    color: '#e63946',
                  }}
                >
                  <Icon size={18} />
                </div>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: '0.5rem',
                    color: feat.highlight ? '#fff' : '#e8e8e8',
                  }}
                >
                  {feat.title}
                </h3>
                <p style={{ color: '#666', fontSize: 13.5, lineHeight: 1.65 }}>
                  {feat.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── Experience the Suite ────────────────────────────────────────────── */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <motion.div {...fadeUp} transition={{ duration: 0.5 }} style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              marginBottom: '0.6rem',
            }}
          >
            Experience the Suite
          </h2>
          <p style={{ color: '#666', fontSize: 14 }}>
            Three lenses. One platform. Total visibility.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {suiteCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.label}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                style={{
                  borderRadius: 16,
                  border: '1px solid #1a1a1a',
                  background: card.gradient,
                  minHeight: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                whileHover={{ y: -3 }}
              >
                {/* subtle grid texture */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.015) 39px, rgba(255,255,255,0.015) 40px)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `${card.accent}18`,
                      border: `1px solid ${card.accent}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      color: card.accent,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#e8e8e8', display: 'block', marginBottom: '0.4rem' }}>
                    {card.label}
                  </span>
                  <p style={{ color: '#666', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    {card.desc}
                  </p>
                </div>
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontSize: 11,
                    fontWeight: 600,
                    color: card.accent,
                    opacity: 0.8,
                    marginTop: '1rem',
                  }}
                >
                  {card.stat}
                </span>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '5rem 1.5rem' }}>
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          style={{
            maxWidth: 800,
            margin: '0 auto',
            borderRadius: 24,
            border: '1px solid rgba(230,57,70,0.2)',
            background:
              'linear-gradient(135deg, rgba(230,57,70,0.07) 0%, rgba(10,10,10,0) 100%)',
            padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1.5rem, 5vw, 4rem)',
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              marginBottom: '0.75rem',
            }}
          >
            Ready to transform your production?
          </h2>
          <p
            style={{
              color: '#777',
              fontSize: 15,
              maxWidth: 480,
              margin: '0 auto 2rem',
              lineHeight: 1.65,
            }}
          >
            Join the world's most innovative media teams using MediaFlow AI to
            scale their content strategy.
          </p>
          <div style={{ display: 'flex', gap: '0.9rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
                border: 'none',
                borderRadius: 10,
                padding: '0.75rem 1.75rem',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Start Free Trial
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #2a2a2a',
                borderRadius: 10,
                padding: '0.75rem 1.75rem',
                color: '#ccc',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#555')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
            >
              Book a Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid #141414',
          padding: '3rem 1.5rem 2rem',
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr repeat(3, auto)',
            gap: '3rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'linear-gradient(135deg, #e63946 0%, #c1121f 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 13,
                  color: '#fff',
                }}
              >
                M
              </div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>MediaFlow AI</span>
            </div>
            <p style={{ color: '#555', fontSize: 13, lineHeight: 1.65, maxWidth: 220 }}>
              Intelligent analytics for the next generation of media production teams.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.heading}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 12,
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.9rem',
                }}
              >
                {col.heading}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {col.links.map((link) => (
                  <li key={link}>
                    <button
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#555',
                        fontSize: 13,
                        padding: 0,
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div
          style={{
            borderTop: '1px solid #141414',
            paddingTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ color: '#444', fontSize: 12 }}>
            © 2026 MediaFlow AI. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            {['Privacy Policy', 'Terms of Service', 'Cookie Settings'].map((label) => (
              <button
                key={label}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#444',
                  fontSize: 12,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#aaa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
