/**
 * FilterBar — pill-style multi-filter bar with animated dropdowns
 *
 * Props:
 *   onChange  (fn)     — called with the full filters object on any change
 *   className (string) — extra Tailwind classes
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Layers,
  Users,
  Globe,
  FileVideo,
  Package,
  CalendarDays,
  X,
  Check,
} from 'lucide-react'
import useStore from '../../store/useStore'

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------
const WORKSPACE_OPTIONS = [
  'WS-DIGITAL-NEWS',
  'WS-ENTERTAINMENT',
  'WS-TECH-ANALYSIS',
  'WS-LIFESTYLE',
  'WS-SPORTS-LIVE',
]

const LANGUAGE_OPTIONS = ['English', 'Hindi']

const INPUT_TYPE_OPTIONS = [
  'interview',
  'speech',
  'debate',
  'news_bulletin',
  'special_report',
  'press_conference',
  'discussion_show',
]

const OUTPUT_TYPE_OPTIONS = [
  'key_moments',
  'chapters',
  'full_package',
  'summary',
  'my_key_moments',
]

const DATE_RANGE_OPTIONS = [
  'Last 7 days',
  'Last 30 days',
  'Last 90 days',
  'Custom range',
]

// Filter definitions — each describes one pill
const FILTER_DEFS = [
  {
    key: 'workspace',
    label: 'Workspace',
    icon: Layers,
    options: WORKSPACE_OPTIONS,
    multi: true,
  },
  {
    key: 'team',
    label: 'Team',
    icon: Users,
    options: [
      'Digital_News',
      'Entertainment',
      'Tech_Analysis',
      'Sports_Live',
      'Lifestyle',
    ],
    multi: true,
  },
  {
    key: 'language',
    label: 'Language',
    icon: Globe,
    options: LANGUAGE_OPTIONS,
    multi: false, // radio
  },
  {
    key: 'inputType',
    label: 'Input Type',
    icon: FileVideo,
    options: INPUT_TYPE_OPTIONS,
    multi: true,
  },
  {
    key: 'outputType',
    label: 'Output Type',
    icon: Package,
    options: OUTPUT_TYPE_OPTIONS,
    multi: true,
  },
  {
    key: 'dateRange',
    label: 'Date Range',
    icon: CalendarDays,
    options: DATE_RANGE_OPTIONS,
    multi: false, // radio
  },
]

// ---------------------------------------------------------------------------
// Dropdown animation variants
// ---------------------------------------------------------------------------
const dropdownVariants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: -6,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
}

// ---------------------------------------------------------------------------
// FilterPill — a single dropdown pill
// ---------------------------------------------------------------------------
function FilterPill({ def, value, onChange }) {
  const [open, setOpen] = useState(false)
  const pillRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (pillRef.current && !pillRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const Icon = def.icon

  // Determine if any value is selected
  const hasValue = def.multi
    ? Array.isArray(value) && value.length > 0
    : Boolean(value)

  // Active label summary
  const activeLabel = () => {
    if (!hasValue) return null
    if (def.multi) {
      if (value.length === 1) return value[0]
      return `${value.length} selected`
    }
    return value
  }

  const handleMultiToggle = (option) => {
    const current = Array.isArray(value) ? value : []
    if (current.includes(option)) {
      onChange(current.filter((v) => v !== option))
    } else {
      onChange([...current, option])
    }
  }

  const handleRadioSelect = (option) => {
    onChange(value === option ? null : option)
    setOpen(false)
  }

  return (
    <div ref={pillRef} className="relative">
      {/* Pill button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={[
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
          'border transition-all duration-150 select-none whitespace-nowrap',
          hasValue
            ? 'bg-[#e63946] border-[#e63946] text-white'
            : 'bg-[#111111] border-[#2a2a2a] text-[#a0a0a0] hover:border-[#e63946]/50 hover:text-white',
        ].join(' ')}
      >
        <Icon size={12} />
        <span>{hasValue ? activeLabel() : def.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute top-full left-0 mt-2 z-50 min-w-[180px] bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-xl shadow-black/60 overflow-hidden"
            style={{ transformOrigin: 'top left' }}
          >
            <div className="py-1.5 max-h-64 overflow-y-auto">
              {def.options.map((option) => {
                const isChecked = def.multi
                  ? Array.isArray(value) && value.includes(option)
                  : value === option

                return (
                  <button
                    key={option}
                    onClick={() =>
                      def.multi
                        ? handleMultiToggle(option)
                        : handleRadioSelect(option)
                    }
                    className={[
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors duration-100',
                      isChecked
                        ? 'text-white bg-[#e63946]/10'
                        : 'text-[#a0a0a0] hover:text-white hover:bg-[#1a1a1a]',
                    ].join(' ')}
                  >
                    {/* Checkbox / radio indicator */}
                    <span
                      className={[
                        'flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors duration-100',
                        def.multi ? 'rounded-sm' : 'rounded-full',
                        isChecked
                          ? 'bg-[#e63946] border-[#e63946]'
                          : 'border-[#2a2a2a]',
                      ].join(' ')}
                    >
                      {isChecked && <Check size={10} className="text-white" />}
                    </span>
                    <span className="capitalize truncate">
                      {option.replace(/_/g, ' ')}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------
export default function FilterBar({ onChange, className = '' }) {
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)

  // Check if any filter is active
  const hasAnyFilter = FILTER_DEFS.some((def) => {
    const v = filters?.[def.key]
    return def.multi ? Array.isArray(v) && v.length > 0 : Boolean(v)
  })

  const handleChange = useCallback(
    (key, newValue) => {
      const updated = { ...(filters || {}), [key]: newValue }
      setFilters(updated)
      onChange?.(updated)
    },
    [filters, setFilters, onChange]
  )

  const handleClearAll = () => {
    const cleared = {}
    FILTER_DEFS.forEach((def) => {
      cleared[def.key] = def.multi ? [] : null
    })
    setFilters(cleared)
    onChange?.(cleared)
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {FILTER_DEFS.map((def) => (
        <FilterPill
          key={def.key}
          def={def}
          value={filters?.[def.key] ?? (def.multi ? [] : null)}
          onChange={(v) => handleChange(def.key, v)}
        />
      ))}

      {/* Clear All button */}
      <AnimatePresence>
        {hasAnyFilter && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#e63946] border border-[#e63946]/30 hover:bg-[#e63946]/10 transition-colors duration-150"
          >
            <X size={11} />
            Clear All
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
