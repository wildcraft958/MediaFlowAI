/**
 * DualBarChart — grouped bar chart: Processing vs Published per date
 *
 * @param {object}   props
 * @param {Array}    props.data    - Array of { date, processing_count, published_count, processing_hours, published_hours }
 * @param {'count'|'hours'} [props.metric='count']
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

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
    <div className="w-full h-full min-h-[200px] bg-[#111111] rounded-xl animate-pulse flex items-end justify-around p-6 gap-1">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} className="flex gap-0.5 items-end flex-1">
          <div
            className="flex-1 bg-[#2a2a2a] rounded-t"
            style={{ height: `${30 + Math.random() * 50}%` }}
          />
          <div
            className="flex-1 bg-[#1f1f1f] rounded-t"
            style={{ height: `${20 + Math.random() * 40}%` }}
          />
        </div>
      ))}
    </div>
  )
}

export default function DualBarChart({ data = [], metric = 'count', loading = false }) {
  const option = useMemo(() => {
    const dates = data.map((d) => fmtDate(d.date))

    const processingSeries =
      metric === 'hours'
        ? data.map((d) => d.processing_hours ?? 0)
        : data.map((d) => d.processing_count ?? 0)

    const publishedSeries =
      metric === 'hours'
        ? data.map((d) => d.published_hours ?? 0)
        : data.map((d) => d.published_count ?? 0)

    const yLabel = metric === 'hours' ? 'Hours' : 'Videos'

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 700,
      legend: {
        show: true,
        right: 16,
        top: 6,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: '#a0a0a0', fontSize: 11 },
        inactiveColor: '#333',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const date = params[0]?.axisValue || ''
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#a0a0a0">${date}</div>`
          params.forEach((p) => {
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color};margin-right:6px"></span>`
            html += `<div>${dot}${p.seriesName}: <b>${p.value?.toLocaleString()}</b></div>`
          })
          return html
        },
      },
      grid: { left: 50, right: 20, bottom: 80, top: 40 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#1f1f1f' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#555555',
          fontSize: 11,
          interval: 'auto',
          rotate: dates.length > 20 ? 30 : 0,
        },
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
          bottom: 4,
          height: 20,
          borderColor: '#1f1f1f',
          backgroundColor: '#111111',
          dataBackground: {
            areaStyle: { color: '#1f1f1f' },
            lineStyle: { color: '#2a2a2a' },
          },
          selectedDataBackground: {
            areaStyle: { color: '#e63946' + '22' },
            lineStyle: { color: '#e63946' },
          },
          fillerColor: '#e63946' + '10',
          handleStyle: { color: '#666666', borderColor: '#666666' },
          textStyle: { color: '#555555', fontSize: 10 },
        },
        { type: 'inside' },
      ],
      series: [
        {
          name: 'Processing',
          type: 'bar',
          data: processingSeries,
          barMaxWidth: 20,
          itemStyle: {
            color: '#666666',
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: { itemStyle: { color: '#888888' } },
        },
        {
          name: 'Published',
          type: 'bar',
          data: publishedSeries,
          barMaxWidth: 20,
          itemStyle: {
            color: '#e63946',
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: { itemStyle: { color: '#ff6b6b' } },
        },
      ],
    }
  }, [data, metric])

  if (loading) return <Skeleton />

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
