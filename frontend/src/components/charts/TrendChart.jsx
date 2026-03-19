/**
 * TrendChart — daily upload / publish area trend with DataZoom
 *
 * @param {object}   props
 * @param {Array}    props.data    - Array of { date, uploaded, processed, published, uploaded_hours, published_hours }
 * @param {'count'|'hours'} [props.metric='count'] - Toggle between count and hours view
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

// Format 'YYYY-MM-DD' → 'Mar 5' style
function fmtDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function Skeleton() {
  return (
    <div className="w-full h-full min-h-[200px] bg-[#111111] rounded-xl animate-pulse flex items-end gap-2 p-4">
      {[40, 65, 50, 80, 55, 70, 45, 85, 60, 75, 50, 90].map((h, i) => (
        <div
          key={i}
          className="flex-1 bg-[#1f1f1f] rounded-t"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

export default function TrendChart({ data = [], metric = 'count', loading = false }) {
  const option = useMemo(() => {
    const dates = data.map((d) => fmtDate(d.date))

    const publishedSeries =
      metric === 'hours'
        ? data.map((d) => d.published_hours ?? 0)
        : data.map((d) => d.published ?? 0)

    const uploadedSeries =
      metric === 'hours'
        ? data.map((d) => d.uploaded_hours ?? 0)
        : data.map((d) => d.uploaded ?? 0)

    const yLabel = metric === 'hours' ? 'Hours' : 'Videos'

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 900,
      legend: {
        show: true,
        right: 16,
        top: 8,
        itemWidth: 14,
        itemHeight: 2,
        textStyle: { color: '#a0a0a0', fontSize: 11 },
        inactiveColor: '#333',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#333' } },
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const date = params[0]?.axisValue || ''
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#a0a0a0">${date}</div>`
          params.forEach((p) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`
            html += `<div>${dot}${p.seriesName}: <b>${p.value?.toLocaleString()}</b></div>`
          })
          return html
        },
      },
      grid: { left: 54, right: 20, bottom: 72, top: 44 },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1f1f1f' } },
        axisTick: { show: false },
        axisLabel: { color: '#555555', fontSize: 11, interval: 'auto' },
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameTextStyle: { color: '#555555', fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#1a1a1a', type: 'dashed' } },
        axisLabel: { color: '#555555', fontSize: 11 },
      },
      dataZoom: [
        {
          type: 'slider',
          bottom: 8,
          height: 22,
          borderColor: '#1f1f1f',
          backgroundColor: '#111111',
          dataBackground: {
            areaStyle: { color: '#1f1f1f' },
            lineStyle: { color: '#2a2a2a' },
          },
          selectedDataBackground: {
            areaStyle: { color: '#e63946' + '33' },
            lineStyle: { color: '#e63946' },
          },
          fillerColor: '#e63946' + '15',
          handleStyle: { color: '#e63946', borderColor: '#e63946' },
          textStyle: { color: '#555555', fontSize: 10 },
          moveHandleSize: 6,
        },
        { type: 'inside' },
      ],
      series: [
        {
          name: 'Published',
          type: 'line',
          data: publishedSeries,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#e63946', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#e63946' + '66' },
                { offset: 1, color: '#e63946' + '00' },
              ],
            },
          },
          z: 3,
        },
        {
          name: 'Uploaded',
          type: 'line',
          data: uploadedSeries,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#666666', width: 1.5, type: 'dashed' },
          z: 2,
        },
      ],
    }
  }, [data, metric])

  if (loading) return <Skeleton />

  return (
    <div className="w-full h-full">
      <ReactECharts
        option={option}
        theme="frammer-dark"
        style={chartStyle}
        opts={opts}
        notMerge
      />
    </div>
  )
}
