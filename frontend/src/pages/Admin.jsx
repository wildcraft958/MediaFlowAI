/**
 * Admin.jsx — Tab 6: Admin Panel
 * Sub-tabs: KPI Configurator | Access Requests | Client Settings
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
  Save, Bell, Mail, Slack, CheckCircle, AlertCircle, ChevronDown,
  Code, Settings, Users, Database,
} from 'lucide-react'
import useStore from '../store/useStore'
import { getAdminKPIs, kpiChat, getAdminConfig, updateAdminConfig, deleteKPI } from '../api/client'

// ── Mock KPI Registry ──────────────────────────────────────────────────────────

const MOCK_KPIS = [
  { id: 1, acronym: 'PCR',  name: 'Publish Conversion Rate',       type: 'sql',    page: 'executive',  enabled: true,  description: 'Published / Uploaded × 100' },
  { id: 2, acronym: 'FSC',  name: 'Funnel Stage Conversion',       type: 'sql',    page: 'publish',    enabled: true,  description: 'Stage-to-stage funnel rates' },
  { id: 3, acronym: 'GR',   name: 'MoM / WoW Growth Rate',         type: 'sql',    page: 'executive',  enabled: true,  description: 'WoW / MoM upload growth' },
  { id: 4, acronym: 'TEU',  name: 'Time Efficiency of User',       type: 'sql',    page: 'team',       enabled: true,  description: 'Average gap (hours) between consecutive uploads per user' },
  { id: 6, acronym: 'AIL',  name: 'AI Output Leverage',            type: 'sql',    page: 'executive',  enabled: true,  description: 'Impressions generated per source hour, by AI output type' },
  { id: 7, acronym: 'SAC',  name: 'Subscriber Attention Cost',     type: 'sql',    page: 'publish',    enabled: true,  description: 'Watch minutes required to gain one subscriber, by input type' },
  { id: 8, acronym: 'AHY',  name: 'Attention Harvest Yield',       type: 'sql',    page: 'publish',    enabled: true,  description: 'Watch hours generated per source second, by AI output type' },
  { id: 9, acronym: 'EDR',  name: 'Engagement Depth Rate',         type: 'sql',    page: 'publish',    enabled: true,  description: '% of impressions that resulted in active engagement (likes+comments+shares)' },
  { id: 10, acronym: 'HTHR', name: 'Hook-to-Hold Resonance Score', type: 'sql',    page: 'publish',    enabled: true,  description: 'CTR × retention × log(impressions) — titles that hook AND hold' },
  { id: 11, acronym: 'TSQI', name: 'Traffic Source Quality Index',  type: 'sql',    page: 'trends',     enabled: true,  description: 'Which traffic sources drive highest watch time and subscriber gain' },
  { id: 12, acronym: 'PIG',  name: 'Platform Impression Gap',      type: 'sql',    page: 'trends',     enabled: true,  description: 'Average impressions, CTR, and retention by distribution platform' },
  { id: 13, acronym: 'AGV',  name: 'Audience Growth Velocity',     type: 'sql',    page: 'executive',  enabled: true,  description: 'Subscriber growth rate' },
  { id: 14, acronym: 'CRM',  name: 'Content-to-Reach Multiplier',  type: 'sql',    page: 'executive',  enabled: true,  description: 'Impressions per hour of raw source content — AI leverage ROI' },
  { id: 15, acronym: 'PMI',  name: 'Performance Momentum Index',   type: 'sql',    page: 'executive',  enabled: true,  description: 'WoW impression growth rate per workspace' },
  { id: 15, acronym: 'MCI',  name: 'Metadata Completeness Index',  type: 'sql',    page: 'executive',  enabled: true,  description: '% of published videos with complete metadata fields per workspace' },
  { id: 16, acronym: 'DCDR', name: 'Duplicate Detection Rate',     type: 'sql',    page: 'executive',  enabled: true,  description: '% of records that appear to be same-day duplicate headline submissions' },
  { id: 17, acronym: 'CPDG', name: 'Content Promise vs Delivery Gap', type: 'python', page: 'publish', enabled: true,  description: 'Clickbait score: high CTR vs low watch % = promise gap' },
  { id: 18, acronym: 'ZSP',  name: 'Z-Score Performance',         type: 'python', page: 'explorer',   enabled: true,  description: 'Per-video performance z-score' },
  { id: 19, acronym: 'LPI',  name: 'Language Performance Index',   type: 'python', page: 'team',       enabled: true,  description: 'Language-level PCR deviation' },
]

const MOCK_ACCESS_REQUESTS = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@company-a.com',
    role: 'Analytics Viewer',
    date: '2025-11-14',
    status: 'pending',
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane.smith@company-b.com',
    role: 'Content Creator',
    date: '2025-11-13',
    status: 'pending',
  },
]

const MOCK_USERS_LIST = [
  { id: 1, name: 'content_editor_01', email: 'editor01@company-b.com',   role: 'Creator',    lastActive: '2025-11-15', status: 'active' },
  { id: 2, name: 'content_editor_02', email: 'editor02@company-a.com',   role: 'Creator',    lastActive: '2025-11-14', status: 'active' },
  { id: 3, name: 'content_editor_03', email: 'editor03@company-a.com',   role: 'Creator',    lastActive: '2025-11-13', status: 'active' },
  { id: 4, name: 'content_editor_04', email: 'editor04@company-a.com',   role: 'Creator',    lastActive: '2025-11-10', status: 'idle'   },
]

const MOCK_CONFIG = {
  opi_threshold_hours: 48,
  agv_drop_pct: 15,
  zscore_anomaly_level: 2.5,
  pcr_minimum_pct: 50,
  alert_email: 'ops@mediaflow.ai',
  slack_webhook: 'https://hooks.slack.com/services/...',
  enabled_kpis: MOCK_KPIS.map((k) => k.acronym),
}

// ── KPI Configurator ───────────────────────────────────────────────────────────

function ChatBubble({ msg, onAddKpi }) {
  const isBot = msg.role === 'bot'
  const [showDetails, setShowDetails] = useState(false)

  // Extract KPI name/acronym from yaml for a friendly summary card
  const kpiAcronym = msg.yaml ? (msg.yaml.match(/acronym:\s*(\S+)/)?.[1] || '') : null
  const kpiName    = msg.yaml ? (msg.yaml.match(/name:\s*(.+)/)?.[1]?.trim() || 'Custom KPI') : null
  const kpiDesc    = msg.yaml ? (msg.yaml.match(/description:\s*(.+)/)?.[1]?.trim() || '') : null

  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isBot ? 'bg-[#e63946]/20' : 'bg-[#1f1f1f]'
        }`}
      >
        {isBot ? (
          <Bot size={14} className="text-[#e63946]" />
        ) : (
          <User size={14} className="text-[#a0a0a0]" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
          isBot
            ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#a0a0a0] rounded-tl-sm'
            : 'bg-[#e63946]/15 border border-[#e63946]/30 text-white rounded-tr-sm'
        }`}
      >
        {msg.yaml ? (
          <div>
            <p className="text-[#a0a0a0] mb-3 whitespace-pre-wrap">{msg.text}</p>
            {/* Friendly summary card — no raw code */}
            <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                {kpiAcronym && (
                  <span className="text-[10px] font-bold text-[#e63946] border border-[#e63946]/30 bg-[#e63946]/10 px-2 py-0.5 rounded-md font-mono">
                    {kpiAcronym}
                  </span>
                )}
                <span className="text-xs font-semibold text-white">{kpiName}</span>
              </div>
              {kpiDesc && <p className="text-[11px] text-[#555]">{kpiDesc}</p>}
              <p className="text-[10px] text-[#4caf50] mt-1.5">
                Ready to add · will appear on the dashboard once activated
              </p>
            </div>
            {/* Collapsible technical details — for power users only */}
            <button
              onClick={() => setShowDetails((p) => !p)}
              className="text-[10px] text-[#444] hover:text-[#a0a0a0] transition-colors flex items-center gap-1 mb-1"
            >
              <span>{showDetails ? '▾' : '▸'}</span>
              {showDetails ? 'Hide' : 'Show'} technical config
            </button>
            {showDetails && (
              <pre className="font-mono text-[#4caf50] text-[10px] bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap mb-2">
                {msg.yaml}
              </pre>
            )}
            {msg.showAddButton && (
              <button
                onClick={() => onAddKpi?.(msg.yaml)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e63946] text-white text-[11px] font-semibold rounded-lg hover:bg-[#c62828] transition-colors"
              >
                <Plus size={11} />
                Add to Registry
              </button>
            )}
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{msg.text}</span>
        )}
      </div>
    </div>
  )
}

