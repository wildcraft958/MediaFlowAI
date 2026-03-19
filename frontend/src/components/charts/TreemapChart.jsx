/**
 * TreemapChart — ECharts treemap with PCR-based color intensity
 *
 * @param {object}   props
 * @param {Array}    props.data    - Array of { name, value, pct_label, color? }
 * @param {'count'|'hours'} [props.metric='count']
 * @param {boolean}  [props.loading=false]
 */

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 200 }
const opts = { renderer: 'canvas' }

// PCR value → color: 100% = deep red, 50% = mid-gray, 0% = near-black
function pcrColor(pct) {
  // Interpolate between #1a1a1a (0%) and #e63946 (100%)
  const t = Math.min(Math.max((pct || 0) / 100, 0), 1)
  const r = Math.round(26 + t * (230 - 26))
  const g = Math.round(26 + t * (57 - 26))
  const b = Math.round(26 + t * (70 - 26))
  return `rgb(${r},${g},${b})`
}

function Skeleton() {
  return (
    <div className="w-full h-full min-h-[200px] animate-pulse grid grid-cols-3 grid-rows-2 gap-1 p-1">
      {[2, 1, 1, 1, 1, 1].map((span, i) => (
        <div
          key={i}
          className="bg-[#1f1f1f] rounded"
          style={{ gridColumn: span > 1 ? 'span 2' : undefined }}
        />
      ))}
    </div>
  )
}

export default function TreemapChart({ data = [], metric = 'count', loading = false }) {
  const option = useMemo(() => {
    const treeData = data.map((item) => {
      // Extract numeric PCR from pct_label if available (e.g. "92%" → 92)
      let pct = null
      if (item.pct_label) {
        pct = parseFloat(String(item.pct_label).replace('%', ''))
      } else if (item.pcr != null) {
        pct = item.pcr
      }

      const color = item.color || pcrColor(pct ?? 50)

      return {
        name: item.name,
        value: item.value,
        itemStyle: { color },
        label: {
          formatter: () => item.name,
        },
        tooltip: {
          formatter: () => {
            const pctStr = pct != null ? `${pct.toFixed(1)}%` : item.pct_label || '-'
            return `
              <div style="font-weight:600;margin-bottom:3px">${item.name}</div>
              <div>${metric === 'hours' ? 'Hours' : 'Count'}: <b>${item.value?.toLocaleString()}</b></div>
              <div>PCR: <b>${pctStr}</b></div>
            `
          },
        },
        // Store pct for labeling
        _pct: pct,
        _pctLabel: item.pct_label,
      }
    })

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
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          data: treeData,
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          label: {
            show: true,
            position: 'inside',
            align: 'center',
            verticalAlign: 'middle',
            formatter(params) {
              const pctStr = params.data._pctLabel || (params.data._pct != null ? `${params.data._pct.toFixed(0)}%` : '')
              return `{name|${params.name}}\n{value|${params.value?.toLocaleString()}}${pctStr ? `\n{pct|${pctStr}}` : ''}`
            },
            rich: {
              name: {
                color: '#ffffff',
                fontSize: 12,
                fontWeight: '600',
                lineHeight: 18,
              },
              value: {
                color: '#e0e0e0',
                fontSize: 14,
                fontWeight: '700',
                lineHeight: 20,
              },
              pct: {
                color: '#ff8fa3',
                fontSize: 10,
                lineHeight: 16,
              },
            },
          },
          upperLabel: { show: false },
          itemStyle: {
            borderWidth: 2,
            borderColor: '#0a0a0a',
            gapWidth: 2,
          },
          emphasis: {
            label: { show: true },
            itemStyle: {
              borderWidth: 3,
              borderColor: '#ffffff',
              shadowBlur: 16,
              shadowColor: 'rgba(255,255,255,0.2)',
            },
          },
          levels: [
            {
              itemStyle: { borderWidth: 0, gapWidth: 2 },
            },
          ],
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
