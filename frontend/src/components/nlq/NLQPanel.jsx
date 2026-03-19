/**
 * NLQPanel — two-stage AI analytics panel
 *
 * Stage 1 (compact): floating bottom-right panel (NOT full-height sidebar)
 *   - No backdrop — page stays interactive
 *   - Positioned above the FAB button
 * Stage 2 (expanded): large centered modal with chart area + backdrop
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Bot,
  User,
  Zap,
  BarChart2,
  TrendingUp,
} from 'lucide-react'
import useStore from '../../store/useStore'
import { postNLQ, openNLQStream } from '../../api/client'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const QUICK_PROMPTS = [
  'PCR by workspace',
  'Top performers this month',
  'WS-SPORTS-LIVE deep dive',
  'Upload vs publish trend',
]

const THOUGHT_STEPS = ['Router', 'Interpret', 'Execute', 'Narrate']

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-[#1e1e1e] rounded-2xl rounded-bl-sm w-fit">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          className="block w-1.5 h-1.5 rounded-full bg-[#888]"
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thought process collapsible (completed)
// ---------------------------------------------------------------------------
function ThoughtProcess({ steps }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border border-[#2a2a2a] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[#555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a] transition-colors text-left"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Zap size={11} />
        Thought process
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 font-mono text-[10px] text-[#555] space-y-1 border-t border-[#252525] pt-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[#e63946]">-&gt;</span>
                  <span>
                    <span className="text-[#a0a0a0]">{THOUGHT_STEPS[i] ?? `Step ${i + 1}`}:</span>{' '}
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live thought display (streaming — shows steps as they arrive)
// ---------------------------------------------------------------------------
function LiveThoughtDisplay({ steps }) {
  if (!steps || steps.length === 0) return null
  return (
    <div className="mt-1 border border-[#1e2a1e] rounded-lg overflow-hidden bg-[#0d130d]">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[#1a2a1a]">
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="block w-1.5 h-1.5 rounded-full bg-[#4caf50]"
        />
        <span className="text-[10px] font-medium text-[#4caf50]">Running agent…</span>
      </div>
      <div className="px-3 py-2 font-mono text-[10px] text-[#555] space-y-1 max-h-28 overflow-y-auto">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-start gap-2"
          >
            <span className="text-[#4caf50] flex-shrink-0">▶</span>
            <span>
              <span className="text-[#a0a0a0]">[{step.node}]</span>{' '}
              <span className="text-[#666]">{step.action}</span>
              {step.detail && <span className="text-[#444]"> — {step.detail}</span>}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------
function FilterChip({ label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e63946]/15 text-[#e63946] border border-[#e63946]/25">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ msg }) {
  const isBot = msg.role === 'bot'

  if (isBot) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e63946]/15 border border-[#e63946]/30 flex items-center justify-center">
          <Bot size={13} className="text-[#e63946]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-[#e8e8e8] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
            {msg.filters && msg.filters.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#2a2a2a]">
                <span className="text-[10px] text-[#555] mr-1">Filters:</span>
                {msg.filters.map((f, i) => <FilterChip key={i} label={f} />)}
              </div>
            )}
          </div>
          {msg.thoughts && msg.thoughts.length > 0 && <ThoughtProcess steps={msg.thoughts} />}
          {msg.ts && <p className="text-[10px] text-[#333] mt-1 ml-1">{msg.ts}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end justify-end gap-2.5">
      <div className="max-w-[75%]">
        <div className="bg-[#e63946] rounded-2xl rounded-br-sm px-4 py-3">
          <p className="text-sm text-white leading-relaxed">{msg.text}</p>
        </div>
        {msg.ts && <p className="text-[10px] text-[#333] mt-1 mr-1 text-right">{msg.ts}</p>}
      </div>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#222] border border-[#333] flex items-center justify-center">
        <User size={13} className="text-[#a0a0a0]" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart preview area (expanded mode only)
// ---------------------------------------------------------------------------
function ChartPreviewArea() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <BarChart2 size={15} className="text-[#e63946]" />
        <span className="text-sm font-semibold text-white">Visual Analysis</span>
        <span className="text-[10px] text-[#555] ml-auto uppercase tracking-wider">Step 5 — Agent wiring pending</span>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {/* PCR by workspace */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex-1">
          <p className="text-xs font-semibold text-[#888] mb-4 uppercase tracking-wider">PCR by Workspace</p>
          {[
            { name: 'WS-DIGITAL-NEWS',  pcr: 92, color: '#4caf50' },
            { name: 'WS-ENTERTAINMENT', pcr: 82, color: '#4caf50' },
            { name: 'WS-TECH-ANALYSIS', pcr: 68, color: '#ff9800' },
            { name: 'WS-LIFESTYLE',     pcr: 52, color: '#ff9800' },
            { name: 'WS-SPORTS-LIVE',   pcr: 38, color: '#e63946' },
          ].map((ws) => (
            <div key={ws.name} className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-[#a0a0a0] font-medium">{ws.name.replace('WS-', '')}</span>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: ws.color }}>{ws.pcr}%</span>
              </div>
              <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ws.color, opacity: 0.85 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${ws.pcr}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Funnel summary */}
        <div className="bg-[#111] border border-[#222] rounded-xl p-4">
          <p className="text-xs font-semibold text-[#888] mb-3 uppercase tracking-wider">Pipeline Summary</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Uploaded',  value: '4,179', color: '#64b5f6' },
              { label: 'Processed', value: '4,179', color: '#81c784' },
              { label: 'Published', value: '3,188', color: '#ce93d8' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-xl bg-[#0d0d0d] border border-[#1f1f1f]">
                <p className="text-base font-black tabular-nums" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-[#555] uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <TrendingUp size={11} className="text-[#4caf50]" />
            <p className="text-[10px] text-[#a0a0a0]">Overall PCR: <span className="text-white font-bold">69.8%</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

// Keywords that signal an analytics / media-ops query
const ANALYTICS_SIGNALS = [
  'pcr', 'fsc', 'lpi', 'teu', 'opi', 'mci', 'zsp', 'hthr', 'tsqi', 'pig', 'agv', 'pmi',
  'kpi', 'metric', 'trend', 'upload', 'publish', 'process', 'workspace', 'team', 'user',
  'video', 'frammer', 'funnel', 'channel', 'platform', 'youtube', 'instagram', 'shorts', 'reels',
  'interview', 'news', 'speech', 'debate', 'special', 'report', 'discussion',
  'digital', 'entertainment', 'sports', 'lifestyle', 'analysis', 'analytics',
  'dashboard', 'data', 'count', 'hour', 'rate', 'score', 'index', 'performance',
  'bottleneck', 'gap', 'anomaly', 'deviation', 'breakdown', 'compare', 'top', 'best', 'worst',
  'summary', 'executive', 'weekly', 'daily', 'monthly', 'growth', 'drop', 'peak',
]

// Topics clearly outside the analytics domain — graceful block
const OFF_TOPIC_SIGNALS = [
  'recipe', 'cook', 'weather', 'forecast', 'poem', 'song', 'story', 'joke', 'travel',
  'history', 'geography', 'capital of', 'translate', 'language', 'math problem',
  'calculate 2', 'who is', 'what is the meaning', 'define ', 'synonym', 'antonym',
  'movie review', 'game', 'sport score', 'stock price', 'crypto', 'bitcoin',
  'politics', 'election', 'news headline', 'hello world', 'hi there', 'how are you',
]

const OFF_TOPIC_REPLY = {
  role: 'bot',
  text: "I can only answer questions about the Frammer AI analytics dashboard — KPIs, workspace performance, publish funnels, video trends, and team activity.\n\nTry asking:\n• \"Which workspace has the lowest PCR?\"\n• \"Show upload vs publish trend for WS-SPORTS-LIVE\"\n• \"What is the LPI score for Hindi content?\"",
  thoughts: ['Query scoped outside analytics domain', 'Guardrail triggered — off-topic request', 'Returning scoped guidance without API call'],
  filters: [],
}

function isOffTopic(query) {
  const lower = query.toLowerCase()
  // Block if any off-topic signal matches
  if (OFF_TOPIC_SIGNALS.some((s) => lower.includes(s))) return true
  // Block if query is very short and has no analytics signal
  if (lower.length < 8) return true
  // Allow if any analytics signal is present
  if (ANALYTICS_SIGNALS.some((s) => lower.includes(s))) return false
  // For ambiguous queries (no clear signal either way), let them through to the agent
  return false
}

function sanitizeAnswer(text) {
  if (!text || typeof text !== 'string') return 'No response received.'
  // Strip excessive whitespace
  return text.trim().replace(/\n{3,}/g, '\n\n').slice(0, 4000)
}

// ---------------------------------------------------------------------------
// Placeholder bot response
// ---------------------------------------------------------------------------
const PLACEHOLDER_RESPONSE = {
  role: 'bot',
  text:
    "I'm the Frammer AI analytics agent. The full LangGraph pipeline (Router > Interpret > Execute > Narrate) integrates in Step 5.\n\nOnce wired I can:\n• Query live KPIs from DuckDB\n• Break down PCR by workspace, team, or time\n• Detect anomalies in the publish pipeline\n• Run SQL-of-Thought with chain-of-thought reasoning",
  thoughts: [
    'Query classified as analytics intent',
    'Schema linked to fact_video_events + v_pcr view',
    'Agent pipeline pending Step 5 integration',
    'Returning placeholder with roadmap context',
  ],
}

// ---------------------------------------------------------------------------
// Shared chat input bar
// ---------------------------------------------------------------------------
function ChatInput({ input, setInput, loading, onSend, inputRef }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-[#222]">
      <div className="flex items-end gap-2 bg-[#111] border border-[#2a2a2a] rounded-2xl px-4 py-3 focus-within:border-[#e63946]/50 transition-colors">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about KPIs, workspaces, trends, videos…"
          rows={1}
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-white placeholder-[#444] resize-none outline-none focus:outline-none focus:ring-0 leading-relaxed min-h-[22px] max-h-28 overflow-y-auto disabled:opacity-50"
          style={{ fieldSizing: 'content' }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || loading}
          className={[
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all',
            input.trim() && !loading
              ? 'bg-[#e63946] text-white hover:bg-[#c62828] shadow-[0_0_12px_rgba(230,57,70,0.35)]'
              : 'bg-[#1f1f1f] text-[#333] cursor-not-allowed',
          ].join(' ')}
        >
          <ArrowRight size={14} />
        </button>
      </div>
      <p className="text-[10px] text-[#2a2a2a] mt-1.5 text-center">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NLQPanel
// ---------------------------------------------------------------------------
// Stable per-browser session ID — persists across page reloads, unique per device
function getSessionId() {
  const KEY = 'nlq_session_id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

export default function NLQPanel({ className = '' }) {
  const nlqOpen    = useStore((s) => s.nlqOpen ?? false)
  const setNlqOpen = useStore((s) => s.setNlqOpen)

  // Stable session ID — wires multi-turn history in the backend agent
  const sessionId = useRef(getSessionId())

  // expanded = large centered modal; compact = floating panel (no backdrop, no page block)
  const [expanded, setExpanded] = useState(false)

  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hi! I'm Frammer AI. Ask me anything about your content analytics.",
      ts: formatTime(new Date()),
    },
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [liveThoughts, setLiveThoughts] = useState([])  // SSE thought steps (live)
  const messagesEndRef             = useRef(null)
  const inputRef                   = useRef(null)
  const activeSourceRef            = useRef(null)  // current EventSource

  function formatTime(d) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (nlqOpen) setTimeout(() => inputRef.current?.focus(), 350)
  }, [nlqOpen])

  useEffect(() => {
    if (!nlqOpen) setExpanded(false)
  }, [nlqOpen])

  const sendMessage = useCallback(
    (text) => {
      const query = (text ?? input).trim()
      if (!query || loading) return

      setMessages((prev) => [...prev, { role: 'user', text: query, ts: formatTime(new Date()) }])
      setInput('')

      // Input guardrail — block off-topic queries before hitting the API
      if (isOffTopic(query)) {
        setMessages((prev) => [...prev, { ...OFF_TOPIC_REPLY, ts: formatTime(new Date()) }])
        return
      }

      // Close any existing SSE connection
      if (activeSourceRef.current) {
        activeSourceRef.current.close()
        activeSourceRef.current = null
      }

      setLoading(true)
      setLiveThoughts([])

      // Sync session ID into store for HITL wiring
      useStore.getState().setNlqSessionId(sessionId.current)

      // Try SSE streaming first; fall back to blocking postNLQ if EventSource unavailable
      if (typeof EventSource !== 'undefined') {
        const source = openNLQStream(
          {
            question: query,
            session_id: sessionId.current,
            persona: useStore.getState().persona ?? 'leadership',
          },
          (event) => {
            if (event.type === 'thought_step') {
              setLiveThoughts((prev) => [...prev, event.data])
            } else if (event.type === 'final') {
              const answerText = sanitizeAnswer(event.answer)
              const thoughts = (event.thought_steps ?? []).map(
                (s) => `[${s.node}] ${s.action} — ${s.detail ?? ''}`
              )
              setMessages((prev) => [
                ...prev,
                { role: 'bot', text: answerText, thoughts, filters: [], ts: formatTime(new Date()) },
              ])
              setLiveThoughts([])
              setLoading(false)
              activeSourceRef.current = null
            } else if (event.type === 'error') {
              setMessages((prev) => [
                ...prev,
                { ...PLACEHOLDER_RESPONSE, ts: formatTime(new Date()) },
              ])
              setLiveThoughts([])
              setLoading(false)
              activeSourceRef.current = null
            } else if (event.type === 'done') {
              setLiveThoughts([])
              setLoading(false)
              activeSourceRef.current = null
            }
          }
        )
        activeSourceRef.current = source
      } else {
        // Fallback: blocking POST
        postNLQ({
          question: query,
          session_id: sessionId.current,
          persona: useStore.getState().persona ?? 'leadership',
          filters: useStore.getState().filters ?? {},
        })
          .then((res) => {
            const d = res.data
            const answerText = sanitizeAnswer(d.answer)
            const thoughts = d.thought_process
              ? d.thought_process.split('\n').filter(Boolean).map((l) => l.split(' — ').pop() ?? l)
              : []
            setMessages((prev) => [
              ...prev,
              { role: 'bot', text: answerText, thoughts, filters: [], ts: formatTime(new Date()) },
            ])
          })
          .catch(() => {
            setMessages((prev) => [
              ...prev,
              { ...PLACEHOLDER_RESPONSE, ts: formatTime(new Date()) },
            ])
          })
          .finally(() => {
            setLoading(false)
          })
      }
    },
    [input, loading]
  )

  const closePanel = () => {
    setNlqOpen(false)
    setExpanded(false)
  }

  // ── Compact panel (stage 1): floating bottom-right, NO backdrop ───────────
  const CompactPanel = (
    <motion.div
      key="compact"
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className={[
        'fixed bottom-28 right-8 z-50',
        'w-[420px]',
        'bg-[#0f0f0f] border border-[#272727]',
        'rounded-2xl flex flex-col overflow-hidden',
        'shadow-[0_24px_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]',
        className,
      ].join(' ')}
      style={{ height: 520 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#222]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#e63946]/10 border border-[#e63946]/30 flex items-center justify-center">
            <Sparkles size={14} className="text-[#e63946]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">Ask Frammer AI</p>
            <p className="text-[10px] text-[#555] mt-0.5 leading-none">Powered by Claude · Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-white hover:bg-[#1f1f1f] transition-colors"
            title="Expand for charts and full view"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={closePanel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-[#aaa] hover:bg-[#1f1f1f] transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.slice(0, 2).map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              disabled={loading}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#e63946]/40 hover:bg-[#e63946]/5 transition-colors disabled:opacity-40"
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#e63946]/10 border border-[#e63946]/25 text-[#e63946] hover:bg-[#e63946]/20 transition-colors"
          >
            <Maximize2 size={10} />
            Charts
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e63946]/15 border border-[#e63946]/25 flex items-center justify-center">
              <Bot size={13} className="text-[#e63946]" />
            </div>
            <div className="flex-1 min-w-0">
              <TypingIndicator />
              <LiveThoughtDisplay steps={liveThoughts} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        loading={loading}
        onSend={() => sendMessage()}
        inputRef={inputRef}
      />
    </motion.div>
  )

  // ── Expanded modal (stage 2): large centered, WITH backdrop ──────────────
  const ExpandedModal = (
    <>
      {/* Backdrop — only for expanded modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => setExpanded(false)}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px]"
      />

      <motion.div
        key="expanded"
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
      >
        <div
          className="relative w-full max-w-[1300px] bg-[#0d0d0d] border border-[#2a2a2a] rounded-3xl flex flex-col overflow-hidden"
          style={{
            height: 'min(90vh, 860px)',
            boxShadow: '0 32px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          {/* Modal header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#222]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#e63946]/12 border border-[#e63946]/30 flex items-center justify-center">
                <Sparkles size={17} className="text-[#e63946]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Ask Frammer AI</h2>
                <p className="text-[10px] text-[#555] uppercase tracking-wider">Full analytics view · Claude Sonnet</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#555] hover:text-white hover:bg-[#1f1f1f] transition-colors"
                title="Back to compact panel"
              >
                <Minimize2 size={12} />
                Compact
              </button>
              <button
                onClick={closePanel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#555] hover:text-[#aaa] hover:bg-[#1f1f1f] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
            <span className="text-[10px] text-[#555] uppercase tracking-wider flex-shrink-0">Try:</span>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#e63946]/40 hover:bg-[#e63946]/5 transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Body — split: chat (left) + charts (right) */}
          <div className="flex-1 flex min-h-0">
            {/* Chat column */}
            <div className="flex flex-col w-[480px] flex-shrink-0 border-r border-[#1e1e1e] min-h-0">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))}
                {loading && (
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e63946]/15 border border-[#e63946]/25 flex items-center justify-center">
                      <Bot size={13} className="text-[#e63946]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <TypingIndicator />
                      <LiveThoughtDisplay steps={liveThoughts} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              <ChatInput
                input={input}
                setInput={setInput}
                loading={loading}
                onSend={() => sendMessage()}
                inputRef={inputRef}
              />
            </div>

            {/* Charts / visual column */}
            <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#090909]">
              <ChartPreviewArea />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )

  return (
    <>
      {/* Compact panel — no backdrop so page stays interactive */}
      <AnimatePresence>
        {nlqOpen && !expanded && CompactPanel}
      </AnimatePresence>

      {/* Expanded modal — with backdrop */}
      <AnimatePresence>
        {nlqOpen && expanded && ExpandedModal}
      </AnimatePresence>
    </>
  )
}
