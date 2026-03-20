/**
 * DraggableChart — thin wrapper that makes any chart section draggable
 * into the NLQ panel's ChartDropZone.
 *
 * Usage:
 *   <DraggableChart title="PCR by Workspace" data={workspaces}>
 *     <ReactECharts ... />
 *   </DraggableChart>
 */

import React, { useState } from 'react'
import { GripVertical } from 'lucide-react'

export default function DraggableChart({ title, data, children, className = '' }) {
  const [hovering, setHovering] = useState(false)

  const handleDragStart = (e) => {
    const payload = { title: title || 'Chart', data: data ?? null }
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`relative cursor-grab active:cursor-grabbing ${className}`}
    >
      {hovering && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#1a1a1a]/90 border border-[#2a2a2a] text-[#555] pointer-events-none">
          <GripVertical size={10} />
          <span className="text-[9px] uppercase tracking-wide">Drag to AI</span>
        </div>
      )}
      {children}
    </div>
  )
}
