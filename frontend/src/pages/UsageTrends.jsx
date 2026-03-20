/**
 * UsageTrends.jsx — Tab 2: Usage & Trends
 * Sub-tabs: Time Analysis | Category Breakdown | Storage Metrics
 */

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, TrendingUp, Database, Youtube, Instagram, AlertTriangle, X } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import KPICard from '../components/charts/KPICard'
import TrendChart from '../components/charts/TrendChart'
import DualBarChart from '../components/charts/DualBarChart'
import DonutChart from '../components/charts/DonutChart'
import FilterBar from '../components/common/FilterBar'
import CountHoursToggle from '../components/common/CountHoursToggle'
import DataTable from '../components/common/DataTable'
import useStore from '../store/useStore'
import { getDailyTrends, getCategoryTrends, getOutputTypeTrends, getExecutiveSummary, getPeriodComparison, getForecast, getCrosstab } from '../api/client'
import { humanize } from '../utils/format'
import DraggableChart from '../components/common/DraggableChart'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DAILY = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(2025, 8, 1)
  d.setDate(d.getDate() + i)
  const date = d.toISOString().slice(0, 10)
  const uploaded = Math.round(40 + Math.abs(Math.sin(i / 5)) * 35 + (i % 7 === 5 ? 25 : 0))
  const published = Math.round(uploaded * (0.55 + (Math.sin(i / 9) * 0.15)))
  return {
    date,
    uploaded,
    published,
    processing_count: uploaded,
    published_count: published,
    uploaded_hours: +(uploaded * 0.42 + Math.abs(Math.sin(i)) * 5).toFixed(1),
    published_hours: +(published * 0.42 + Math.abs(Math.sin(i)) * 3).toFixed(1),
    processing_hours: +(uploaded * 0.42).toFixed(1),
  }
})

const MOCK_CATEGORY = [
  { type: 'interview',        count: 850,  hours: 357,  pcr: 74.1, ctr: 8.2, avgView: 62 },
  { type: 'news_bulletin',    count: 780,  hours: 130,  pcr: 71.8, ctr: 7.1, avgView: 55 },
  { type: 'speech',           count: 620,  hours: 207,  pcr: 68.4, ctr: 5.9, avgView: 48 },
  { type: 'debate',           count: 540,  hours: 270,  pcr: 67.8, ctr: 6.4, avgView: 51 },
  { type: 'special_report',   count: 498,  hours: 166,  pcr: 70.3, ctr: 7.8, avgView: 58 },
  { type: 'press_conference', count: 390,  hours: 98,   pcr: 65.1, ctr: 5.2, avgView: 44 },
  { type: 'discussion_show',  count: 340,  hours: 170,  pcr: 63.5, ctr: 5.6, avgView: 47 },
]

const MOCK_OUTPUT_TYPES = [
  { type: 'key_moments',    total: 1124, published: 793,  pcr: 70.6, avgWatchHours: 3.2, subscribers: 412, impressions: 28400 },
  { type: 'summary',        total: 754,  published: 535,  pcr: 70.9, avgWatchHours: 2.1, subscribers: 287, impressions: 19200 },
  { type: 'chapters',       total: 982,  published: 687,  pcr: 69.9, avgWatchHours: 4.1, subscribers: 356, impressions: 24600 },
  { type: 'full_package',   total: 876,  published: 603,  pcr: 68.8, avgWatchHours: 5.8, subscribers: 298, impressions: 22100 },
  { type: 'my_key_moments', total: 833,  published: 538,  pcr: 64.6, avgWatchHours: 2.8, subscribers: 184, impressions: 16800 },
]

const WEEKLY_HOURS = (() => {
  const weeks = []
  let start = new Date('2025-09-01')
  for (let w = 0; w < 13; w++) {
    const label = `W${w + 1}`
    const hours = Math.round(280 + Math.sin(w / 2) * 60 + Math.random() * 40)
    weeks.push({ week: label, hours, count: Math.round(hours / 0.42) })
  }
  return weeks
})()

const WORKSPACE_HOURS = [
  { name: 'WS-DIGITAL-NEWS',   hours: 2016, count: 1200 },
  { name: 'WS-TECH-ANALYSIS',  hours: 1986, count: 1191 },
  { name: 'WS-SPORTS-LIVE',    hours: 1317, count: 898  },
  { name: 'WS-ENTERTAINMENT',  hours: 1104, count: 884  },
  { name: 'WS-LIFESTYLE',      hours: 505,  count: 396  },
]

