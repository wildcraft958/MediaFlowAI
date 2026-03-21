/**
 * ExecutiveSummary.jsx — Tab 1: Leadership overview
 * 4 KPI cards · TrendChart · InsightsPanel · FunnelViz · Workspace PCR · AgentInbox · AlertBanner
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Cpu, CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  Clock, Activity, X, Bell, Zap, ChevronRight, Users, BarChart2,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import KPICard from '../components/charts/KPICard'
import FunnelViz from '../components/charts/FunnelViz'
import FilterBar from '../components/common/FilterBar'
import RoleGate from '../components/common/RoleGate'
import useStore from '../store/useStore'
import { getExecutiveSummary, getPublishFunnel, getPeriodComparison, getDataQuality, getBillableSplit } from '../api/client'
import { humanize, stripWs } from '../utils/format'
import DraggableChart from '../components/common/DraggableChart'

// ── Mock data ─────────────────────────────────────────────────────────────────

const generateTrendData = () => {
  const out = []
  const base = new Date('2025-10-15')
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const uploaded = 120 + Math.floor(Math.sin(i / 3.5) * 28 + Math.random() * 30)
    const published = Math.floor(uploaded * (0.58 + Math.random() * 0.32))
    out.push({
      date: d.toISOString().slice(0, 10),
      uploaded,
      published,
      uploaded_hours: +(uploaded * 0.45 + Math.random() * 12).toFixed(1),
      published_hours: +(published * 0.45 + Math.random() * 8).toFixed(1),
    })
  }
  return out
}

const MOCK_TREND = generateTrendData()

const MOCK_FUNNEL = [
  { name: 'Uploaded', icon: 'upload', count: 4179, hours: 8928, pct: 100 },
  { name: 'Processed', icon: 'process', count: 4179, pct: 100 },
  { name: 'Published', icon: 'publish', count: 3188, pct: 76.3 },
]

const WORKSPACES = [
  { name: 'WS-DIGITAL-NEWS',    pcr: 92, total: 1200, published: 1106 },
  { name: 'WS-ENTERTAINMENT',   pcr: 82, total: 884,  published: 725  },
  { name: 'WS-TECH-ANALYSIS',   pcr: 68, total: 1191, published: 810  },
  { name: 'WS-LIFESTYLE',       pcr: 52, total: 396,  published: 206  },
  { name: 'WS-SPORTS-LIVE',     pcr: 38, total: 898,  published: 341  },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function InsightsPanel() {
  const insights = [
    {
      id: 1,
      type: 'warning',
      icon: AlertTriangle,
      title: 'Sports-Live bottleneck',
      body: 'WS-SPORTS-LIVE publishes only 38% - 556 orphaned videos with no publish date.',
      color: '#ff9800',
    },
    {
      id: 2,
      type: 'success',
      icon: TrendingUp,
      title: 'Top performer identified',
      body: 'WS-DIGITAL-NEWS leads at 92% PCR - consistent high-throughput operation.',
      color: '#4caf50',
    },
    {
      id: 3,
      type: 'warning',
      icon: AlertTriangle,
      title: 'Data quality gap',
      body: '390 videos (8.5%) are missing upload_date - impacts MCI and OPI calculations.',
      color: '#ff9800',
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      {insights.map((ins, i) => {
        const Icon = ins.icon
        return (
          <motion.div
            key={ins.id}
            className="flex items-start gap-3 p-4 rounded-xl border"
            style={{ background: `${ins.color}08`, borderColor: `${ins.color}30` }}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.35 }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${ins.color}20` }}
            >
              <Icon size={14} style={{ color: ins.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white mb-0.5">{ins.title}</p>
              <p className="text-xs text-[#a0a0a0] leading-relaxed">{ins.body}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function TrendMiniChart({ data, metric }) {
  const safeData = data || []
  const dates = safeData.map((d) => {
    const dt = new Date(d.date)
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
  const uploaded = safeData.map((d) => metric === 'hours' ? (d.uploaded_hours ?? 0) : (d.uploaded ?? 0))
  const published = safeData.map((d) => metric === 'hours' ? (d.published_hours ?? 0) : (d.published ?? 0))

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 900,
    legend: {
      show: true,
      right: 8,
      top: 4,
      itemWidth: 12,
      itemHeight: 2,
      textStyle: { color: '#a0a0a0', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
      formatter(params) {
        const date = params[0]?.axisValue || ''
        let html = `<div style="color:#a0a0a0;font-weight:600;margin-bottom:3px">${date}</div>`
        params.forEach((p) => {
          html += `<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:5px"></span>${p.seriesName}: <b>${p.value?.toLocaleString()}</b></div>`
        })
        return html
      },
    },
    grid: { left: 44, right: 16, bottom: 36, top: 36 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#1f1f1f' } },
      axisTick: { show: false },
      axisLabel: { color: '#555', fontSize: 10, interval: 5 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
      axisLabel: { color: '#555', fontSize: 10 },
    },
    series: [
      {
        name: 'Uploaded',
        type: 'line',
        data: uploaded,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#555555', width: 1.5, type: 'dashed' },
        z: 2,
      },
      {
        name: 'Published',
        type: 'line',
        data: published,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#e63946', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(230,57,70,0.35)' },
              { offset: 1, color: 'rgba(230,57,70,0)' },
            ],
          },
        },
        z: 3,
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 240, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function WorkspacePCRBar({ name, pcr: _pcr, published: _published, total: _total, delay }) {
  const pcr = _pcr ?? 0
  const published = _published ?? 0
  const total = _total ?? 0
  const color = pcr >= 80 ? '#4caf50' : pcr >= 60 ? '#ff9800' : '#e63946'
  const shortName = stripWs(name)
  return (
    <motion.div
      className="mb-3 last:mb-0"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-[#a0a0a0] truncate max-w-[140px]">{shortName}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-[#555] tabular-nums">
            {published.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span className="text-sm font-bold tabular-nums w-10 text-right" style={{ color }}>
            {pcr}%
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pcr}%` }}
          transition={{ delay: delay + 0.1, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

function AgentInboxWidget() {
  const { agentMessages, markMessageRead, dismissMessage } = useStore()
  const unread = agentMessages.filter((m) => !m.read).length

  const severityColor = {
    warning: '#ff9800',
    info: '#2196f3',
    neutral: '#a0a0a0',
    danger: '#e63946',
    success: '#4caf50',
  }
  const severityIcon = {
    warning: AlertTriangle,
    info: Activity,
    neutral: Bell,
    danger: AlertTriangle,
    success: TrendingUp,
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-[#a0a0a0]" />
          <span className="text-sm font-semibold text-white">Agent Inbox</span>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#e63946] text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>
        <button className="text-xs text-[#555] hover:text-[#a0a0a0] transition-colors">
          View all
        </button>
      </div>

      <div className="space-y-2">
        {agentMessages.map((msg) => {
          const color = severityColor[msg.severity] || '#a0a0a0'
          const Icon = severityIcon[msg.severity] || Bell
          return (
            <div
              key={msg.id}
              onClick={() => markMessageRead(msg.id)}
              className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 hover:border-[#333] ${
                msg.read ? 'opacity-60' : ''
              }`}
              style={{
                background: msg.read ? '#0d0d0d' : `${color}08`,
                borderColor: msg.read ? '#1f1f1f' : `${color}30`,
              }}
            >
              {!msg.read && (
                <div
                  className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: color }}
                />
              )}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold text-white">{msg.title}</p>
                </div>
                <p className="text-xs text-[#a0a0a0] leading-relaxed line-clamp-2">{msg.body}</p>
                <p className="text-[10px] text-[#555] mt-1">{msg.time}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissMessage(msg.id) }}
                className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-[#333] hover:text-[#a0a0a0] transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          )
        })}
        {agentMessages.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Bell size={24} className="text-[#333] mb-2" />
            <p className="text-xs text-[#555]">No pending messages</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AlertBanner({ onDismiss, navigate }) {
  return (
    <motion.div
      className="flex items-start gap-3 p-4 rounded-2xl border border-[#ff9800]/30 bg-[#ff9800]/08"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      <div className="w-8 h-8 rounded-xl bg-[#ff9800]/20 flex items-center justify-center flex-shrink-0">
        <AlertTriangle size={15} className="text-[#ff9800]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          PCR threshold breached - WS-SPORTS-LIVE
        </p>
        <p className="text-xs text-[#a0a0a0] mt-0.5">
          Current PCR 38% is below the 50% minimum threshold configured in CLIENT_1 settings.
          556 videos remain unpublished.
          <button
            className="ml-2 text-[#ff9800] hover:underline inline-flex items-center gap-1"
            onClick={() => navigate('/explorer?workspace=WS-SPORTS-LIVE')}
          >
            Investigate <ChevronRight size={11} />
          </button>
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[#555] hover:text-[#a0a0a0] transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

// ── Data Quality Bars ──────────────────────────────────────────────────────────

function DataQualityBars({ fields, health, loading }) {
  if (loading) return <div className="h-40 animate-pulse bg-[#1a1a1a] rounded-xl" />
  if (!fields || !fields.length) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[#a0a0a0]">Overall Data Health</span>
        <span className={`text-lg font-bold ${(health ?? 0) >= 80 ? 'text-[#4caf50]' : (health ?? 0) >= 60 ? 'text-[#ff9800]' : 'text-[#e63946]'}`}>
          {health ?? 0}%
        </span>
      </div>
      {fields.map((f) => (
        <div key={f.field} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#a0a0a0]">{humanize(f.field)}</span>
            <span className="text-[#555]">{(f.filled ?? 0).toLocaleString()} / {((f.filled ?? 0) + (f.null ?? 0)).toLocaleString()} ({f.pct ?? 0}%)</span>
          </div>
          <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${f.pct ?? 0}%`,
              backgroundColor: (f.pct ?? 0) >= 90 ? '#4caf50' : (f.pct ?? 0) >= 60 ? '#ff9800' : '#e63946',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Billable Analytics Panel ───────────────────────────────────────────────────

function BillablePanel({ billable, loading }) {
  if (loading) return <div className="h-36 animate-pulse bg-[#1a1a1a] rounded-xl" />
  if (!billable) return null
  const { total = 0, billable: b = 0, non_billable: nb = 0, billable_pct = 0, billable_hours = 0, non_billable_hours = 0, by_workspace = [] } = billable
  return (
    <div className="space-y-4">
      {/* Headline row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Billable Videos', value: (b ?? 0).toLocaleString(), pct: `${billable_pct ?? 0}%`, color: '#4caf50' },
          { label: 'Non-Billable', value: (nb ?? 0).toLocaleString(), pct: `${(100 - (billable_pct ?? 0)).toFixed(1)}%`, color: '#e63946' },
          { label: 'Billable Hours', value: `${(billable_hours ?? 0).toLocaleString()}h`, pct: `vs ${(non_billable_hours ?? 0).toLocaleString()}h non-bill.`, color: '#ff9800' },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-[#555] mt-0.5">{s.pct}</p>
          </div>
        ))}
      </div>
      {/* Billable % by workspace */}
      <div className="space-y-2">
        {by_workspace.map((ws) => (
          <div key={ws.workspace} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#a0a0a0]">{stripWs(ws.workspace)}</span>
              <span className="tabular-nums text-[#555]">{(ws.billable ?? 0).toLocaleString()} / {(ws.total ?? 0).toLocaleString()} · {ws.billable_pct ?? 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${ws.billable_pct ?? 0}%`,
                  backgroundColor: (ws.billable_pct ?? 0) >= 80 ? '#4caf50' : (ws.billable_pct ?? 0) >= 60 ? '#ff9800' : '#e63946',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExecutiveSummary() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alertVisible, setAlertVisible] = useState(true)
  const [error, setError] = useState(null)
  const filters = useStore((s) => s.filters)
  const metric = useStore((s) => s.metric)
  const comparePeriod = useStore((s) => s.comparePeriod)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getExecutiveSummary(filters),
      getPublishFunnel(filters),
      getPeriodComparison({ period_days: comparePeriod, ...filters }),
      getDataQuality(filters),
      getBillableSplit(filters),
    ])
      .then(([summary, funnel, comparison, quality, billable]) => {
        setData({
          summary: summary.data,
          funnel: funnel.data,
          comparison: comparison.data,
          quality: quality.data,
          billable: billable.data,
        })
        setLoading(false)
      })
      .catch((err) => {
        console.error('[ExecutiveSummary] Data fetch failed:', err.message)
        setData({ summary: null, funnel: MOCK_FUNNEL, comparison: null, quality: null, billable: null })
        setError(`Failed to load data: ${err.message}`)
        setLoading(false)
      })
  }, [filters, comparePeriod])

  const trendData = data?.summary?.trend || MOCK_TREND
  const funnelData = data?.funnel || MOCK_FUNNEL

  const workspaces = data?.summary?.workspace_pcr?.map((ws) => ({
    name: ws.workspace, pcr: ws.pcr, total: ws.total, published: ws.published,
  })) ?? WORKSPACES

  const d = data?.comparison?.delta
  const kpiCards = [
    {
      title: 'Total Uploaded',
      value: data?.summary?.funnel?.uploaded ?? 4179,
      unit: '',
      trend: (d?.uploaded_pct ?? 0) >= 0 ? 'up' : 'down',
      trendValue: d?.uploaded_pct != null ? Math.abs(d.uploaded_pct) : null,
      trendLabel: 'vs prev 30d',
      icon: Upload,
      subtitle: '91.5% data completeness',
      tooltip: 'Total videos with a valid upload_date across all workspaces',
      loading,
    },
    {
      title: 'Published',
      value: data?.summary?.funnel?.published ?? 3188,
      unit: '',
      trend: (d?.published_pct ?? 0) >= 0 ? 'up' : 'down',
      trendValue: d?.published_pct != null ? Math.abs(d.published_pct) : null,
      trendLabel: 'vs prev 30d',
      icon: CheckCircle,
      subtitle: 'YouTube Shorts + Instagram Reels',
      tooltip: 'Videos successfully published to YouTube Shorts or Instagram Reels',
      loading,
    },
    {
      title: 'Overall PCR',
      value: data?.summary?.pcr_total ?? 69.8,
      unit: '%',
      trend: (d?.pcr_pct ?? 0) >= 0 ? 'up' : 'down',
      trendValue: d?.pcr_pct != null ? Math.abs(d.pcr_pct) : null,
      trendLabel: 'vs prev 30d',
      icon: BarChart2,
      accent: true,
      subtitle: 'Ranges 38%-92% by workspace',
      tooltip: 'Publish Conversion Rate: Published / Total Uploaded x 100. Higher = efficient pipeline, low = bottlenecks.',
      loading,
    },
    {
      title: 'Avg Processing',
      value: data?.comparison?.current?.avg_processing_h ?? 4.2,
      unit: 'h',
      trend: (d?.avg_processing_pct ?? 0) <= 0 ? 'down' : 'up',
      trendValue: d?.avg_processing_pct != null ? Math.abs(d.avg_processing_pct) : null,
      trendLabel: 'vs prev 30d',
      icon: Clock,
      subtitle: 'Upload to MediaFlow AI processed',
      tooltip: 'Average hours from upload_date to processed_date across all videos',
      loading,
    },
  ]

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Alert Banner */}
      <AnimatePresence>
        {alertVisible && (
          <AlertBanner onDismiss={() => setAlertVisible(false)} navigate={navigate} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Executive Summary</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e63946]/15 text-[#e63946] border border-[#e63946]/30">
              <Users size={11} />
              Leadership View
            </span>
          </div>
          <p className="text-sm text-[#a0a0a0]">
            MediaFlow AI media operations - 4,569 total videos across 5 workspaces
          </p>
        </div>
      </div>

      {/* FilterBar */}
      <FilterBar />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-[#e63946]/30 bg-[#e63946]/10 text-xs text-[#e63946]">
          <AlertTriangle size={13} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-[#e63946]/60 hover:text-[#e63946]"><X size={13}/></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
          >
            <KPICard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Trend + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div
          className="lg:col-span-3 bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Daily Upload vs Publish</h2>
            <span className="text-xs text-[#555]">Last 30 days</span>
          </div>
          <TrendMiniChart data={trendData} metric={metric} />
        </motion.div>

        <motion.div
          className="lg:col-span-2 bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.35 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">AI Insights</h2>
          <InsightsPanel />
        </motion.div>
      </div>

      {/* Funnel */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.35 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">3-Stage Publish Funnel</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#555] border border-[#1f1f1f] rounded-full px-2.5 py-1">
            Upload → Process → Publish
          </span>
        </div>
        <FunnelViz stages={funnelData} loading={loading} />
        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
          <AlertTriangle size={13} className="text-[#ff9800] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#a0a0a0]">
            <span className="text-[#ff9800] font-semibold">
              {data?.quality ? (data.quality.fields.find(f => f.field === 'upload_date')?.null ?? 390) : 390} videos
            </span> have no upload_date
            - data quality gap visible in MCI / OPI KPIs.
            100% of uploaded videos are processed by MediaFlow AI.
          </p>
        </div>
      </motion.div>

      {/* Data Quality Monitor */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Data Quality Monitor</h2>
          <span className="text-xs font-bold border px-2 py-1 rounded-md"
            style={{
              color: (data?.quality?.overall_health_pct ?? 0) >= 80 ? '#4caf50' : (data?.quality?.overall_health_pct ?? 0) >= 60 ? '#ff9800' : '#e63946',
              borderColor: (data?.quality?.overall_health_pct ?? 0) >= 80 ? '#4caf50' : (data?.quality?.overall_health_pct ?? 0) >= 60 ? '#ff9800' : '#e63946',
              background: (data?.quality?.overall_health_pct ?? 0) >= 80 ? '#4caf5015' : (data?.quality?.overall_health_pct ?? 0) >= 60 ? '#ff980015' : '#e6394615',
            }}
          >
            MCI
          </span>
        </div>
        <DataQualityBars
          fields={data?.quality?.fields}
          health={data?.quality?.overall_health_pct}
          loading={loading}
        />
        {data?.quality && (
          <div className="mt-4 flex items-center justify-between text-xs text-[#555]">
            <span>{(data.quality.total_rows ?? 0).toLocaleString()} total rows scanned</span>
            {(data.quality.duplicate_pct ?? 0) > 0 && (
              <span className="text-[#ff9800]">{data.quality.duplicate_pct ?? 0}% duplicate rate (DCDR)</span>
            )}
          </div>
        )}
      </motion.div>

      {/* Billable Analytics — Leadership/Admin only (CXO financial KPI per catalog) */}
      <RoleGate allowed={['cxo', 'manager']}>
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.53, duration: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Billable Analytics</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2196f3]/10 border border-[#2196f3]/30 text-[#64b5f6]">
                Leadership
              </span>
              <span className="text-xs font-bold border px-2 py-1 rounded-md text-[#4caf50] border-[#4caf50]/40 bg-[#4caf50]/10">
                PS §8C
              </span>
            </div>
          </div>
          <BillablePanel billable={data?.billable} loading={loading} />
        </motion.div>
      </RoleGate>

      {/* Workspace PCR + Agent Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, duration: 0.35 }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Workspace PCR</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#e63946]/15 text-[#e63946] text-xs font-bold border border-[#e63946]/30">
              PCR
            </span>
          </div>
          <DraggableChart title="Workspace PCR" data={workspaces}>
            {workspaces.map((ws, i) => (
              <WorkspacePCRBar key={ws.name} {...ws} delay={0.55 + i * 0.08} />
            ))}
          </DraggableChart>
          <div className="mt-4 p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <p className="text-xs text-[#a0a0a0]">
              <span className="text-[#e63946] font-semibold">WS-SPORTS-LIVE</span> at 38% is
              54pp below top performer.{' '}
              <span className="text-[#4caf50] font-semibold">WS-DIGITAL-NEWS</span> at 92%
              - Company_B's single workspace.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58, duration: 0.35 }}
        >
          <AgentInboxWidget />
        </motion.div>
      </div>

      {/* Summary Table */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6 overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.35 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Workspace Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                {['Workspace', 'Company', 'Team', 'Total', 'Uploaded', 'Published', 'PCR', 'Status'].map((h) => (
                  <th key={h} className="text-left text-[#555] text-xs font-semibold pb-3 pr-4 last:pr-0 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workspaces.map((ws) => {
                const WS_META = {
                  'WS-DIGITAL-NEWS':  { company: 'Company_B', team: 'Digital_News'  },
                  'WS-ENTERTAINMENT': { company: 'Company_A', team: 'Entertainment' },
                  'WS-TECH-ANALYSIS': { company: 'Company_A', team: 'Tech_Analysis' },
                  'WS-LIFESTYLE':     { company: 'Company_A', team: 'Lifestyle'     },
                  'WS-SPORTS-LIVE':   { company: 'Company_A', team: 'Sports_Live'   },
                }
                const meta = WS_META[ws.name] || { company: '-', team: '-' }
                const pcrVal = ws.pcr ?? 0
                const color = pcrVal >= 80 ? '#4caf50' : pcrVal >= 60 ? '#ff9800' : '#e63946'
                const label = pcrVal >= 80 ? 'Healthy' : pcrVal >= 60 ? 'Moderate' : 'Review'
                return (
                  <tr
                    key={ws.name}
                    className="border-b border-[#1f1f1f]/60 last:border-0 hover:bg-[#1a1a1a] transition-colors"
                  >
                    <td className="py-3 pr-4 font-medium text-white text-xs">{ws.name}</td>
                    <td className="py-3 pr-4 text-[#a0a0a0] text-xs">{meta.company}</td>
                    <td className="py-3 pr-4 text-[#a0a0a0] text-xs">{meta.team}</td>
                    <td className="py-3 pr-4 tabular-nums text-xs text-[#a0a0a0]">{(ws.total ?? 0).toLocaleString()}</td>
                    <td className="py-3 pr-4 tabular-nums text-xs text-[#a0a0a0]">{(ws.total ?? 0).toLocaleString()}</td>
                    <td className="py-3 pr-4 tabular-nums text-xs text-[#a0a0a0]">{(ws.published ?? 0).toLocaleString()}</td>
                    <td className="py-3 pr-4 tabular-nums font-bold text-sm" style={{ color }}>{pcrVal}%</td>
                    <td className="py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
                      >
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
