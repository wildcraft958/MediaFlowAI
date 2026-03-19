/**
 * CrossTabChart — D1 × D2 grouped bar chart with drill-down click
 *
 * @param {object}   props
 * @param {Array}    props.data        - Array of { d1_val, d2_val, count, hours, pcr_pct }
 * @param {string}   props.d1          - Dimension 1 label (x-axis)
 * @param {string}   props.d2          - Dimension 2 label (series/legend)
 * @param {'count'|'hours'} [props.metric='count']
 * @param {Function} [props.onDrillDown] - Called with { d1_val, d2_val } on bar click
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

const COLORS = ['#e63946', '#666666', '#444444', '#ff8fa3', '#2a2a2a', '#888888']

function Skeleton() {
  return (
    <div className="w-full h-full min-h-[200px] animate-pulse flex flex-col gap-3 p-4">
      <div className="flex gap-4 justify-end">
        {[60, 80, 50].map((w, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#1f1f1f]" />
            <div className="h-2 bg-[#1f1f1f] rounded" style={{ width: w }} />
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-end gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 flex gap-0.5 items-end">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className="flex-1 bg-[#1f1f1f] rounded-t"
                style={{ height: `${30 + Math.random() * 50}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CrossTabChart({
  data = [],
  d1 = 'Dimension 1',
  d2 = 'Dimension 2',
  metric = 'count',
  onDrillDown,
  loading = false,
}) {
  // Derive unique D1 categories and D2 series
  const { d1Values, d2Values, seriesMap } = useMemo(() => {
    const d1Set = []
    const d2Set = []
    const seen1 = new Set()
    const seen2 = new Set()

    data.forEach((row) => {
      if (!seen1.has(row.d1_val)) { seen1.add(row.d1_val); d1Set.push(row.d1_val) }
      if (!seen2.has(row.d2_val)) { seen2.add(row.d2_val); d2Set.push(row.d2_val) }
    })

    // seriesMap[d2_val][d1_val] = value
    const map = {}
    d2Set.forEach((d2v) => {
      map[d2v] = {}
      d1Set.forEach((d1v) => { map[d2v][d1v] = 0 })
    })
    data.forEach((row) => {
      const val = metric === 'hours' ? (row.hours || 0) : (row.count || 0)
      if (map[row.d2_val]) map[row.d2_val][row.d1_val] = val
    })

    return { d1Values: d1Set, d2Values: d2Set, seriesMap: map }
  }, [data, metric])

  const option = useMemo(() => {
    const series = d2Values.map((d2v, idx) => ({
      name: d2v,
      type: 'bar',
      data: d1Values.map((d1v) => ({
        value: seriesMap[d2v]?.[d1v] ?? 0,
        _d1: d1v,
        _d2: d2v,
      })),
      barMaxWidth: 28,
      barGap: '10%',
      barCategoryGap: '30%',
      itemStyle: {
        color: COLORS[idx % COLORS.length],
        borderRadius: [4, 4, 0, 0],
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: COLORS[idx % COLORS.length] + '66',
        },
      },
    }))

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 650,
      legend: {
        show: true,
        top: 6,
        right: 12,
        type: 'scroll',
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
        textStyle: { color: '#a0a0a0', fontSize: 11 },
        inactiveColor: '#333',
        pageTextStyle: { color: '#555555' },
        pageIconColor: '#666666',
        pageIconInactiveColor: '#333',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const cat = params[0]?.axisValue || ''
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#a0a0a0">${d1}: ${cat}</div>`
          params.forEach((p) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px"></span>`
            html += `<div>${dot}<span style="color:#a0a0a0">${d2}:</span> ${p.seriesName} - <b>${p.value?.toLocaleString()}</b></div>`
          })
          return html
        },
      },
      grid: { left: 50, right: 16, top: 40, bottom: 36 },
      xAxis: {
        type: 'category',
        data: d1Values,
        name: d1,
        nameLocation: 'end',
        nameTextStyle: { color: '#555555', fontSize: 10 },
        axisLine: { lineStyle: { color: '#1f1f1f' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#a0a0a0',
          fontSize: 11,
          interval: 0,
          rotate: d1Values.length > 5 ? 25 : 0,
          overflow: 'truncate',
          width: 80,
        },
      },
      yAxis: {
        type: 'value',
        name: metric === 'hours' ? 'Hours' : 'Count',
        nameTextStyle: { color: '#555555', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
        axisLabel: { color: '#555555', fontSize: 10 },
      },
      series,
    }
  }, [d1Values, d2Values, seriesMap, d1, d2, metric])

  const onEvents = useMemo(() => {
    if (!onDrillDown) return {}
    return {
      click(params) {
        if (params.componentType === 'series') {
          onDrillDown({
            d1_val: params.data?._d1 ?? params.name,
            d2_val: params.data?._d2 ?? params.seriesName,
          })
        }
      },
    }
  }, [onDrillDown])

  if (loading) return <Skeleton />

  return (
    <div className="w-full h-full">
      <ReactECharts
        option={option}
        theme="frammer-dark"
        style={chartStyle}
        opts={opts}
        onEvents={onEvents}
        notMerge
      />
    </div>
  )
}
