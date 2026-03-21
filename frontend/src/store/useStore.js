/**
 * useStore — Zustand global state store
 * Manages: auth, filters, metric toggle, agent inbox, persona, sidebar, active tab
 */

import { create } from 'zustand'

const EMPTY_FILTERS = {
  company:              [],    // string[]
  workspace:            [],    // string[]
  team:                 [],    // string[]
  language:             null,  // string | null
  input_type:           [],    // string[]
  ai_output_type:       [],    // string[]
  date_from:            null,  // string | null (ISO date)
  date_to:              null,  // string | null
}

const DEFAULT_AGENT_MESSAGES = [
  {
    id: 1,
    type: 'alert',
    severity: 'warning',
    title: 'Low PCR Alert',
    body: 'WS-SPORTS-LIVE PCR dropped to 38% - 557 videos unresolved.',
    time: '2 min ago',
    read: false,
  },
  {
    id: 2,
    type: 'insight',
    severity: 'info',
    title: 'Publish Spike Detected',
    body: 'WS-DIGITAL-NEWS published 142 videos in the last 6h - 2.3x above average.',
    time: '18 min ago',
    read: false,
  },
  {
    id: 3,
    type: 'question',
    severity: 'neutral',
    title: 'Review Request',
    body: 'content_editor_04 requested review for 12 my_key_moments drafts.',
    time: '1h ago',
    read: true,
  },
]

// Persist/restore agent messages from localStorage
const INBOX_STORAGE_KEY = 'mediaflow_agent_inbox'
function loadInbox() {
  try {
    const raw = localStorage.getItem(INBOX_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}
function saveInbox(messages) {
  try {
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(messages))
  } catch { /* ignore */ }
}

const useStore = create((set, get) => ({
  // ─── Auth ──────────────────────────────────────────────────────────────────
  isLoggedIn: false,
  user: null, // { name, email, role: 'admin'|'cxo'|'manager'|'analyst', persona }
  setUser: (user) => set({
    user,
    persona: user?.persona || 'leadership',
    isLoggedIn: !!user,
  }),
  logout: () => {
    const inbox = get().agentMessages
    set({
      isLoggedIn: false,
      user: null,
      persona: 'leadership',
      filters: { ...EMPTY_FILTERS },
      nlqOpen: false,
      nlqSessionId: 'default',
      agentInboxCount: inbox.filter((m) => !m.read).length,
      agentMessages: inbox,
      metric: 'count',
      comparePeriod: 30,
    })
  },

  // ─── Persona ──────────────────────────────────────────────────────────────
  persona: 'leadership',       // 'leadership' | 'creator'
  setPersona: (persona) => set({ persona }),

  // ─── Filters ──────────────────────────────────────────────────────────────
  filters: { ...EMPTY_FILTERS },
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),

  // ─── Metric toggle ────────────────────────────────────────────────────────
  metric: 'count',             // 'count' | 'hours'
  setMetric: (metric) => set({ metric }),

  // ─── Comparison period ────────────────────────────────────────────────────
  comparePeriod: 30,           // days: 7 | 30 | 90
  setComparePeriod: (comparePeriod) => set({ comparePeriod }),

  // ─── Active tab ───────────────────────────────────────────────────────────
  activeTab: 'executive',      // matches route ids
  setActiveTab: (activeTab) => set({ activeTab }),

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  sidebarCollapsed: false,
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  // ─── NLQ panel ────────────────────────────────────────────────────────────
  nlqOpen: false,
  setNlqOpen: (nlqOpen) => set({ nlqOpen }),

  // ─── NLQ page context (copilot) ─────────────────────────────────────────
  pageContext: null,
  setPageContext: (ctx) => set({ pageContext: ctx }),

  // ─── Agent Inbox ──────────────────────────────────────────────────────────
  agentInboxCount: 2,
  setAgentInboxCount: (agentInboxCount) => set({ agentInboxCount }),

  agentMessages: loadInbox() ?? [...DEFAULT_AGENT_MESSAGES],
  markMessageRead: (id) =>
    set((state) => {
      const updated = state.agentMessages.map((m) =>
        m.id === id ? { ...m, read: true } : m
      )
      saveInbox(updated)
      return {
        agentMessages: updated,
        agentInboxCount: updated.filter((m) => !m.read).length,
      }
    }),
  dismissMessage: (id) =>
    set((state) => {
      const next = state.agentMessages.filter((m) => m.id !== id)
      saveInbox(next)
      return {
        agentMessages: next,
        agentInboxCount: next.filter((m) => !m.read).length,
      }
    }),

  // ─── Client (multi-tenant) ────────────────────────────────────────────────
  clientId: 'CLIENT_1',
  setClientId: (clientId) => set({ clientId }),

  // ─── NLQ session (HITL wiring) ────────────────────────────────────────────
  nlqSessionId: 'default',
  setNlqSessionId: (id) => set({ nlqSessionId: id }),

  // Approve a pending HITL alert — resumes the paused graph
  approveAlert: async (msgId) => {
    const { nlqSessionId } = get()
    try {
      await fetch('/api/nlq/hitl/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: nlqSessionId, decision: 'approve' }),
      })
    } catch {
      // ignore network errors — UI still updates
    }
    get().markMessageRead(msgId)
  },

  // Reject a pending HITL alert — resumes the graph without firing
  rejectAlert: async (msgId) => {
    const { nlqSessionId } = get()
    try {
      await fetch('/api/nlq/hitl/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: nlqSessionId, decision: 'reject' }),
      })
    } catch {
      // ignore network errors
    }
    get().dismissMessage(msgId)
  },
}))

export default useStore
