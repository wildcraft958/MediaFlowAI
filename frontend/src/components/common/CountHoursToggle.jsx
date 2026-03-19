/**
 * CountHoursToggle — pill toggle between COUNT and HOURS modes
 *
 * Props:
 *   className (string) — extra Tailwind classes
 *
 * Reads/writes `metric` from useStore ('count' | 'hours')
 */

import React, { useRef } from 'react'
import { motion } from 'framer-motion'
import { Hash, Clock } from 'lucide-react'
import useStore from '../../store/useStore'

const OPTIONS = [
  { value: 'count', label: 'COUNT', icon: Hash },
  { value: 'hours', label: 'HOURS', icon: Clock },
]

export default function CountHoursToggle({ className = '' }) {
  const metric = useStore((s) => s.metric ?? 'count')
  const setMetric = useStore((s) => s.setMetric)

  const activeIndex = OPTIONS.findIndex((o) => o.value === metric)

  return (
    <div
      className={`relative inline-flex items-center bg-[#111111] border border-[#2a2a2a] rounded-full p-0.5 gap-0 ${className}`}
      style={{ height: 32 }}
    >
      {/* Sliding active pill */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-[#e63946]"
        style={{ width: 'calc(50% - 2px)' }}
        animate={{ x: activeIndex === 0 ? 2 : 'calc(100% + 2px)' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
      />

      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = metric === value
        return (
          <button
            key={value}
            onClick={() => setMetric(value)}
            className={[
              'relative z-10 inline-flex items-center gap-1 px-3 h-full rounded-full',
              'text-[11px] font-semibold tracking-widest transition-colors duration-200 select-none',
              isActive ? 'text-white' : 'text-[#555555] hover:text-[#a0a0a0]',
            ].join(' ')}
          >
            <Icon size={11} strokeWidth={2.5} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