const INITIAL_MESSAGES = [
  {
    id: 0,
    role: 'bot',
    text: "Hi! I'm your KPI setup assistant. Tell me about a metric you'd like to track and I'll configure it for you.\n\nFor example:\n• \"Track videos published within 24 hours of processing\"\n• \"Show the ratio of Hindi vs English content per workspace\"\n• \"Alert when Sports Live workspace drops below 40% publish rate\"",
  },
]


function KPIChat() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    const userMsg = { id: Date.now(), role: 'user', text }
    setMessages((m) => [...m, userMsg])

    setTyping(true)

    try {
      const res = await kpiChat({ message: text, history: messages.map((m) => ({ role: m.role, content: m.text })) })
      const data = res.data || res
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: data.explanation || "I've prepared a KPI configuration based on your description. Click \"Add to Registry\" to activate it.",
          yaml: data.yaml,
          showAddButton: !!data.yaml,
        },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: 'bot',
          text: "Sorry, I couldn't connect. Please try again.",
        },
      ])
    } finally {
      setTyping(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 460 }}>
      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 pb-2">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} onAddKpi={() => {}} />
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[#e63946]/20">
              <Bot size={14} className="text-[#e63946]" />
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — always anchored to bottom */}
      <div className="flex-shrink-0 flex gap-2 pt-3 border-t border-[#1f1f1f]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a KPI you want to track…"
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white placeholder-[#555] rounded-xl px-4 py-3 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || typing}
          className="w-11 h-11 rounded-xl bg-[#e63946] text-white flex items-center justify-center hover:bg-[#c62828] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}

function KPIRegistryList({ kpis, onDelete, onToggle, onEdit }) {
  const typeColor = { sql: '#2196f3', python: '#ff9800' }
  const pageColor = {
    executive: '#e63946', publish: '#ff8fa3', trends: '#4caf50',
    team: '#2196f3', explorer: '#ff9800',
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
            kpi.enabled
              ? 'bg-[#0d0d0d] border-[#1f1f1f]'
              : 'bg-[#0a0a0a] border-[#1a1a1a] opacity-50'
          }`}
        >
          {/* Acronym badge */}
          <span className="text-xs font-bold text-[#e63946] border border-[#e63946]/30 bg-[#e63946]/10 px-2 py-0.5 rounded-md font-mono min-w-[44px] text-center">
            {kpi.acronym}
          </span>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{kpi.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: `${typeColor[kpi.type] || '#333'}20`, color: typeColor[kpi.type] || '#a0a0a0' }}
              >
                {kpi.type}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: `${pageColor[kpi.page] || '#333'}20`, color: pageColor[kpi.page] || '#a0a0a0' }}
              >
                {kpi.page}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onToggle(kpi.id)}
              className="text-[#555] hover:text-[#a0a0a0] transition-colors"
              title={kpi.enabled ? 'Disable' : 'Enable'}
            >
              {kpi.enabled ? (
                <ToggleRight size={18} className="text-[#4caf50]" />
              ) : (
                <ToggleLeft size={18} />
              )}
            </button>
            <button
              onClick={() => onEdit?.(kpi)}
              className="text-[#555] hover:text-[#a0a0a0] transition-colors"
              title="Edit KPI"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => onDelete(kpi.id)}
              className="text-[#555] hover:text-[#e63946] transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function KPIEditModal({ kpi, onSave, onClose }) {
  const [name, setName] = useState(kpi.name)
  const [description, setDescription] = useState(kpi.description)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-4">Edit KPI: {kpi.acronym}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#555] mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50" />
          </div>
          <div>
            <label className="block text-xs text-[#555] mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[#555] hover:text-[#a0a0a0] rounded-lg border border-[#1f1f1f]">Cancel</button>
          <button onClick={() => onSave({ ...kpi, name, description })}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#e63946] rounded-lg hover:bg-[#c62828] inline-flex items-center gap-1">
            <Save size={11} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}

function KPIConfigurator() {
  const [kpis, setKpis] = useState(MOCK_KPIS)
  const [registryLoading, setRegistryLoading] = useState(false)
  const [editingKpi, setEditingKpi] = useState(null)

  useEffect(() => {
    setRegistryLoading(true)
    getAdminKPIs()
      .then((res) => {
        const data = res.data || res
        if (Array.isArray(data) && data.length > 0) setKpis(data)
        setRegistryLoading(false)
      })
      .catch(() => setRegistryLoading(false))
  }, [])

  const handleDelete = (id) => {
    if (!window.confirm('Delete this KPI?')) return
    deleteKPI(kpis.find((k) => k.id === id)?.acronym).catch(() => { console.warn('Failed to delete KPI') })
    setKpis((prev) => prev.filter((k) => k.id !== id))
  }

  const handleToggle = (id) => {
    setKpis((prev) => prev.map((k) => k.id === id ? { ...k, enabled: !k.enabled } : k))
  }

  const handleEdit = (kpi) => setEditingKpi(kpi)

  const handleSaveEdit = (updated) => {
    setKpis((prev) => prev.map((k) => k.id === updated.id ? updated : k))
    setEditingKpi(null)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chat */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-[#e63946]/15 flex items-center justify-center">
            <Bot size={14} className="text-[#e63946]" />
          </div>
          <h3 className="text-sm font-semibold text-white">AI KPI Chatbot</h3>
          <span className="ml-auto text-[10px] text-[#4caf50] border border-[#4caf50]/30 bg-[#4caf50]/10 px-2 py-0.5 rounded-full">
            ONLINE
          </span>
        </div>
        <KPIChat />
      </div>

      {/* Registry */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-[#a0a0a0]" />
            <h3 className="text-sm font-semibold text-white">
              KPI Registry
              <span className="ml-2 text-xs font-normal text-[#555]">
                ({kpis.filter((k) => k.enabled).length} active)
              </span>
            </h3>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#e63946]/15 text-[#e63946] border border-[#e63946]/30 hover:bg-[#e63946]/25 transition-colors">
            <Plus size={11} />
            Add Custom KPI
          </button>
        </div>

        {registryLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-[#1f1f1f] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <KPIRegistryList kpis={kpis} onDelete={handleDelete} onToggle={handleToggle} onEdit={handleEdit} />
        )}
        {editingKpi && <KPIEditModal kpi={editingKpi} onSave={handleSaveEdit} onClose={() => setEditingKpi(null)} />}
      </div>
    </div>
  )
}

// ── Access Requests ────────────────────────────────────────────────────────────

function AccessRequests() {
  const [requests, setRequests] = useState(MOCK_ACCESS_REQUESTS)

  const handleApprove = (id) =>
    setRequests((p) => p.map((r) => r.id === id ? { ...r, status: 'approved' } : r))

  const handleDeny = (id) =>
    setRequests((p) => p.map((r) => r.id === id ? { ...r, status: 'denied' } : r))

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Pending */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-white">Pending Requests</h3>
          {pending.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#ff9800] text-[10px] font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle size={28} className="text-[#4caf50] mb-2" />
            <p className="text-sm text-[#555]">No pending requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f]">
                  {['Name', 'Email', 'Requested Role', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-[#555] text-xs font-semibold pb-3 pr-4 last:pr-0 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((req) => (
                  <tr key={req.id} className="border-b border-[#1f1f1f]/60 last:border-0 hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 pr-4 text-white font-medium text-xs">{req.name}</td>
                    <td className="py-3 pr-4 text-[#a0a0a0] text-xs font-mono">{req.email}</td>
                    <td className="py-3 pr-4">
                      <span className="text-xs bg-[#2196f3]/15 text-[#2196f3] border border-[#2196f3]/30 px-2 py-0.5 rounded-md">
                        {req.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#555] text-xs">{req.date}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#4caf50]/15 text-[#4caf50] border border-[#4caf50]/30 hover:bg-[#4caf50]/25 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(req.id)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#e63946]/15 text-[#e63946] border border-[#e63946]/30 hover:bg-[#e63946]/25 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current users */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Current Users</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                {['User', 'Email', 'Role', 'Last Active', 'Status'].map((h) => (
                  <th key={h} className="text-left text-[#555] text-xs font-semibold pb-3 pr-4 last:pr-0 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS_LIST.map((u) => (
                <tr key={u.id} className="border-b border-[#1f1f1f]/60 last:border-0 hover:bg-[#1a1a1a] transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-[#ff8fa3]">{u.name}</td>
                  <td className="py-3 pr-4 text-[#a0a0a0] text-xs">{u.email}</td>
                  <td className="py-3 pr-4 text-xs">
                    <span className="bg-[#e63946]/10 text-[#e63946] border border-[#e63946]/30 px-2 py-0.5 rounded-md">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[#555] text-xs">{u.lastActive}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                        u.status === 'active'
                          ? 'bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/30'
                          : 'bg-[#ff9800]/15 text-[#ff9800] border-[#ff9800]/30'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Client Settings ────────────────────────────────────────────────────────────

function ClientSettings() {
  const [config, setConfig] = useState(MOCK_CONFIG)
  const [enabledKpis, setEnabledKpis] = useState(new Set(MOCK_CONFIG.enabled_kpis))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const clientId = useStore((s) => s.clientId)

  useEffect(() => {
    getAdminConfig()
      .then((res) => {
        const data = res.data || res
        if (data && typeof data === 'object') {
          setConfig({ ...MOCK_CONFIG, ...data })
          if (data.enabled_kpis) setEnabledKpis(new Set(data.enabled_kpis))
        }
      })
      .catch(() => { console.warn('Failed to load admin config') })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAdminConfig({ ...config, enabled_kpis: Array.from(enabledKpis) })
    } catch {}
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleKpi = (acronym) => {
    setEnabledKpis((prev) => {
      const next = new Set(prev)
      if (next.has(acronym)) next.delete(acronym)
      else next.add(acronym)
      return next
    })
  }

  const NumberInput = ({ label, field, suffix = '' }) => (
    <div>
      <label className="block text-xs text-[#555] font-medium mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center">
        <input
          type="number"
          value={config[field]}
          onChange={(e) =>
            setConfig((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))
          }
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors tabular-nums"
        />
        {suffix && (
          <span className="ml-2 text-xs text-[#555] whitespace-nowrap">{suffix}</span>
        )}
      </div>
    </div>
  )

  const TextInput = ({ label, field, placeholder = '' }) => (
    <div>
      <label className="block text-xs text-[#555] font-medium mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <input
        type="text"
        value={config[field] || ''}
        onChange={(e) => setConfig((p) => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors"
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Config Form */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={14} className="text-[#a0a0a0]" />
          <h3 className="text-sm font-semibold text-white">
            {clientId} Configuration
          </h3>
          <span className="ml-auto text-xs text-[#555] font-mono border border-[#1f1f1f] px-2 py-0.5 rounded-md">
            {clientId}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <NumberInput label="OPI Threshold" field="opi_threshold_hours" suffix="hours" />
          <NumberInput label="AGV Drop %" field="agv_drop_pct" suffix="%" />
          <NumberInput label="ZScore Anomaly Level" field="zscore_anomaly_level" suffix="σ" />
          <NumberInput label="PCR Minimum %" field="pcr_minimum_pct" suffix="%" />
        </div>
      </div>

      {/* Enabled KPIs */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">
            Enabled KPIs
            <span className="ml-2 text-xs font-normal text-[#555]">
              ({enabledKpis.size} / {MOCK_KPIS.length})
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setEnabledKpis(new Set(MOCK_KPIS.map((k) => k.acronym)))}
              className="text-xs text-[#a0a0a0] hover:text-white transition-colors"
            >
              Enable all
            </button>
            <span className="text-[#333]">·</span>
            <button
              onClick={() => setEnabledKpis(new Set())}
              className="text-xs text-[#a0a0a0] hover:text-white transition-colors"
            >
              Disable all
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {MOCK_KPIS.map((kpi) => {
            const isEnabled = enabledKpis.has(kpi.acronym)
            return (
              <button
                key={kpi.acronym}
                onClick={() => toggleKpi(kpi.acronym)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                  isEnabled
                    ? 'bg-[#e63946]/08 border-[#e63946]/25 hover:bg-[#e63946]/12'
                    : 'bg-[#0d0d0d] border-[#1a1a1a] opacity-50 hover:opacity-75'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isEnabled
                      ? 'bg-[#e63946] border-[#e63946]'
                      : 'border-[#333] bg-transparent'
                  }`}
                >
                  {isEnabled && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#e63946] font-mono">{kpi.acronym}</span>
                  </div>
                  <p className="text-[10px] text-[#555] truncate">{kpi.name}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Alert Channels */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={14} className="text-[#a0a0a0]" />
          <h3 className="text-sm font-semibold text-white">Alert Channels</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2196f3]/15 flex items-center justify-center flex-shrink-0">
              <Mail size={13} className="text-[#2196f3]" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#555] mb-1 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={config.alert_email || ''}
                onChange={(e) => setConfig((p) => ({ ...p, alert_email: e.target.value }))}
                placeholder="ops@mediaflow.ai"
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#4caf50]/15 flex items-center justify-center flex-shrink-0">
              <Slack size={13} className="text-[#4caf50]" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#555] mb-1 uppercase tracking-wide">Slack Webhook URL</label>
              <input
                type="text"
                value={config.slack_webhook || ''}
                onChange={(e) => setConfig((p) => ({ ...p, slack_webhook: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 bg-[#e63946] text-white hover:bg-[#c62828] disabled:opacity-60"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <CheckCircle size={16} />
            Configuration Saved
          </>
        ) : (
          <>
            <Save size={16} />
            Save Changes
          </>
        )}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'kpi', label: 'KPI Configurator', icon: Code },
  { id: 'access', label: 'Access Requests', icon: Users },
  { id: 'settings', label: 'Client Settings', icon: Settings },
]

export default function Admin() {
  const [activeSubTab, setActiveSubTab] = useState('kpi')

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
        <p className="text-sm text-[#a0a0a0]">
          KPI registry, user management, and client configuration
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 p-1 bg-[#111111] border border-[#1f1f1f] rounded-2xl w-fit">
        {SUB_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id)}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none',
              activeSubTab === id
                ? 'bg-[#e63946] text-white shadow-[0_0_12px_rgba(230,57,70,0.3)]'
                : 'text-[#555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]',
            ].join(' ')}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'kpi' && <KPIConfigurator />}
          {activeSubTab === 'access' && <AccessRequests />}
          {activeSubTab === 'settings' && <ClientSettings />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
