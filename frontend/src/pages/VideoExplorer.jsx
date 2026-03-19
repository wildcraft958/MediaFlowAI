/**
 * VideoExplorer.jsx — Tab 5: Video Explorer
 * Searchable, filterable DataTable of all videos with ZSP scoring + CSV export
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Download, Youtube, Instagram, AlertTriangle, ChevronDown,
} from 'lucide-react'
import DataTable from '../components/common/DataTable'
import Badge from '../components/common/Badge'
import useStore from '../store/useStore'
import { getVideos, exportVideos } from '../api/client'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKSPACES = ['WS-DIGITAL-NEWS', 'WS-ENTERTAINMENT', 'WS-TECH-ANALYSIS', 'WS-LIFESTYLE', 'WS-SPORTS-LIVE']
const INPUT_TYPES = ['interview', 'speech', 'debate', 'news_bulletin', 'special_report', 'press_conference', 'discussion_show']
const OUTPUT_TYPES = ['key_moments', 'chapters', 'full_package', 'summary', 'my_key_moments']
const TEAMS = ['Digital_News', 'Entertainment', 'Tech_Analysis', 'Sports_Live', 'Lifestyle']

const HEADLINES = [
  'Breaking: Tech Giants Face New Regulations Amid Privacy Concerns',
  'Exclusive Interview: CEO on Market Expansion Strategy',
  'Sports Analysis: Championship Preview - Key Players to Watch',
  'Special Report: Climate Policy Update from the Summit',
  'Press Conference: Minister Addresses Economic Policy Changes',
  'Debate Recap: Opposition vs Government on Healthcare Bill',
  'News Bulletin: Stock Market Hits Record High After Fed Meeting',
  'Discussion: Future of AI in Indian Media Landscape',
  'Interview: Award-Winning Director on Latest Documentary',
  'Speech: President Addresses National Assembly on Defense',
  'Breaking: Election Results Live Coverage and Analysis',
  'Special Feature: Inside the World of Investigative Journalism',
  'Sports Live: Match Commentary - Final Quarter Highlights',
  'Tech Analysis: 5G Rollout Progress Across 10 Major Cities',
  'Lifestyle: Wellness Trends Shaping Urban India in 2025',
  'Press Briefing: Central Bank Announces New Monetary Policy',
  'Exclusive: Whistleblower Exposes Corporate Fraud Scandal',
  'Interview: Oscar Nominee on the Art of Screenwriting',
  'News Update: Flooding Crisis - Rescue Operations Underway',
  'Panel Discussion: Women in Leadership Across Industries',
]

// ── Mock Data Generator ────────────────────────────────────────────────────────

const wsTeamMap = {
  'WS-DIGITAL-NEWS':  { team: 'Digital_News',  users: ['content_editor_01', 'content_editor_02'] },
  'WS-ENTERTAINMENT': { team: 'Entertainment', users: ['content_editor_02'] },
  'WS-TECH-ANALYSIS': { team: 'Tech_Analysis', users: ['content_editor_03'] },
  'WS-LIFESTYLE':     { team: 'Lifestyle',     users: ['content_editor_03'] },
  'WS-SPORTS-LIVE':   { team: 'Sports_Live',   users: ['content_editor_04'] },
}
const wsPublishRate = {
  'WS-DIGITAL-NEWS': 0.92, 'WS-ENTERTAINMENT': 0.82, 'WS-TECH-ANALYSIS': 0.68,
  'WS-LIFESTYLE': 0.52, 'WS-SPORTS-LIVE': 0.38,
}

function generateMockVideos(count = 4569) {
  const videos = []
  for (let i = 0; i < count; i++) {
    const ws = WORKSPACES[i % WORKSPACES.length]
    const wsInfo = wsTeamMap[ws]
    const inputType = INPUT_TYPES[Math.floor((i * 3 + 7) % INPUT_TYPES.length)]
    const outputType = OUTPUT_TYPES[Math.floor((i * 2 + 3) % OUTPUT_TYPES.length)]
    const user = wsInfo.users[i % wsInfo.users.length]
    const isPublished = ((i * 17 + 5) % 100) < wsPublishRate[ws] * 100
    const platform = isPublished ? (i % 2 === 0 ? 'Youtube' : 'Instagram') : null
    const durationMin = 3 + ((i * 13) % 42)
    const durationSec = (i * 7) % 60
    const durationH = Math.floor(durationMin / 60)
    const durationM = durationMin % 60
    const zsp = +(((i * 1.618 + 0.5) % 6) - 3).toFixed(2)
    const baseDate = new Date('2025-09-01')
    baseDate.setDate(baseDate.getDate() + Math.floor(i / 50))
    const uploadDate = isPublished || i % 12 !== 0 ? baseDate.toISOString().slice(0, 10) : null

    videos.push({
      id: `V${String(i + 1).padStart(5, '0')}`,
      headline: HEADLINES[i % HEADLINES.length],
      workspace: ws,
      inputType,
      outputType,
      durationMin,
      durationSec,
      durationH,
      durationM,
      published: isPublished,
      platform,
      uploadedBy: user,
      uploadDate,
      zsp,
      team: wsInfo.team,
      language: i % 4 === 0 ? 'Hindi' : 'English',
    })
  }
  return videos
}

// Mock videos kept only as export fallback; server-side data is primary source

// ── Helper components ─────────────────────────────────────────────────────────

function formatDuration(h, m, s) {
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(s).padStart(2, '0')}`
}

function ZSPBadge({ value }) {
  if (value >= 1.5)
    return <span className="font-bold tabular-nums text-[#4caf50]">{value > 0 ? '+' : ''}{value.toFixed(2)}</span>
  if (value <= -1.5)
    return <span className="font-bold tabular-nums text-[#e63946]">{value.toFixed(2)}</span>
  return <span className="tabular-nums text-[#a0a0a0]">{value > 0 ? '+' : ''}{value.toFixed(2)}</span>
}

function PlatformCell({ platform }) {
  if (!platform) return <span className="text-[#333]">-</span>
  if (platform === 'Youtube')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[#e63946]">
        <Youtube size={12} />Shorts
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#ff8fa3]">
      <Instagram size={12} />Reels
    </span>
  )
}

function FilterSelect({ placeholder, value, options, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[#111111] border border-[#1f1f1f] text-xs text-[#a0a0a0] rounded-xl px-3 py-2 pr-7 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors cursor-pointer min-w-[130px]"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
        ))}
      </select>
      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10
const SUB_TABS = ['All Media', 'Archived', 'Trash']

export default function VideoExplorer() {
  const [activeSubTab, setActiveSubTab] = useState('All Media')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterWs, setFilterWs] = useState('')
  const [filterInput, setFilterInput] = useState('')
  const [filterOutput, setFilterOutput] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [sortState, setSortState] = useState({ key: null, dir: 'asc' })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [apiData, setApiData] = useState(null)
  const filters = useStore((s) => s.filters)

  useEffect(() => {
    setLoading(true)
    getVideos({
      ...filters,
      page,
      limit: PAGE_SIZE,
      search: search.trim() || undefined,
      workspace: filterWs || undefined,
      input_type: filterInput || undefined,
      output_type: filterOutput || undefined,
      team: filterTeam || undefined,
    })
      .then((res) => setApiData(res.data))
      .catch(() => setApiData(null))
      .finally(() => setLoading(false))
  }, [filters, page, search, filterWs, filterInput, filterOutput, filterTeam])

  const pageData = apiData?.data ?? []
  const totalCount = apiData?.total ?? 0

  const handleSort = useCallback((s) => { setSortState(s); setPage(1) }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportVideos({ workspace: filterWs, input_type: filterInput })
    } catch {
      // Fallback: generate CSV from filtered data
      const headers = ['ID', 'Headline', 'Workspace', 'Input Type', 'Output Type', 'Published', 'Platform', 'Uploaded By', 'Upload Date', 'ZSP Score']
      const rows = pageData.map((v) =>
        [v.id, `"${v.headline}"`, v.workspace, v.inputType, v.outputType,
         v.published ? 'Yes' : 'No', v.platform || '-', v.uploadedBy, v.uploadDate || '-', v.zsp].join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'frammer_videos.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'headline',
      label: 'Video Headline',
      sortable: true,
      width: 280,
      render: (v, row) => (
        <div className="max-w-[260px]">
          <p className="text-xs font-medium text-white truncate" title={v}>
            {v.length > 44 ? v.slice(0, 41) + '…' : v}
          </p>
          <p className="text-[10px] text-[#555] mt-0.5 font-mono">{row.id}</p>
        </div>
      ),
    },
    {
      key: 'workspace',
      label: 'Workspace',
      sortable: true,
      render: (v) => <Badge variant="workspace">{v}</Badge>,
    },
    {
      key: 'inputType',
      label: 'Input Type',
      sortable: true,
      render: (v) => <Badge variant="neutral">{v.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'outputType',
      label: 'Output Type',
      sortable: true,
      render: (v) => (
        <Badge variant={['key_moments', 'full_package'].includes(v) ? 'enhanced' : 'neutral'}>
          {v.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'durationMin',
      label: 'Duration',
      sortable: true,
      render: (v, row) => (
        <span className="text-xs tabular-nums text-[#a0a0a0]">
          {formatDuration(row.durationH, row.durationM, row.durationSec)}
        </span>
      ),
    },
    {
      key: 'published',
      label: 'Published',
      sortable: true,
      render: (v) => <Badge variant={v ? 'success' : 'danger'}>{v ? 'Yes' : 'No'}</Badge>,
    },
    {
      key: 'platform',
      label: 'Platform',
      render: (v) => <PlatformCell platform={v} />,
    },
    {
      key: 'uploadedBy',
      label: 'Uploaded By',
      sortable: true,
      render: (v) => <span className="text-xs font-mono text-[#ff8fa3]">{v}</span>,
    },
    {
      key: 'uploadDate',
      label: 'Upload Date',
      sortable: true,
      render: (v) => (
        <span className="text-xs tabular-nums">
          {v ? (
            <span className="text-[#555]">{v}</span>
          ) : (
            <span className="text-[#e63946]">missing</span>
          )}
        </span>
      ),
    },
    {
      key: 'zsp',
      label: 'ZSP Score',
      sortable: true,
      render: (v) => <ZSPBadge value={v} />,
    },
  ]

  const hasActiveFilters = search || filterWs || filterInput || filterOutput || filterTeam

  return (
    <motion.div
      className="p-6 space-y-6 min-h-screen bg-[#0a0a0a]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Video Explorer</h1>
        <p className="text-sm text-[#a0a0a0]">
          Browse, search, and export 4,569 videos across 5 workspaces
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#111111] border border-[#1f1f1f] rounded-xl w-fit">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={[
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 select-none',
              activeSubTab === tab
                ? 'bg-[#e63946] text-white'
                : 'text-[#555] hover:text-[#a0a0a0] hover:bg-[#1a1a1a]',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filter + Search row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input
            type="text"
            placeholder="Search by video ID, headline..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full bg-[#111111] border border-[#1f1f1f] text-xs text-white placeholder-[#555] rounded-xl pl-8 pr-4 py-2 focus:outline-none focus:border-[#e63946]/50 hover:border-[#333] transition-colors"
          />
        </div>

        <FilterSelect placeholder="Workspace" value={filterWs} options={WORKSPACES}
          onChange={(v) => { setFilterWs(v); setPage(1) }} />
        <FilterSelect placeholder="Input Type" value={filterInput} options={INPUT_TYPES}
          onChange={(v) => { setFilterInput(v); setPage(1) }} />
        <FilterSelect placeholder="Output Type" value={filterOutput} options={OUTPUT_TYPES}
          onChange={(v) => { setFilterOutput(v); setPage(1) }} />
        <FilterSelect placeholder="Team" value={filterTeam} options={TEAMS}
          onChange={(v) => { setFilterTeam(v); setPage(1) }} />
        <FilterSelect placeholder="Date Range" value={filterDate}
          options={['Last 7 days', 'Last 30 days', 'Last 90 days', 'All time']}
          onChange={(v) => { setFilterDate(v); setPage(1) }} />

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch(''); setFilterWs(''); setFilterInput('');
              setFilterOutput(''); setFilterTeam(''); setFilterDate(''); setPage(1)
            }}
            className="text-xs text-[#e63946] border border-[#e63946]/30 px-3 py-2 rounded-xl hover:bg-[#e63946]/10 transition-colors"
          >
            Clear all
          </button>
        )}

        {/* Export CSV */}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e63946] text-white text-xs font-semibold hover:bg-[#c62828] transition-colors disabled:opacity-60"
        >
          <Download size={13} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-[#555]">
        <span>
          <span className="text-white font-semibold">{totalCount.toLocaleString()}</span>
          {' '}videos{hasActiveFilters && ' (filtered)'}
        </span>
        <span>·</span>
        <span>
          <span className="text-[#4caf50] font-semibold">
            {pageData.filter((v) => v.published).length.toLocaleString()}
          </span> published (this page)
        </span>
        <span>·</span>
        <span>
          <span className="text-[#e63946] font-semibold">
            {pageData.filter((v) => !v.uploadDate).length.toLocaleString()}
          </span> missing upload_date (this page)
        </span>
        {hasActiveFilters && (
          <>
            <span>·</span>
            <span className="text-[#ff8fa3]">Filters active</span>
          </>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={pageData}
        loading={loading}
        total={totalCount}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => setPage(p)}
        onSort={handleSort}
      />

      {/* ZSP Legend */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-[#111111] border border-[#1f1f1f] rounded-2xl">
        <span className="text-xs text-[#555] uppercase tracking-wide font-semibold">ZSP Legend</span>
        <span className="w-px h-4 bg-[#1f1f1f]" />
        <span className="inline-flex items-center gap-1.5 text-xs text-[#e63946]">
          <span className="w-3 h-3 rounded-sm bg-[#e63946]" />
          ≤ −1.5 Underperforming
        </span>
        <span className="text-[#333]">·</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-[#a0a0a0]">
          <span className="w-3 h-3 rounded-sm bg-[#444]" />
          −1.5 to +1.5 Normal range
        </span>
        <span className="text-[#333]">·</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-[#4caf50]">
          <span className="w-3 h-3 rounded-sm bg-[#4caf50]" />
          ≥ +1.5 Outperforming
        </span>
        <span className="w-px h-4 bg-[#1f1f1f] ml-2" />
        <span className="text-xs text-[#555]">
          ZSP = Z-Score Performance (view-hours vs workspace mean)
        </span>
      </div>

      {/* Data quality note */}
      <div className="flex items-start gap-2 p-3 rounded-xl border border-[#ff9800]/20 bg-[#ff9800]/05">
        <AlertTriangle size={13} className="text-[#ff9800] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#a0a0a0]">
          <span className="text-[#ff9800] font-semibold">390 videos</span>{' '}
          have no upload_date (shown as "missing" in red). These are included in total counts but
          excluded from funnel stage 1 and OPI calculations. Primarily affects WS-SPORTS-LIVE.
        </p>
      </div>
    </motion.div>
  )
}
