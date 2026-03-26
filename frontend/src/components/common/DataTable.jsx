/**
 * DataTable — feature-rich sortable paginated table for dark dashboards
 *
 * Props:
 *   columns      [{ key, label, sortable?, render?, width? }]
 *   data         array of row objects
 *   loading      bool
 *   onSort       fn({ key, dir: 'asc'|'desc' })
 *   onPageChange fn(page)
 *   total        number — total record count
 *   page         number — current page (1-indexed)
 *   pageSize     number — rows per page (default 10)
 *   onRowClick   fn(row) — if provided, rows show pointer cursor
 *   showExport   bool   — show CSV export button (default false)
 *   className    string
 */

import React, { useState, useMemo } from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Database,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------
function SkeletonRow({ cols }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3 bg-[#1f1f1f] rounded"
            style={{ width: `${50 + Math.random() * 40}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------
function SortIcon({ active, dir }) {
  if (!active)
    return <ChevronsUpDown size={13} className="text-[#333333] flex-shrink-0" />
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-white flex-shrink-0" />
  ) : (
    <ChevronDown size={13} className="text-white flex-shrink-0" />
  )
}

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------
function exportCSV(columns, data) {
  const headers = columns.map((c) => c.label).join(',')
  const rows = data
    .map((row) =>
      columns
        .map((c) => {
          const v = row[c.key]
          const str = v == null ? '' : String(v)
          // Escape commas and quotes
          return str.includes(',') || str.includes('"')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    )
    .join('\n')
  const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
function Pagination({ page, total, pageSize, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = Math.min((page - 1) * pageSize + 1, total)
  const end = Math.min(page * pageSize, total)

  // Build visible page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i)
    }

    if (page - delta > 2) range.unshift('...')
    if (page + delta < totalPages - 1) range.push('...')

    rangeWithDots.push(1)
    range.forEach((v) => rangeWithDots.push(v))
    if (totalPages > 1) rangeWithDots.push(totalPages)

    return rangeWithDots
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-[#1f1f1f] gap-2">
      <span className="text-xs text-[#555555]">
        {total === 0 ? 'No records' : `Showing ${start}–${end} of ${total}`}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555555] hover:text-white hover:bg-[#1f1f1f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} className="px-1 text-[#555555] text-xs">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={[
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-medium transition-colors',
                p === page
                  ? 'bg-[#e63946] text-white'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#1f1f1f]',
              ].join(' ')}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555555] hover:text-white hover:bg-[#1f1f1f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  onSort,
  onPageChange,
  total = 0,
  page = 1,
  pageSize = 10,
  onRowClick,
  showExport = false,
  className = '',
}) {
  const [sortState, setSortState] = useState({ key: null, dir: 'asc' })

  const handleSort = (col) => {
    if (!col.sortable) return
    const newDir =
      sortState.key === col.key && sortState.dir === 'asc' ? 'desc' : 'asc'
    const next = { key: col.key, dir: newDir }
    setSortState(next)
    if (onSort) onSort(next)
  }

  // Client-side sort: always sort locally so tables work even without onSort
  const sortedData = useMemo(() => {
    if (!sortState.key) return data
    return [...data].sort((a, b) => {
      const av = a[sortState.key], bv = b[sortState.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sortState.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sortState])

  const effectiveTotal = total || data.length

  return (
    <div
      className={`bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden flex flex-col ${className}`}
    >
      {/* Optional top bar with export */}
      {showExport && (
        <div className="flex items-center justify-end px-4 pt-3 pb-0">
          <button
            onClick={() => exportCSV(columns, data)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#a0a0a0] border border-[#2a2a2a] hover:text-white hover:border-[#e63946]/40 transition-colors"
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      )}

      {/* Scrollable table area */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full border-collapse min-w-full">
          {/* Sticky header */}
          <thead className="sticky top-0 z-10 bg-[#0d0d0d]">
            <tr className="border-b border-[#1f1f1f]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  style={{ width: col.width }}
                  className={[
                    'px-4 py-3 text-left text-[11px] font-semibold text-[#555555] uppercase tracking-widest whitespace-nowrap',
                    col.sortable
                      ? 'cursor-pointer select-none hover:text-[#a0a0a0] transition-colors'
                      : '',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <SortIcon
                        active={sortState.key === col.key}
                        dir={sortState.dir}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Loading state */}
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={`sk-${i}`} cols={columns.length} />
              ))}

            {/* Empty state */}
            {!loading && sortedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#1f1f1f] flex items-center justify-center">
                      <Database size={22} className="text-[#333333]" />
                    </div>
                    <p className="text-sm text-[#555555] font-medium">
                      No data found
                    </p>
                    <p className="text-xs text-[#333333]">
                      Try adjusting your filters
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!loading &&
              sortedData.map((row, rowIdx) => (
                <tr
                  key={row.id ?? rowIdx}
                  onClick={() => onRowClick?.(row)}
                  className={[
                    'border-b border-[#1f1f1f]/60 transition-colors duration-100',
                    rowIdx % 2 === 0
                      ? 'bg-transparent'
                      : 'bg-[#ffffff]/[0.015]',
                    onRowClick
                      ? 'cursor-pointer hover:bg-[#e63946]/5'
                      : 'hover:bg-[#1a1a1a]',
                  ].join(' ')}
                  style={{ height: 48 }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 text-sm text-[#a0a0a0] whitespace-nowrap"
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && effectiveTotal > 0 && onPageChange && (
        <Pagination
          page={page}
          total={effectiveTotal}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
