/**
 * TeamActivity.jsx — Tab 3: Team / Workspace / User Analysis
 * Treemap · Output by Team · User Activity table · CrossTab drill-down · LPI card
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, TrendingUp, TrendingDown, Globe, BarChart2,
  Minus, ChevronDown, AlertTriangle, X,
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import KPICard from '../components/charts/KPICard'
import DonutChart from '../components/charts/DonutChart'
import DataTable from '../components/common/DataTable'
import FilterBar from '../components/common/FilterBar'
import Badge from '../components/common/Badge'
import RoleGate from '../components/common/RoleGate'
import useStore from '../store/useStore'
import { getCrosstab, getKPI, getExecutiveSummary, getUserActivity } from '../api/client'
import { humanize, stripWs } from '../utils/format'
import DraggableChart from '../components/common/DraggableChart'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USERS = [
  {
    user: 'content_editor_01',
    team: 'Digital_News',
    workspace: 'WS-DIGITAL-NEWS',
    teu: 6.2,
    uploaded: 1450,
    published: 1334,
    pcr: 92,
    lastActive: '2025-11-15',
    status: 'active',
  },
  {
    user: 'content_editor_02',
    team: 'Entertainment',
    workspace: 'WS-ENTERTAINMENT',
    teu: 8.1,
    uploaded: 1200,
    published: 984,
    pcr: 82,
    lastActive: '2025-11-14',
    status: 'active',
  },
  {
    user: 'content_editor_03',
    team: 'Tech_Analysis',
    workspace: 'WS-TECH-ANALYSIS',
    teu: 11.3,
    uploaded: 1050,
    published: 714,
    pcr: 68,
    lastActive: '2025-11-13',
    status: 'active',
  },
  {
    user: 'content_editor_04',
    team: 'Sports_Live',
    workspace: 'WS-SPORTS-LIVE',
    teu: 18.7,
    uploaded: 869,
    published: 330,
    pcr: 38,
    lastActive: '2025-11-10',
    status: 'idle',
  },
]

const TREEMAP_DATA = [
  { name: 'content_editor_01\nDigital News · 92% PCR', value: 1450, pcr: 92 },
  { name: 'content_editor_02\nEntertainment · 82% PCR', value: 1200, pcr: 82 },
  { name: 'content_editor_03\nTech Analysis · 68% PCR', value: 1050, pcr: 68 },
  { name: 'content_editor_04\nSports Live · 38% PCR', value: 869, pcr: 38 },
]

// CrossTab mock data generator
function generateCrossTabData(d1, d2) {
  const dim1Values = {
    workspace: ['WS-DIGITAL-NEWS', 'WS-ENTERTAINMENT', 'WS-TECH-ANALYSIS', 'WS-LIFESTYLE', 'WS-SPORTS-LIVE'],
    team: ['Digital_News', 'Entertainment', 'Tech_Analysis', 'Sports_Live', 'Lifestyle'],
    uploaded_by: ['content_editor_01', 'content_editor_02', 'content_editor_03', 'content_editor_04'],
    language: ['English', 'Hindi'],
  }
  const dim2Values = {
    input_type: ['interview', 'speech', 'debate', 'news_bulletin', 'special_report', 'press_conference', 'discussion_show'],
    ai_output_type: ['key_moments', 'chapters', 'full_package', 'summary', 'my_key_moments'],
    language: ['English', 'Hindi'],
  }

  const rows = dim1Values[d1] || ['A', 'B', 'C']
  const cols = dim2Values[d2] || ['X', 'Y', 'Z']

  return rows.map((r) => {
    const obj = { [d1]: r }
    cols.forEach((c) => {
      obj[c] = Math.round(80 + Math.random() * 400)
    })
    return obj
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TreemapViz({ data: _data, loading, metric }) {
  const data = _data || []
  const treeData = data.map((d) => ({
    name: d.name,
    value: d.value,
    itemStyle: {
      color:
        d.pcr >= 80
          ? '#1a3a1a'
          : d.pcr >= 60
          ? '#3a2a0a'
          : '#3a0a0a',
      borderColor:
        d.pcr >= 80
          ? '#4caf50'
          : d.pcr >= 60
          ? '#ff9800'
          : '#e63946',
      borderWidth: 1.5,
    },
    label: {
      color:
        d.pcr >= 80
          ? '#4caf50'
          : d.pcr >= 60
          ? '#ff9800'
          : '#e63946',
    },
  }))

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      formatter(info) {
        const lines = (info.name ?? '').split('\n')
        return `<b style="color:#fff">${lines[0]}</b><br/><span style="color:#a0a0a0">${lines[1] || ''}</span><br/>Uploads: <b>${(info.value ?? 0).toLocaleString()}</b>`
      },
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    series: [
      {
        type: 'treemap',
        data: treeData,
        width: '100%',
        height: '100%',
        roam: false,
        nodeClick: false,
        label: {
          show: true,
          fontSize: 11,
          fontWeight: '600',
          formatter(p) {
            return p.name.split('\n')[0]
          },
        },
        upperLabel: { show: false },
        itemStyle: {
          borderWidth: 2,
          borderColor: '#0a0a0a',
          gapWidth: 2,
        },
        breadcrumb: { show: false },
        levels: [
          {
            itemStyle: { borderColor: '#0a0a0a', borderWidth: 2, gapWidth: 2 },
          },
        ],
      },
    ],
  }

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-2 gap-2" style={{ height: 280 }}>
        {[60, 40, 55, 45].map((h, i) => (
          <div key={i} className="bg-[#1f1f1f] rounded-xl" style={{ height: `${h}%` }} />
        ))}
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 280, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function OutputTypeByTeamChart({ loading }) {
  const teams = ['Digital News', 'Entertainment', 'Tech Analysis', 'Sports Live', 'Lifestyle']
  const outputTypes = ['key_moments', 'chapters', 'full_package', 'summary', 'my_key_moments']
  const colors = ['#e63946', '#666666', '#ff8fa3', '#444444', '#ff9800']

  // Deterministic static data — stable across re-renders
  const series = useMemo(() => outputTypes.map((type, idx) => ({
    name: type.replace(/_/g, ' '),
    type: 'bar',
    stack: 'total',
    data: teams.map((_, ti) => 40 + ((idx * 37 + ti * 19) % 80) + 10),
    barMaxWidth: 40,
    itemStyle: {
      color: colors[idx],
      borderRadius: idx === outputTypes.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0],
    },
  })), [])

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 11 },
    },
    legend: {
      data: outputTypes.map((t) => t.replace(/_/g, ' ')),
      bottom: 4,
      type: 'scroll',
      textStyle: { color: '#a0a0a0', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
      pageIconColor: '#666',
      pageTextStyle: { color: '#555', fontSize: 10 },
    },
    grid: { left: 12, right: 12, top: 16, bottom: 72, containLabel: true },
    xAxis: {
      type: 'category',
      data: teams,
      axisLabel: { color: '#a0a0a0', fontSize: 10, interval: 0 },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#555', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series,
  }

  if (loading) {
    return <div className="animate-pulse h-72 bg-[#1f1f1f] rounded-xl" />
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 280, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function CrossTabHeatmap({ d1, d2, loading, apiData, metric }) {
  const rows = {
    workspace: ['WS-DIGITAL-NEWS', 'WS-ENTERTAINMENT', 'WS-TECH-ANALYSIS', 'WS-LIFESTYLE', 'WS-SPORTS-LIVE'],
    team: ['Digital_News', 'Entertainment', 'Tech_Analysis', 'Sports_Live', 'Lifestyle'],
    uploaded_by: ['content_editor_01', 'content_editor_02', 'content_editor_03', 'content_editor_04'],
    language: ['English', 'Hindi'],
  }
  const cols = {
    input_type: ['interview', 'speech', 'debate', 'news_bulletin', 'special_report', 'press_conference', 'discussion_show'],
    ai_output_type: ['key_moments', 'chapters', 'full_package', 'summary', 'my_key_moments'],
    language: ['English', 'Hindi'],
    workspace: ['WS-DIGITAL-NEWS', 'WS-ENTERTAINMENT', 'WS-TECH-ANALYSIS', 'WS-LIFESTYLE', 'WS-SPORTS-LIVE'],
  }

  let yLabels, xLabels, heatData

  if (apiData && apiData.length > 0) {
    const colKeys = Object.keys(apiData[0]).filter((k) => k !== 'd1_val')
    yLabels = apiData.map((r) => humanize(stripWs(String(r.d1_val ?? ''))))
    xLabels = colKeys.map((c) => humanize(String(c)))
    heatData = []
    apiData.forEach((row, yi) => {
      colKeys.forEach((col, xi) => {
        heatData.push([xi, yi, Number(row[col]) || 0])
      })
    })
  } else {
    yLabels = []
    xLabels = []
    heatData = []
  }

  const maxVal = Math.max(...heatData.map((d) => d[2]), 1)

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter(p) {
        const label = metric === 'hours' ? 'Hours' : metric === 'pcr_pct' ? 'PCR %' : 'Count'
        const val = p.data[2] ?? 0
        return `${yLabels[p.data[1]] ?? ''} × ${xLabels[p.data[0]] ?? ''}<br/>${label}: <b>${
          metric === 'hours' ? val.toFixed(2) : val.toLocaleString()
        }</b>`
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      calculable: false,
      show: false,
      inRange: { color: ['#1a0a0a', '#5a0f14', '#e63946'] },
    },
    grid: { left: 16, right: 16, top: 16, bottom: 16, containLabel: true },
    xAxis: {
      type: 'category',
      data: xLabels,
      axisLabel: {
        color: '#a0a0a0',
        fontSize: 9,
        rotate: 35,
        interval: 0,
        overflow: 'truncate',
        width: 80,
      },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      axisLabel: {
        color: '#a0a0a0',
        fontSize: 9,
        overflow: 'truncate',
        width: 100,
      },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    series: [
      {
        type: 'heatmap',
        data: heatData,
        label: {
          show: false,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(230,57,70,0.5)' },
        },
      },
    ],
  }

  if (loading) {
    return <div className="animate-pulse h-52 bg-[#1f1f1f] rounded-xl" />
  }

  if (!apiData || apiData.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-[#555]">
        No cross-tab data available
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 300, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const DIM1_OPTIONS = [
  { value: 'workspace', label: 'Workspace' },
  { value: 'team', label: 'Team' },
  { value: 'user', label: 'User' },
  { value: 'language', label: 'Language' },
]

const DIM2_OPTIONS = [
  { value: 'input_type', label: 'Input Type' },
  { value: 'ai_output_type', label: 'Output Type' },
  { value: 'language', label: 'Language' },
  { value: 'workspace', label: 'Workspace' },
]

export default function TeamActivity() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userPage, setUserPage] = useState(1)
  const [dim1, setDim1] = useState('workspace')
  const [dim2, setDim2] = useState('input_type')
  const [crossTabLoading, setCrossTabLoading] = useState(false)
  const [crossTabData, setCrossTabData] = useState(null)
  const filters = useStore((s) => s.filters)
  const metric = useStore((s) => s.metric)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getExecutiveSummary(filters),
      getKPI('LPI', filters),
      getUserActivity(filters),
    ])
      .then(([exec, lpi, users]) => {
        setData({
          workspacePcr: exec.data?.workspace_pcr,
          lpi: lpi.data?.data,
          users: users.data,
        })
      })
      .catch((err) => {
        console.error('[TeamActivity] Data fetch failed:', err.message)
        setError(`Failed to load data: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    setCrossTabLoading(true)
    getCrosstab({ d1: dim1, d2: dim2, metric, ...filters })
      .then((res) => { setCrossTabData(res.data ?? res); setError(null) })
      .catch(() => { setCrossTabData(null) })
      .finally(() => setCrossTabLoading(false))
  }, [dim1, dim2, filters, metric])

  // User Activity table columns
  const userColumns = [
    {
      key: 'user',
      label: 'User',
      sortable: true,
      render: (v) => (
        <span className="font-mono text-xs text-[#ff8fa3]">{v ?? '-'}</span>
      ),
    },
    {
      key: 'team',
      label: 'Team',
      sortable: true,
      render: (v) => <span className="text-[#a0a0a0] text-xs">{v ?? '-'}</span>,
    },
    {
      key: 'teu',
      label: 'TEU Score',
      sortable: true,
      render: (v, row) => {
        const n = Number(v ?? 0)
        const color = n <= 8 ? '#4caf50' : n <= 13 ? '#ff9800' : '#e63946'
        return (
          <span className="font-bold tabular-nums" style={{ color }}>
            {n}h
          </span>
        )
      },
    },
    {
      key: 'uploaded',
      label: 'Videos Uploaded',
      sortable: true,
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{Number(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'published',
      label: 'Published',
      sortable: true,
      render: (v) => <span className="tabular-nums text-[#a0a0a0]">{Number(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'pcr',
      label: 'PCR',
      sortable: true,
      render: (v) => {
        const n = Number(v ?? 0)
        const c = n >= 80 ? '#4caf50' : n >= 60 ? '#ff9800' : '#e63946'
        return <span className="font-bold tabular-nums text-sm" style={{ color: c }}>{n}%</span>
      },
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      sortable: true,
      render: (v) => <span className="text-xs text-[#555]">{v ?? '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <Badge variant={v === 'active' ? 'success' : 'warning'} size="sm">
          {v}
        </Badge>
      ),
    },
  ]

  const treemapData = data?.workspacePcr?.map((ws) => ({
    name: `${ws.workspace ?? ''}\n${stripWs(ws.workspace ?? '').replace(/-/g, ' ')} · ${ws.pcr ?? 0}% PCR`,
    value: ws.total ?? 0,
    pcr: ws.pcr ?? 0,
  })) ?? TREEMAP_DATA

  const lpiRows = data?.lpi ?? []
  const lpiPair = [
    {
      lang: 'English',
      lpi: lpiRows.find((r) => r.language === 'English')?.lpi_score ?? +0.12,
      pcr: lpiRows.find((r) => r.language === 'English')?.pcr ?? 71.4,
      count: lpiRows.find((r) => r.language === 'English')?.count ?? 3290,
      pct: '72%',
    },
    {
      lang: 'Hindi',
      lpi: lpiRows.find((r) => r.language === 'Hindi')?.lpi_score ?? -0.08,
      pcr: lpiRows.find((r) => r.language === 'Hindi')?.pcr ?? 66.8,
      count: lpiRows.find((r) => r.language === 'Hindi')?.count ?? 1279,
      pct: '28%',
    },
  ]

  const users = data?.users || MOCK_USERS
  const activeCount = users.filter((u) => u.status === 'active').length
  const topWs = data?.workspacePcr?.[0]
  const avgTeu = users.length
    ? +(users.reduce((s, u) => s + (u.teu || 0), 0) / users.length).toFixed(1)
    : 11.1

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Team Activity</h1>
        <p className="text-sm text-[#a0a0a0]">Workspace, team, and user performance breakdown</p>
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

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Active Users',
            value: activeCount || 4,
            unit: '',
            trend: 'neutral',
            trendLabel: `${users.length} total`,
            icon: Users,
            subtitle: `${users.length - activeCount} idle`,
            loading,
          },
          {
            title: 'Avg TEU Score',
            value: avgTeu,
            unit: 'h',
            trend: 'up',
            trendValue: null,
            trendLabel: 'vs target',
            icon: TrendingUp,
            subtitle: 'Time-per-edit unit (lower = faster)',
            loading,
          },
          {
            title: 'Top Workspace',
            value: topWs?.pcr ?? 92,
            unit: '%',
            trend: 'up',
            trendLabel: topWs?.workspace ?? 'WS-DIGITAL-NEWS',
            icon: BarChart2,
            accent: true,
            subtitle: 'Highest PCR',
            loading,
          },
          {
            title: 'Languages',
            value: 2,
            unit: '',
            trend: 'neutral',
            trendLabel: 'English & Hindi',
            icon: Globe,
            subtitle: '72% English / 28% Hindi',
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

      {/* Treemap + Output by Team */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div
          className="lg:col-span-3 bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Team Contribution</h2>
            <div className="flex items-center gap-3 text-[10px] text-[#555] uppercase tracking-wide">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#1a3a1a] border border-[#4caf50]" /> ≥80% PCR</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#3a2a0a] border border-[#ff9800]" /> 60–80%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#3a0a0a] border border-[#e63946]" /> &lt;60%</span>
            </div>
          </div>
          <DraggableChart title="Team Contribution" data={treemapData}>
            <TreemapViz data={treemapData} loading={loading} metric={metric} />
          </DraggableChart>
        </motion.div>

        <motion.div
          className="lg:col-span-2 bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.37 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Output Type by Team</h2>
          <OutputTypeByTeamChart loading={loading} />
        </motion.div>
      </div>

      {/* User Activity Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">User Activity</h2>
        <DataTable
          columns={userColumns}
          data={users}
          loading={loading}
          total={users.length}
          page={userPage}
          pageSize={10}
          onPageChange={setUserPage}
          onSort={() => {}}
          showExport
        />
      </motion.div>

      {/* CrossTab Drill-Down */}
      <RoleGate allowed={['cxo', 'manager', 'analyst']}>
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Dimension Analysis</h2>
          <p className="text-xs text-[#555] mt-0.5">Select any two dimensions to cross-analyze</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#555] uppercase tracking-wide">D1</span>
            <DimSelect
              value={dim1}
              options={DIM1_OPTIONS}
              onChange={setDim1}
            />
          </div>
          <span className="text-[#333] font-bold">×</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#555] uppercase tracking-wide">D2</span>
            <DimSelect
              value={dim2}
              options={DIM2_OPTIONS}
              onChange={setDim2}
            />
          </div>
        </div>

        <CrossTabHeatmap d1={dim1} d2={dim2} loading={crossTabLoading} apiData={crossTabData} metric={metric} />
      </motion.div>

      {/* LPI Card */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.58 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Language Performance Index (LPI)</h2>
            <p className="text-xs text-[#555] mt-0.5">
              Deviation from mean PCR - positive = overperforming vs average
            </p>
          </div>
          <span className="text-xs font-bold text-[#e63946] border border-[#e63946]/30 bg-[#e63946]/10 px-2 py-1 rounded-md">
            LPI
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {lpiPair.map((l) => {
            const isPositive = l.lpi >= 0
            const color = isPositive ? '#4caf50' : '#e63946'
            const Icon = isPositive ? TrendingUp : TrendingDown
            return (
              <div
                key={l.lang}
                className="p-4 rounded-xl border flex items-center gap-4"
                style={{
                  background: `${color}08`,
                  borderColor: `${color}30`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{l.lang}</p>
                  <p className="text-xs text-[#555] mt-0.5">{l.count.toLocaleString()} videos · {l.pct}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-lg font-bold tabular-nums" style={{ color }}>
                      {isPositive ? '+' : ''}{l.lpi.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#555]">
                      PCR: <span className="text-[#a0a0a0]">{l.pcr}%</span>
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-md"
                      style={{ background: `${color}20`, color }}
                    >
                      {isPositive ? 'Overperforming' : 'Underperforming'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}

function DimSelect({ value, options, onChange }) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[#1a1a1a] border border-[#2a2a2a] text-white text-xs font-medium rounded-lg px-3 py-1.5 pr-7 cursor-pointer focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none"
      />
    </div>
  )
}