// ── Sub-tab components ─────────────────────────────────────────────────────────

function TimeAnalysis({ dailyData, categoryData, forecastData, loading, metric, comparison, languageData }) {
  const totalUploaded = dailyData.reduce((s, d) => s + (d.uploaded || 0), 0)
  const totalHours = dailyData.reduce((s, d) => s + (d.uploaded_hours || 0), 0)
  const d = comparison?.delta

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: 'Avg Processing Time',
            value: comparison?.current?.avg_processing_h ?? 4.2,
            unit: 'h',
            trend: (d?.avg_processing_pct ?? 0) <= 0 ? 'down' : 'up',
            trendValue: d?.avg_processing_pct != null ? Math.abs(d.avg_processing_pct) : null,
            trendLabel: 'vs prev 30d',
            icon: Clock,
            subtitle: 'Upload → MediaFlow AI processed',
            loading,
          },
          {
            title: 'Peak Upload Hour',
            value: '14:00',
            unit: '',
            trend: 'neutral',
            trendLabel: 'Daily peak hour',
            icon: TrendingUp,
            subtitle: 'Most active upload window',
            loading,
          },
          {
            title: 'Total Hours',
            value: metric === 'hours' ? Math.round(totalHours) : totalUploaded,
            unit: metric === 'hours' ? 'h' : '',
            trend: (d?.uploaded_pct ?? 0) >= 0 ? 'up' : 'down',
            trendValue: d?.uploaded_pct != null ? Math.abs(d.uploaded_pct) : null,
            trendLabel: 'vs prev 30d',
            icon: Database,
            subtitle: metric === 'hours' ? 'Uploaded video hours' : 'Videos uploaded',
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

      {/* Upload + Publish Trend with Chronos Forecast */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Upload &amp; Publish Trend</h2>
            {metric === 'count' && forecastData?.forecast?.length > 0 && (
              <p className="text-xs text-[#ff9800] mt-0.5">
                + 30-day forecast band (Chronos-Bolt-Tiny, zero-shot)
              </p>
            )}
          </div>
        </div>
        <DraggableChart title="Upload & Publish Trend" data={dailyData}>
          <div style={{ height: 320 }}>
            <TrendChart data={dailyData} forecastData={forecastData} metric={metric} loading={loading} />
          </div>
        </DraggableChart>
      </motion.div>

      {/* Dual Bar Chart */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Processing vs Published (90 days)</h2>
        </div>
        <div style={{ height: 300 }}>
          <DualBarChart data={dailyData} metric={metric} loading={loading} />
        </div>
      </motion.div>

      {/* Language + Input Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Upload by Language</h2>
          <div style={{ height: 240 }}>
            <DonutChart
              data={languageData}
              centerValue={languageData[0]?.value?.toLocaleString() ?? '3,290'}
              centerLabel={languageData[0]?.name ?? 'English'}
              loading={loading}
            />
          </div>
        </motion.div>

        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">
            Top Input Types ({metric === 'count' ? 'Videos' : 'Hours'})
          </h2>
          <HorizontalBarChart
            data={categoryData.map((c) => ({
              label: humanize(c.type),
              value: metric === 'count' ? c.count : c.hours,
            }))}
            loading={loading}
          />
        </motion.div>
      </div>
    </div>
  )
}

function CategoryBreakdown({ loading, metric, outputTypeData = MOCK_OUTPUT_TYPES, platformData }) {
  const outputTableColumns = [
    { key: 'type', label: 'Output Type', sortable: true },
    {
      key: 'avgWatchHours',
      label: 'Avg Watch Hours',
      sortable: true,
      render: (v) => (
        <span className="text-white font-medium tabular-nums">{Number(v ?? 0).toFixed(1)}h</span>
      ),
    },
    {
      key: 'subscribers',
      label: 'Subscribers Gained',
      sortable: true,
      render: (v) => (
        <span className="tabular-nums text-[#a0a0a0]">{v.toLocaleString()}</span>
      ),
    },
    {
      key: 'impressions',
      label: 'Impressions',
      sortable: true,
      render: (v) => (
        <span className="tabular-nums text-[#a0a0a0]">{v.toLocaleString()}</span>
      ),
    },
    {
      key: 'pcr',
      label: 'PCR',
      sortable: true,
      render: (v) => {
        const c = v >= 70 ? '#4caf50' : v >= 65 ? '#ff9800' : '#e63946'
        const flag = v <= 65
        return (
          <span className="font-bold tabular-nums" style={{ color: c }}>
            {v}%
            {flag && <span className="ml-1 text-[10px] text-[#e63946]">▼ Lowest</span>}
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Grouped bar: output type breakdown */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Output Type by Volume</h2>
        <OutputTypeGroupedBar metric={metric} loading={loading} data={outputTypeData} />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">Output Type Performance</h2>
        <DataTable
          columns={outputTableColumns}
          data={outputTypeData}
          loading={loading}
          total={outputTypeData.length}
          page={1}
          pageSize={10}
        />
      </motion.div>

      {/* Platform donut + impression gap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Platform Distribution</h2>
          <div style={{ height: 240 }}>
            <DonutChart
              data={platformData ?? [
                { name: 'YouTube Shorts', value: 1752, color: '#e63946' },
                { name: 'Instagram Reels', value: 1436, color: '#666666' },
              ]}
              centerValue={platformData ? `${Math.round((platformData[0]?.value ?? 0) / ((platformData[0]?.value ?? 0) + (platformData[1]?.value ?? 1)) * 100)}%` : '55%'}
              centerLabel={platformData?.[0]?.name?.split(' ')[0] ?? 'YouTube'}
              loading={loading}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <Youtube size={16} className="text-[#e63946] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">YouTube Shorts</p>
                <p className="text-base font-bold text-white tabular-nums">{(platformData?.[0]?.value ?? 1752).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
              <Instagram size={16} className="text-[#ff8fa3] flex-shrink-0" />
              <div>
                <p className="text-[10px] text-[#555] uppercase tracking-wide">Instagram Reels</p>
                <p className="text-base font-bold text-white tabular-nums">{(platformData?.[1]?.value ?? 1436).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
        >
          <h2 className="text-lg font-semibold text-white mb-4">Platform Impression Gap</h2>
          <HorizontalBarChart
            data={[
              { label: 'YouTube avg impressions', value: 18400, color: '#e63946' },
              { label: 'Instagram avg impressions', value: 11200, color: '#ff8fa3' },
              { label: 'YouTube avg CTR %', value: 7.2, scale: 1000, color: '#e63946' },
              { label: 'Instagram avg CTR %', value: 5.1, scale: 1000, color: '#ff8fa3' },
            ]}
            loading={loading}
          />
        </motion.div>
      </div>
    </div>
  )
}

function StorageMetrics({ loading, metric, workspaceHours = WORKSPACE_HOURS, weeklyHours = WEEKLY_HOURS }) {
  const totalHours = workspaceHours.reduce((s, w) => s + (w.hours || 0), 0)
  const totalCount = workspaceHours.reduce((s, w) => s + (w.count || 0), 0)
  const avgDuration = totalCount > 0 ? (totalHours / totalCount).toFixed(2) : '0.00'

  return (
    <div className="space-y-6">
      {/* Storage KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        {[
          {
            title: 'Total Storage Hours',
            value: totalHours,
            unit: 'h',
            trend: 'up',
            trendValue: null,
            trendLabel: 'vs last period',
            icon: Database,
            subtitle: 'Across all 5 workspaces',
            loading,
          },
          {
            title: 'Avg Duration Per Video',
            value: avgDuration,
            unit: 'h',
            trend: 'neutral',
            trendLabel: 'Stable',
            icon: Clock,
            subtitle: 'Per video average',
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

      {/* Workspace hours bar */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">
          Video Duration by Workspace ({metric === 'hours' ? 'Hours' : 'Count'})
        </h2>
        <HorizontalBarChart
          data={workspaceHours.map((w) => ({
            label: (w.name || w.workspace || '').replace('WS-', ''),
            value: metric === 'hours' ? (w.hours || 0) : (w.count || 0),
          }))}
          loading={loading}
          height={200}
        />
      </motion.div>

      {/* Weekly Hours Trend */}
      <motion.div
        className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-semibold text-white mb-4">
          Weekly Upload {metric === 'hours' ? 'Hours' : 'Count'}
        </h2>
        <WeeklyHoursChart data={weeklyHours} metric={metric} />
      </motion.div>
    </div>
  )
}

// ── Inline chart helpers ───────────────────────────────────────────────────────

function HorizontalBarChart({ data, loading, height = 240 }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    grid: { left: 12, right: 60, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#555', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.label).reverse(),
      axisLabel: { color: '#a0a0a0', fontSize: 10, width: 140, overflow: 'truncate' },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.value).reverse(),
        barMaxWidth: 22,
        label: {
          show: true,
          position: 'right',
          color: '#555',
          fontSize: 10,
          formatter: (p) => p.value?.toLocaleString(),
        },
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: (params) => data[data.length - 1 - params.dataIndex]?.color || {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#c62828' },
              { offset: 1, color: '#e63946' },
            ],
          },
        },
      },
    ],
  }

  if (loading) {
    return (
      <div className="animate-pulse" style={{ height }}>
        {[80, 65, 90, 55, 70].map((w, i) => (
          <div key={i} className="flex items-center gap-2 mb-3">
            <div className="w-24 h-3 bg-[#1f1f1f] rounded" />
            <div className="h-5 bg-[#1f1f1f] rounded" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

function OutputTypeGroupedBar({ metric, loading, data = MOCK_OUTPUT_TYPES }) {
  const types = data.map((o) => humanize(o.type))
  const totalVals = data.map((o) => o.total)
  const pubVals = data.map((o) => o.published)
  const lowestIdx = pubVals.indexOf(Math.min(...pubVals))

  const option = {
    backgroundColor: 'transparent',
    animation: true,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    legend: {
      data: ['Total', 'Published'],
      right: 8,
      top: 4,
      textStyle: { color: '#a0a0a0', fontSize: 11 },
    },
    grid: { left: 16, right: 16, top: 40, bottom: 48, containLabel: true },
    xAxis: {
      type: 'category',
      data: types,
      axisLabel: {
        color: '#a0a0a0',
        fontSize: 10,
        rotate: 20,
        interval: 0,
        overflow: 'truncate',
        width: 90,
      },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#555', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      {
        name: 'Total',
        type: 'bar',
        data: totalVals,
        barMaxWidth: 32,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#2a2a2a' },
      },
      {
        name: 'Published',
        type: 'bar',
        data: pubVals,
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params) => params.dataIndex === lowestIdx
            ? '#e63946'
            : '#666666',
        },
        markPoint: {
          data: [
            {
              name: 'Lowest',
              coord: [types[lowestIdx], pubVals[lowestIdx]],
              value: 'Lowest PCR',
              itemStyle: { color: '#e63946' },
              label: { color: '#fff', fontSize: 10 },
            },
          ],
        },
      },
    ],
  }

  if (loading) {
    return <div className="animate-pulse h-52 bg-[#1f1f1f] rounded-xl" />
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

function WeeklyHoursChart({ data, metric }) {
  const vals = data.map((d) => metric === 'hours' ? d.hours : d.count)
  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
    },
    grid: { left: 50, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.week),
      axisLabel: { color: '#555', fontSize: 11 },
      axisLine: { lineStyle: { color: '#1f1f1f' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#555', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: vals,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#e63946', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(230,57,70,0.3)' },
              { offset: 1, color: 'rgba(230,57,70,0)' },
            ],
          },
        },
        itemStyle: { color: '#e63946' },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      theme="dashboard-dark"
      style={{ height: 220, width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
    />
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: 'time', label: 'Time Analysis' },
  { id: 'category', label: 'Category Breakdown' },
  { id: 'storage', label: 'Storage Metrics' },
]

export default function UsageTrends() {
  const [activeSubTab, setActiveSubTab] = useState('time')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const filters = useStore((s) => s.filters)
  const metric = useStore((s) => s.metric)
  const comparePeriod = useStore((s) => s.comparePeriod)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDailyTrends(filters),
      getCategoryTrends(filters),
      getOutputTypeTrends(filters),
      getExecutiveSummary(filters),
      getPeriodComparison({ period_days: comparePeriod, ...filters }),
      getForecast(),  // intentionally no filters — sparse series hurt forecast quality
      getCrosstab({ d1: 'language', d2: 'input_type', metric: 'count' }).catch(() => ({ data: null })),
      getCrosstab({ d1: 'platform', d2: 'ai_output_type', metric: 'count' }).catch(() => ({ data: null })),
    ])
      .then(([daily, category, outputType, exec, comparison, forecast, langCrosstab, platformCrosstab]) => {
        setData({
          daily: daily.data,
          category: category.data,
          outputType: outputType.data,
          workspacePcr: exec.data?.workspace_pcr,
          comparison: comparison.data,
          forecast: forecast.data,
          langCrosstab: langCrosstab.data,
          platformCrosstab: platformCrosstab.data,
        })
        setLoading(false)
      })
      .catch((err) => {
        console.error('[UsageTrends] Data fetch failed:', err.message)
        setData({ daily: MOCK_DAILY, category: MOCK_CATEGORY, outputType: null, workspacePcr: null, comparison: null, forecast: null, langCrosstab: null, platformCrosstab: null })
        setError(`Failed to load data: ${err.message}`)
        setLoading(false)
      })
  }, [filters, comparePeriod])

  const dailyData = data?.daily || MOCK_DAILY
  const categoryData = data?.category ?? MOCK_CATEGORY
  const outputTypeData = data?.outputType ?? MOCK_OUTPUT_TYPES

  // Derive workspace hours from executive summary (total_hours field added in WS-8)
  const workspaceHours = data?.workspacePcr?.map((ws) => ({
    name: ws.workspace,
    hours: ws.total_hours || 0,
    count: ws.total,
  })) ?? WORKSPACE_HOURS

  // Derive language donut data from crosstab (sum all input_type cols per language row)
  const languageData = data?.langCrosstab
    ? data.langCrosstab.map((row, i) => {
        const total = Object.entries(row)
          .filter(([k]) => k !== 'd1_val')
          .reduce((s, [, v]) => s + Number(v || 0), 0)
        return { name: row.d1_val, value: total, color: i === 0 ? '#e63946' : '#666666' }
      })
    : [
        { name: 'English', value: 3290, color: '#e63946' },
        { name: 'Hindi', value: 1279, color: '#666666' },
      ]

  // Derive platform donut data from crosstab (sum all output_type cols per platform row)
  const platformData = data?.platformCrosstab
    ? data.platformCrosstab.map((row, i) => {
        const total = Object.entries(row)
          .filter(([k]) => k !== 'd1_val')
          .reduce((s, [, v]) => s + Number(v || 0), 0)
        return { name: row.d1_val, value: total, color: i === 0 ? '#e63946' : '#666666' }
      })
    : [
        { name: 'YouTube Shorts', value: 1752, color: '#e63946' },
        { name: 'Instagram Reels', value: 1436, color: '#666666' },
      ]

  // Aggregate daily data into weekly buckets (groups of 7 days)
  const weeklyHours = React.useMemo(() => {
    const weeks = []
    for (let w = 0; w < Math.ceil(dailyData.length / 7); w++) {
      const slice = dailyData.slice(w * 7, w * 7 + 7)
      weeks.push({
        week: `W${w + 1}`,
        hours: +slice.reduce((s, d) => s + (d.uploaded_hours || 0), 0).toFixed(1),
        count: slice.reduce((s, d) => s + (d.uploaded || 0), 0),
      })
    }
    return weeks.length ? weeks : WEEKLY_HOURS
  }, [dailyData])

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Usage &amp; Trends</h1>
        <p className="text-sm text-[#a0a0a0]">90-day upload and publish activity across all workspaces</p>
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

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-2 p-1 bg-[#111111] border border-[#1f1f1f] rounded-2xl w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={[
              'px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 select-none',
              activeSubTab === tab.id
                ? 'bg-[#e63946] text-white shadow-[0_0_12px_rgba(230,57,70,0.3)]'
                : 'text-[#555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]',
            ].join(' ')}
          >
            {tab.label}
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
          {activeSubTab === 'time' && (
            <TimeAnalysis dailyData={dailyData} categoryData={categoryData} forecastData={data?.forecast} loading={loading} metric={metric} comparison={data?.comparison} languageData={languageData} />
          )}
          {activeSubTab === 'category' && (
            <CategoryBreakdown loading={loading} metric={metric} outputTypeData={outputTypeData} platformData={platformData} />
          )}
          {activeSubTab === 'storage' && (
            <StorageMetrics loading={loading} metric={metric} workspaceHours={workspaceHours} weeklyHours={weeklyHours} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
