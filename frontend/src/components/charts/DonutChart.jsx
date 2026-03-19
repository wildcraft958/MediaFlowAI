/**
 * DonutChart — ECharts donut/ring chart with center label
 *
 * @param {object}   props
 * @param {Array}    props.data         - Array of { name, value, color? }
 * @param {string}   [props.title]      - Chart section title (rendered outside)
 * @param {string}   [props.centerLabel] - Small gray label under the big value
 * @param {string|number} [props.centerValue] - Big white number in the center
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

const DEFAULT_COLORS = ['#e63946', '#666666', '#444444', '#ff8fa3', '#2a2a2a', '#888888']

function Skeleton() {
  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center animate-pulse">
      <div className="relative">
        <div className="w-36 h-36 rounded-full border-[16px] border-[#1f1f1f]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-8 bg-[#1f1f1f] rounded" />
        </div>
      </div>
    </div>
  )
}

export default function DonutChart({
  data = [],
  title,
  centerLabel,
  centerValue,
  loading = false,
}) {
  const option = useMemo(() => {
    const total = data.reduce((s, d) => s + (d.value || 0), 0)

    const seriesData = data.map((item, idx) => ({
      name: item.name,
      value: item.value,
      itemStyle: {
        color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#111111',
      },
    }))

    // Build center graphic (two-line label)
    const graphicElements = []
    // Offset the two center labels so they don't overlap:
    // value sits 12px above center, label sits 10px below
    const bothPresent = centerValue != null && centerLabel
    if (centerValue != null) {
      graphicElements.push({
        type: 'text',
        left: 'center',
        top: bothPresent ? '42%' : 'center',
        style: {
          text: String(centerValue),
          fill: '#ffffff',
          font: 'bold 24px Inter, sans-serif',
          textAlign: 'center',
          textVerticalAlign: 'middle',
        },
        z: 10,
      })
    }
    if (centerLabel) {
      graphicElements.push({
        type: 'text',
        left: 'center',
        top: bothPresent ? '58%' : 'center',
        style: {
          text: centerLabel,
          fill: '#a0a0a0',
          font: '11px Inter, sans-serif',
          textAlign: 'center',
          textVerticalAlign: 'middle',
        },
        z: 10,
      })
    }

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 800,
      graphic: graphicElements,
      legend: {
        show: true,
        bottom: 4,
        type: 'scroll',
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
        textStyle: { color: '#a0a0a0', fontSize: 11 },
        inactiveColor: '#333',
        pageTextStyle: { color: '#555555' },
        pageIconColor: '#666666',
        pageIconInactiveColor: '#333',
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const pct = total > 0 ? ((params.value / total) * 100).toFixed(1) : '0.0'
          return `
            <div style="font-weight:600;margin-bottom:2px">${params.name}</div>
            <div>Count: <b>${params.value?.toLocaleString()}</b></div>
            <div>Share: <b>${pct}%</b></div>
          `
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '72%'],
          center: ['50%', '46%'],
          data: seriesData,
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: 'rgba(230, 57, 70, 0.4)',
            },
          },
          selectedMode: false,
        },
      ],
    }
  }, [data, centerLabel, centerValue])

  if (loading) return <Skeleton />

  return (
    <div className="w-full h-full flex flex-col">
      {title && (
        <p className="text-xs font-medium text-[#a0a0a0] uppercase tracking-wide mb-1 px-1">
          {title}
        </p>
      )}
      <div className="flex-1 w-full">
        <ReactECharts
          option={option}
          theme="dashboard-dark"
          style={chartStyle}
          opts={opts}
          notMerge
        />
      </div>
    </div>
  )
}
