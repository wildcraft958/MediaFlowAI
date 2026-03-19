/**
 * SparkLine — ultra-minimal inline trend line (ECharts, no axes/grid)
 *
 * @param {object}   props
 * @param {number[]} props.data    - Raw numeric series data
 * @param {string}   [props.color='#e63946'] - Line + fill color
 * @param {number}   [props.height=40]       - Chart height in px
 * @param {number}   [props.width=128]       - Chart width in px
 */

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

const chartStyle = { height: '100%', minHeight: 40 }
const opts = { renderer: 'canvas' }

export default function SparkLine({
  data = [],
  color = '#e63946',
  height = 40,
  width = 128,
}) {
  const option = useMemo(() => {
    const xData = data.map((_, i) => i)

    return {
      backgroundColor: 'transparent',
      animation: true,
      animationDuration: 800,
      grid: { top: 2, bottom: 2, left: 2, right: 2 },
      xAxis: {
        show: false,
        type: 'category',
        data: xData,
        boundaryGap: false,
      },
      yAxis: {
        show: false,
        type: 'value',
        // add a little padding so the line doesn't clip
        min: (v) => v.min - (v.max - v.min) * 0.1,
        max: (v) => v.max + (v.max - v.min) * 0.1,
      },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { color, width: 1.5 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: color + 'aa' },
                { offset: 1, color: color + '00' },
              ],
            },
          },
        },
      ],
    }
  }, [data, color])

  return (
    <div style={{ width, height, flexShrink: 0 }}>
      <ReactECharts
        option={option}
        theme="dashboard-dark"
        style={{ width: '100%', height: '100%', ...chartStyle }}
        opts={opts}
        notMerge
      />
    </div>
  )
}
