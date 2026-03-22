/**
 * PublishMetrics.jsx - Tab 4: Publish Metrics + Funnel
 * FunnelViz · Input Type Donut · PCR by Output Type · CPDG scatter · HTHR leaderboard · FSC table
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingDown, AlertTriangle, Target, Zap, BarChart2, Clock,
  ChevronDown, X,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import KPICard from '../components/charts/KPICard'
import DonutChart from '../components/charts/DonutChart'
import DataTable from '../components/common/DataTable'
import FilterBar from '../components/common/FilterBar'
import Badge from '../components/common/Badge'
import RoleGate from '../components/common/RoleGate'
import useStore from '../store/useStore'
import { getPublishFunnel, getExecutiveSummary, getCategoryTrends, getOutputTypeTrends, getKPI, getPeriodComparison } from '../api/client'
import { humanize, stripWs } from '../utils/format'
import DraggableChart from '../components/common/DraggableChart'

// ── Mock data ─────────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { name: 'Upload',      icon: 'upload',  count: 4179, hours: 8928, pct: 100  },
  { name: 'Processing',  icon: 'process', count: 4179, pct: 100  },
  { name: 'Validation',  icon: 'check',   count: 4179, pct: 100  },
  { name: 'Published',   icon: 'publish', count: 3188, pct: 69.8 },
]

const OUTPUT_PCR = [
  { type: 'summary',        pcr: 70.9, total: 754,  published: 535  },
  { type: 'key_moments',    pcr: 70.6, total: 1124, published: 793  },
  { type: 'chapters',       pcr: 69.9, total: 982,  published: 687  },
  { type: 'full_package',   pcr: 68.8, total: 876,  published: 603  },
  { type: 'my_key_moments', pcr: 64.6, total: 833,  published: 538, isLowest: true },
]

const INPUT_TYPE_MIX = [
  { name: 'interview',        value: 850,  pct: 32, color: '#e63946' },
  { name: 'news_bulletin',    value: 598,  pct: 22, color: '#666666' },
  { name: 'speech',           value: 354,  pct: 13, color: '#444444' },
  { name: 'debate',           value: 299,  pct: 11, color: '#555555' },
  { name: 'special_report',   value: 245,  pct: 9,  color: '#888888' },
  { name: 'press_conference', value: 190,  pct: 7,  color: '#aaaaaa' },
  { name: 'discussion_show',  value: 163,  pct: 6,  color: '#cc4444' },
]

const SCATTER_DATA = [
  { type: 'interview',        ctr: 8.2, viewPct: 62, count: 850, color: '#e63946' },
  { type: 'news_bulletin',    ctr: 7.1, viewPct: 55, count: 598, color: '#666666' },
  { type: 'speech',           ctr: 5.9, viewPct: 48, count: 354, color: '#444444' },
  { type: 'debate',           ctr: 6.4, viewPct: 51, count: 299, color: '#555555' },
  { type: 'special_report',   ctr: 7.8, viewPct: 58, count: 245, color: '#888888' },
  { type: 'press_conference', ctr: 5.2, viewPct: 44, count: 190, color: '#aaaaaa' },
  { type: 'discussion_show',  ctr: 5.6, viewPct: 47, count: 163, color: '#cc4444' },
]

const HTHR_DATA = [
  { rank: 1,  type: 'interview',        hthr: 0.94, ctr: 8.2, avgView: 62, impressions: 28400 },
  { rank: 2,  type: 'special_report',   hthr: 0.91, ctr: 7.8, avgView: 58, impressions: 24600 },
  { rank: 3,  type: 'news_bulletin',    hthr: 0.88, ctr: 7.1, avgView: 55, impressions: 22100 },
  { rank: 4,  type: 'debate',           hthr: 0.83, ctr: 6.4, avgView: 51, impressions: 19800 },
  { rank: 5,  type: 'discussion_show',  hthr: 0.79, ctr: 5.6, avgView: 47, impressions: 17400 },
  { rank: 6,  type: 'speech',           hthr: 0.76, ctr: 5.9, avgView: 48, impressions: 16900 },
  { rank: 7,  type: 'press_conference', hthr: 0.71, ctr: 5.2, avgView: 44, impressions: 15200 },
]

const FSC_DATA = [
  { ws: 'WS-DIGITAL-NEWS',   uploaded: 1200, processed: 1200, published: 1106, uploadToProcess: 100, processToPublish: 92 },
  { ws: 'WS-ENTERTAINMENT',  uploaded: 884,  processed: 884,  published: 725,  uploadToProcess: 100, processToPublish: 82 },
  { ws: 'WS-TECH-ANALYSIS',  uploaded: 1191, processed: 1191, published: 810,  uploadToProcess: 100, processToPublish: 68 },
  { ws: 'WS-LIFESTYLE',      uploaded: 396,  processed: 396,  published: 206,  uploadToProcess: 100, processToPublish: 52 },
  { ws: 'WS-SPORTS-LIVE',    uploaded: 508,  processed: 508,  published: 341,  uploadToProcess: 100, processToPublish: 38 },
]

// ── Sub-charts ─────────────────────────────────────────────────────────────────

function OutputTypePCRBar({ loading, data: _data = OUTPUT_PCR }) {
  const data = _data || OUTPUT_PCR
  if (!data.length) return null
  const minPcr = Math.min(...data.map((o) => o.pcr ?? 0))
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter(params) {
        const p = params[0]
        const isLowest = p.value === minPcr
        return `<b>${p.name}</b><br/>PCR: <b style="color:${isLowest ? '#e63946' : '#4caf50'}">${p.value}%</b>${isLowest ? '<br/><span style="color:#e63946">⚠ Lowest performer</span>' : ''}`
      },
    },
    grid: { left: 130, right: 80, top: 8, bottom: 8, containLabel: false },
    xAxis: {
      type: 'value',
      min: Math.floor(minPcr) - 5,
      max: Math.ceil(Math.max(...data.map((o) => o.pcr))) + 2,
      axisLabel: { color: '#555', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: data.map((o) => humanize(o.type)).reverse(),
      axisLabel: { color: '#a0a0a0', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    series: [
      {
        type: 'bar',
        data: [...data].reverse().map((o) => ({
          value: o.pcr,
          itemStyle: {
            color: o.pcr === minPcr ? '#e63946' : '#666666',
            borderRadius: [0, 6, 6, 0],
          },
          label: {
            show: true,
            position: 'right',
            formatter: `{c}%${o.pcr === minPcr ? ' ⚠' : ''}`,
            color: o.pcr === minPcr ? '#e63946' : '#a0a0a0',
            fontSize: 11,
            fontWeight: o.pcr === minPcr ? '700' : '400',
          },
        })),
        barMaxWidth: 28,
      },
    ],
  }

  if (loading) {
    return <div className="animate-pulse h-48 bg-[#1f1f1f] rounded-xl" />
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 200, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function CPDGScatter({ loading, data = SCATTER_DATA }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter(p) {
        const d = p.data
        return `<b>${d[3] ?? ''}</b><br/>CTR: <b>${d[0] ?? 0}%</b><br/>Avg View %: <b>${d[1] ?? 0}%</b><br/>Count: <b>${(d[2] ?? 0).toLocaleString()}</b>`
      },
    },
    legend: {
      show: false,
    },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'value',
      name: 'CTR %',
      nameTextStyle: { color: '#555', fontSize: 11 },
      min: 4,
      max: 10,
      axisLabel: { color: '#555', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    yAxis: {
      type: 'value',
      name: 'Avg View %',
      nameTextStyle: { color: '#555', fontSize: 11 },
      min: 35,
      max: 75,
      axisLabel: { color: '#555', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        data: data.map((d) => [d.ctr, d.viewPct, d.count, d.type]),
        symbolSize(val) {
          return Math.sqrt(val[2]) * 1.8
        },
        itemStyle: {
          color: (params) => data[params.dataIndex]?.color || '#e63946',
          opacity: 0.85,
        },
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(230,57,70,0.5)',
          },
        },
      },
    ],
  }

  if (loading) {
    return <div className="animate-pulse h-64 bg-[#1f1f1f] rounded-xl" />
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 260, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PublishMetrics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hthrPage, setHthrPage] = useState(1)
  const [fscPage, setFscPage] = useState(1)
  const filters = useStore((s) => s.filters)
  const comparePeriod = useStore((s) => s.comparePeriod)
  const metric = useStore((s) => s.metric)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPublishFunnel(filters),
      getExecutiveSummary(filters),
      getCategoryTrends(filters),
      getOutputTypeTrends(filters),
      getKPI('HTHR', filters),
      getPeriodComparison({ period_days: comparePeriod, ...filters }),
      getKPI('CPDG', filters).catch(() => ({ data: { data: [] } })),
    ])
      .then(([funnel, exec, category, outputType, hthr, comparison, cpdg]) => {
        setData({
          funnel: funnel.data,
          workspacePcr: exec.data?.workspace_pcr,
          category: category.data,
          outputPcr: outputType.data,
          hthr: hthr.data?.data,
          comparison: comparison.data,
          cpdg: cpdg.data?.data,
        })
      })
      .catch((err) => {
        console.error('[PublishMetrics] Data fetch failed:', err.message)
        setError(`Failed to load data: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [filters, comparePeriod])

  // HTHR table columns
  const hthrColumns = [
    {
      key: 'rank',
      label: 'Rank',
      render: (v) => (
        <span
          className={`text-sm font-bold tabular-nums ${(v ?? 0) <= 3 ? 'text-[#e63946]' : 'text-[#555]'}`}
        >
          #{v ?? 0}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Content Type',
      sortable: true,
      render: (v) => (
        <span className="font-medium text-white capitalize">{humanize(v)}</span>
      ),
    },
    {
      key: 'hthr',
      label: 'HTHR Score',
      sortable: true,
      render: (v) => {
        const n = Number(v ?? 0)
        const color = n >= 0.9 ? '#4caf50' : n >= 0.8 ? '#ff9800' : '#a0a0a0'
        return (
          <span className="font-bold tabular-nums" style={{ color }}>{n.toFixed(2)}</span>
        )
      },
    },
    {
      key: 'ctr',
      label: 'CTR %',
      sortable: true,
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{Number(v ?? 0)}%</span>,
    },
    {
      key: 'avgView',
      label: 'Avg View %',
      sortable: true,
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{Number(v ?? 0)}%</span>,
    },
    {
      key: 'impressions',
      label: 'Impressions',
      sortable: true,
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{Number(v ?? 0).toLocaleString()}</span>,
    },
  ]

  // FSC table columns
  const fscColumns = [
    {
      key: 'ws',
      label: 'Workspace',
      render: (v) => <Badge variant="workspace">{v}</Badge>,
    },
    {
      key: 'uploaded',
      label: 'Uploaded',
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'processed',
      label: 'Processed',
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'published',
      label: 'Published',
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'uploadToProcess',
      label: 'Upload → Process',
      render: (v) => (
        <span className="font-bold tabular-nums text-[#4caf50]">{v ?? 0}%</span>
      ),
    },
    {
      key: 'processToPublish',
      label: 'Process → Publish',
      render: (v, row) => {
        const n = Number(v ?? 0)
        const color = n >= 80 ? '#4caf50' : n >= 60 ? '#ff9800' : '#e63946'
        return (
          <span className="font-bold tabular-nums" style={{ color }}>
            {n}%
            {n < 50 && (
              <span className="ml-1.5 text-[10px] text-[#e63946] border border-[#e63946]/30 bg-[#e63946]/10 px-1 rounded">
                LOW
              </span>
            )}
          </span>
        )
      },
    },
  ]

  const COLORS = ['#e63946', '#666666', '#444444', '#555555', '#888888', '#aaaaaa', '#cc4444']

  const fscData = data?.workspacePcr?.map((ws) => ({
    ws: ws.workspace ?? '',
    uploaded: ws.total ?? 0,
    processed: ws.total ?? 0,
    published: ws.published ?? 0,
    uploadToProcess: 100,
    processToPublish: Math.round(ws.pcr ?? 0),
  })) ?? FSC_DATA

  const inputTypeMix = data?.category?.map((c, i) => ({
    name: humanize(c.type),
    value: c.count ?? 0,
    color: COLORS[i % COLORS.length],
  })) ?? INPUT_TYPE_MIX.map((item) => ({ name: humanize(item.name), value: item.value, color: item.color }))

  // CPDG data from aggregated API (grouped by input_type)
  const scatterData = (() => {
    const cpdgRows = data?.cpdg
    if (cpdgRows && cpdgRows.length > 0) {
      return cpdgRows.map((r, i) => ({
        type: r.input_type ?? '',
        ctr: r.ctr_percentage ?? 0,
        viewPct: r.avg_view_percentage ?? 0,
        count: r.count ?? 0,
        color: COLORS[i % COLORS.length],
      }))
    }
    return data?.category?.map((c, i) => ({
      type: c.type ?? '',
      ctr: c.ctr ?? 0,
      viewPct: c.avgView ?? 0,
      count: c.count ?? 0,
      color: COLORS[i % COLORS.length],
    })) ?? SCATTER_DATA
  })()

  const outputPcrData = data?.outputPcr?.map((row) => ({
    type: row.type ?? '',
    total: row.total ?? 0,
    published: row.published ?? 0,
    pcr: row.pcr ?? 0,
  })).sort((a, b) => b.pcr - a.pcr) ?? OUTPUT_PCR

  // HTHR table: from KPI API or fallback to mock
  const hthrTableData = data?.hthr?.map((row, i) => ({
    rank: i + 1,
    type: row.input_type ?? row.type ?? '',
    hthr: +(row.hthr_score ?? row.hthr ?? 0).toFixed(2),
    ctr: +(row.ctr_percentage ?? row.ctr ?? 0).toFixed(1),
    avgView: +(row.avg_view_percentage ?? row.avgView ?? 0).toFixed(1),
    impressions: Math.round(row.impressions ?? 0),
  })) ?? HTHR_DATA

  // Dynamic KPI card values from API
  const overallPcr = data?.workspacePcr
    ? (() => {
        const totalPub = data.workspacePcr.reduce((s, w) => s + (w.published ?? 0), 0)
        const totalAll = data.workspacePcr.reduce((s, w) => s + (w.total ?? 0), 0)
        return totalAll > 0 ? +(totalPub / totalAll * 100).toFixed(1) : 0
      })()
    : 69.8
  const topOutputPcr = outputPcrData.length ? outputPcrData[0] : { type: 'summary', pcr: 70.9 }
  const pd = data?.comparison?.delta

  return (
    <motion.div
      className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Publish Metrics &amp; Funnel</h1>
        <p className="text-sm text-[#a0a0a0]">Pipeline funnel, output type analysis, and content engagement</p>
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
        {[
          {
            title: 'Overall Publish Rate',
            value: overallPcr,
            unit: '%',
            trend: pd?.pcr_pct != null ? (pd.pcr_pct >= 0 ? 'up' : 'down') : null,
            trendValue: pd?.pcr_pct != null ? Math.abs(pd.pcr_pct) : null,
            trendLabel: 'vs prev 30d',
            icon: BarChart2,
            accent: true,
            subtitle: `${data?.workspacePcr?.reduce((s, w) => s + (w.published ?? 0), 0) ?? 3188} published of ${data?.workspacePcr?.reduce((s, w) => s + (w.total ?? 0), 0) ?? 4569} total`,
            tooltip: 'PCR: Percentage of uploaded videos that are successfully published. Higher = efficient pipeline.',
            loading,
          },
          {
            title: 'Avg Drop-off',
            value: +(100 - overallPcr).toFixed(1),
            unit: '%',
            trend: 'down',
            trendValue: null,
            trendLabel: 'process to publish gap',
            icon: TrendingDown,
            subtitle: 'Processing to Published drop',
            tooltip: 'Gap between processing and publishing stages. Lower is better.',
            loading,
          },
          {
            title: 'Avg Processing',
            value: data?.comparison?.current?.avg_processing_h ?? 4.2,
            unit: 'h',
            trend: pd?.avg_processing_pct != null ? (pd.avg_processing_pct <= 0 ? 'down' : 'up') : null,
            trendValue: pd?.avg_processing_pct != null ? Math.abs(pd.avg_processing_pct) : null,
            trendLabel: 'vs prev 30d',
            icon: Clock,
            subtitle: 'MediaFlow AI processing time',
            loading,
          },
          {
            title: 'Top PCR Output',
            value: topOutputPcr.pcr,
            unit: '%',
            trend: 'neutral',
            trendLabel: topOutputPcr.type,
            icon: Target,
            subtitle: `${topOutputPcr.type} - highest PCR`,
            loading,
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <KPICard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Publish Conversion Overview */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Publish Conversion by Workspace</h2>
            <p className="text-xs text-[#555] mt-0.5">
              Upload to Published rate (PCR) per workspace - sorted by conversion
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#555]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#3a3a3a]" />
              Uploaded
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#e63946]" />
              Published
            </span>
          </div>
        </div>

        <DraggableChart title="Publish Conversion by Workspace" data={fscData}>
        <div className="space-y-4">
          {[...fscData].sort((a, b) => b.processToPublish - a.processToPublish).map((ws, i) => {
            const pcr   = ws.processToPublish
            const color = pcr >= 80 ? '#4caf50' : pcr >= 60 ? '#ff9800' : '#e63946'
            const short = stripWs(ws.ws)
            return (
              <motion.div
                key={ws.ws}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.07 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#a0a0a0] w-36 flex-shrink-0">{short}</span>
                  <div className="flex items-center gap-3 text-xs text-[#555] tabular-nums">
                    <span>{(ws.uploaded ?? 0).toLocaleString()} uploaded</span>
                    <span className="text-[#333]">·</span>
                    <span>{(ws.published ?? 0).toLocaleString()} published</span>
                    <span
                      className="font-bold w-12 text-right"
                      style={{ color }}
                    >
                      {pcr}%
                    </span>
                  </div>
                </div>
                {/* Stacked progress bar: grey = uploaded, red = published */}
                <div className="h-5 bg-[#1a1a1a] rounded-lg overflow-hidden relative">
                  {/* Uploaded bg */}
                  <div className="absolute inset-0 bg-[#2a2a2a] rounded-lg" />
                  {/* Published fill */}
                  <motion.div
                    className="absolute left-0 top-0 h-full rounded-lg flex items-center pl-2"
                    style={{ background: color, opacity: 0.85 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pcr}%` }}
                    transition={{ delay: 0.4 + i * 0.07, duration: 0.7, ease: 'easeOut' }}
                  />
                  {/* 70% target line */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/20"
                    style={{ left: '70%' }}
                    title="70% target"
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
        </DraggableChart>

        <div className="mt-4 flex items-center gap-4 text-xs text-[#555]">
          <div className="flex items-center gap-1.5">
            <div className="w-px h-4 bg-white/20" />
            <span>70% target line</span>
          </div>
          <span className="text-[#e63946] font-medium">
            WS-SPORTS-LIVE 38% is 32pp below target - 557 videos unpublished
          </span>
        </div>
      </motion.div>

      {/* Input Type Mix + PCR by Output Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Input Type Mix</h2>
          <div style={{ height: 220 }}>
            <DonutChart
              data={inputTypeMix}
              centerValue="7"
              centerLabel="Types"
              loading={loading}
            />
          </div>
        </motion.div>

        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">PCR by Output Type</h2>
            <div className="flex items-center gap-1.5 text-xs text-[#e63946] border border-[#e63946]/30 bg-[#e63946]/10 px-2 py-1 rounded-md">
              <AlertTriangle size={11} />
              my_key_moments lowest
            </div>
          </div>
          <OutputTypePCRBar loading={loading} data={outputPcrData} />
          <div className="mt-3 p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
            <p className="text-xs text-[#a0a0a0]">
              <span className="text-[#e63946] font-semibold">my_key_moments</span> at 64.6% is
              6.3pp below <span className="text-[#4caf50] font-semibold">summary</span> (70.9%).
              Review curation quality for this output type.
            </p>
          </div>
        </motion.div>
      </div>

      {/* CPDG Scatter - Manager/Analyst per PDF role table */}
      <RoleGate allowed={['manager', 'analyst']}>
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-white">Content Promise vs Delivery (CPDG)</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2196f3]/10 border border-[#2196f3]/30 text-[#64b5f6]">
                Leadership
              </span>
            </div>
            <p className="text-xs text-[#555]">
              CTR (click-through) vs Avg View % - bubble size = video count per type
            </p>
          </div>
          <CPDGScatter loading={loading} data={scatterData} />
        </motion.div>
      </RoleGate>

      {/* HTHR Leaderboard - Operations-focused (all roles, Creator badge) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-white">
            Top Performers - HTHR Leaderboard
          </h2>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4caf50]/10 border border-[#4caf50]/30 text-[#81c784]">
            Operations
          </span>
        </div>
        <DataTable
          columns={hthrColumns}
          data={hthrTableData}
          loading={loading}
          total={hthrTableData.length}
          page={hthrPage}
          pageSize={10}
          onPageChange={setHthrPage}
          onSort={() => {}}
        />
      </motion.div>

      {/* FSC Workspace Funnel Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.62 }}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Workspace Funnel Comparison (FSC)</h2>
          <p className="text-xs text-[#555] mt-0.5">
            Funnel Stage Conversion per workspace - highlights WS-SPORTS-LIVE drop-off
          </p>
        </div>
        <DataTable
          columns={fscColumns}
          data={fscData}
          loading={loading}
          total={fscData.length}
          page={fscPage}
          pageSize={10}
          onPageChange={setFscPage}
          onSort={() => {}}
        />
      </motion.div>
    </motion.div>
  )
}
