/**
 * ScatterChart — bubble scatter with 4-quadrant labels
 *
 * @param {object}   props
 * @param {Array}    props.data    - Array of { name, x, y, size, label }
 *                                  x = CTR%, y = avg_view_pct, size = impressions
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

const BUBBLE_MIN = 10
const BUBBLE_MAX = 50

function normalizeSizes(data) {
  if (!data.length) return []
  const sizes = data.map((d) => d.size || 1)
  const minS = Math.min(...sizes)
  const maxS = Math.max(...sizes)
  const range = maxS - minS || 1
  return sizes.map((s) => BUBBLE_MIN + ((s - minS) / range) * (BUBBLE_MAX - BUBBLE_MIN))
}

function Skeleton() {
  return (
    <div className="w-full h-full min-h-[200px] animate-pulse bg-[#111111] rounded-xl relative p-4">
      {/* Quadrant lines */}
      <div className="absolute inset-y-8 left-1/2 border-l border-dashed border-[#1f1f1f]" />
      <div className="absolute inset-x-8 top-1/2 border-t border-dashed border-[#1f1f1f]" />
      {/* Fake bubbles */}
      {[[30, 30], [65, 25], [20, 70], [75, 65], [50, 50]].map(([x, y], i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#1f1f1f]"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: 20 + i * 6,
            height: 20 + i * 6,
            transform: 'translate(-50%,-50%)',
          }}
        />
      ))}
    </div>
  )
}

export default function ScatterChart({ data = [], loading = false }) {
  const normalizedSizes = useMemo(() => normalizeSizes(data), [data])

  const option = useMemo(() => {
    const scatterData = data.map((d, i) => ({
      name: d.name || d.label || '',
      value: [d.x, d.y, d.size || 1],
      symbolSize: normalizedSizes[i] || BUBBLE_MIN,
      label: d.label,
      _raw: d,
    }))

    // Axis extents
    const xs = data.map((d) => d.x)
    const ys = data.map((d) => d.y)
    const xMin = Math.max(0, (Math.min(...xs) || 0) - 0.5)
    const xMax = (Math.max(...xs) || 5) + 0.5
    const yMin = Math.max(0, (Math.min(...ys) || 0) - 5)
    const yMax = (Math.max(...ys) || 100) + 5

    const xMid = (xMin + xMax) / 2 // reference line at 2% CTR
    const yMid = (yMin + yMax) / 2 // reference line at 50% view

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 700,
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        textStyle: { color: '#ffffff', fontSize: 12 },
        formatter(params) {
          const d = params.data._raw || {}
          return `
            <div style="font-weight:600;margin-bottom:4px">${params.name}</div>
            <div>CTR: <b>${(d.x || 0).toFixed(2)}%</b></div>
            <div>Avg View: <b>${(d.y || 0).toFixed(1)}%</b></div>
            <div>Impressions: <b>${(d.size || 0).toLocaleString()}</b></div>
          `
        },
      },
      grid: { left: 54, right: 30, top: 20, bottom: 44 },
      xAxis: {
        type: 'value',
        name: 'CTR %',
        nameLocation: 'end',
        nameTextStyle: { color: '#a0a0a0', fontSize: 11 },
        min: xMin,
        max: xMax,
        axisLine: { lineStyle: { color: '#1f1f1f' } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#161616', type: 'dashed' } },
        axisLabel: { color: '#555555', fontSize: 10, formatter: '{value}%' },
      },
      yAxis: {
        type: 'value',
        name: 'Avg View %',
        nameLocation: 'end',
        nameTextStyle: { color: '#a0a0a0', fontSize: 11 },
        min: yMin,
        max: yMax,
        axisLine: { lineStyle: { color: '#1f1f1f' } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#161616', type: 'dashed' } },
        axisLabel: { color: '#555555', fontSize: 10, formatter: '{value}%' },
      },
      series: [
        // Reference line X = 2%
        {
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#333333', type: 'dashed', width: 1 },
            data: [{ xAxis: 2 }],
          },
          data: [],
        },
        // Reference line Y = 50%
        {
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { color: '#333333', type: 'dashed', width: 1 },
            data: [{ yAxis: 50 }],
          },
          data: [],
        },
        // Quadrant labels as scatter points with label-only markers
        {
          type: 'scatter',
          symbol: 'none',
          silent: true,
          label: {
            show: true,
            formatter: '{a}',
            color: '#333333',
            fontSize: 10,
            fontStyle: 'italic',
          },
          data: [
            { name: 'Clickbait', value: [xMax - 0.3, yMin + 3], label: { show: true, formatter: 'Clickbait', position: 'inside' } },
            { name: 'Champions', value: [xMax - 0.5, yMax - 3], label: { show: true, formatter: '✦ Champions', position: 'inside' } },
            { name: 'Hidden Gems', value: [xMin + 0.3, yMax - 3], label: { show: true, formatter: 'Hidden Gems', position: 'inside' } },
            { name: 'Poor', value: [xMin + 0.3, yMin + 3], label: { show: true, formatter: 'Poor', position: 'inside' } },
          ],
          itemStyle: { opacity: 0 },
        },
        // Main bubbles
        {
          name: 'Videos',
          type: 'scatter',
          data: scatterData,
          itemStyle: {
            color: '#e63946',
            opacity: 0.75,
            borderColor: '#e63946',
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: {
              opacity: 1,
              borderWidth: 2,
              shadowBlur: 12,
              shadowColor: 'rgba(230,57,70,0.5)',
            },
            label: {
              show: true,
              position: 'top',
              formatter: '{b}',
              color: '#ffffff',
              fontSize: 10,
              backgroundColor: '#1a1a1a',
              padding: [2, 4],
              borderRadius: 3,
            },
          },
        },
      ],
    }
  }, [data, normalizedSizes])

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
