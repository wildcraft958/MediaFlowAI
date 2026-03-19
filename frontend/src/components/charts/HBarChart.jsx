/**
 * HBarChart — horizontal bar chart (sorted, with optional % labels)
 *
 * @param {object}   props
 * @param {Array}    props.data          - Array of { name, value, pct? }
 * @param {'value'|string} [props.metric='value']
 * @param {boolean}  [props.loading=false]
 * @param {string}   [props.title]       - Section title
 * @param {boolean}  [props.colorByIndex=false] - Use COLORS palette vs single accent
 */

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

const COLORS = ['#e63946', '#666666', '#444444', '#ff8fa3', '#2a2a2a', '#888888']

function Skeleton({ rows = 5 }) {
  return (
    <div className="w-full h-full min-h-[200px] animate-pulse flex flex-col justify-around py-3 px-3 gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 h-3 bg-[#1f1f1f] rounded flex-shrink-0" />
          <div
            className="h-4 bg-[#1f1f1f] rounded-r"
            style={{ width: `${40 + Math.floor(Math.random() * 40)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

export default function HBarChart({
  data = [],
  metric = 'value',
  loading = false,
  title,
  colorByIndex = false,
}) {
  const option = useMemo(() => {
    // Sort descending by value
    const sorted = [...data].sort((a, b) => (b.value || 0) - (a.value || 0))

    const names = sorted.map((d) => d.name)
    const values = sorted.map((d) => d.value || 0)
    const pcts = sorted.map((d) => d.pct)

    const barData = sorted.map((d, i) => ({
      value: d.value || 0,
      itemStyle: {
        color: colorByIndex
          ? COLORS[i % COLORS.length]
          : {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#e63946' + 'cc' },
                { offset: 1, color: '#e63946' },
              ],
            },
        borderRadius: [0, 4, 4, 0],
      },
    }))

    const hasAnyPct = pcts.some((p) => p != null)

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 600,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const p = params[0]
          if (!p) return ''
          const idx = p.dataIndex
          const pctStr = pcts[idx] != null ? ` (${pcts[idx]})` : ''
          return `<b>${p.name}</b><br/>${p.value?.toLocaleString()}${pctStr}`
        },
      },
      grid: {
        left: 120,
        right: hasAnyPct ? 60 : 20,
        top: title ? 32 : 10,
        bottom: 10,
        containLabel: false,
      },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
        axisLabel: { color: '#555555', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: names,
        inverse: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
          width: 110,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'bar',
          data: barData,
          barMaxWidth: 24,
          label: hasAnyPct
            ? {
                show: true,
                position: 'right',
                formatter(params) {
                  const p = pcts[params.dataIndex]
                  return p != null ? `{pct|${p}}` : ''
                },
                rich: {
                  pct: {
                    color: '#a0a0a0',
                    fontSize: 10,
                    padding: [0, 0, 0, 6],
                  },
                },
              }
            : { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(230,57,70,0.4)',
            },
          },
        },
      ],
    }
  }, [data, metric, colorByIndex, title])

  if (loading) return <Skeleton rows={data.length || 5} />

  return (
    <div className="w-full h-full">
      <ReactECharts
        option={option}
        theme="dashboard-dark"
        style={chartStyle}
        opts={opts}
        notMerge
      />
    </div>
  )
}
