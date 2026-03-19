/**
 * theme/echarts.js — ECharts theme registration + shared chart color palette
 *
 * Usage:
 *   import { registerFrammerTheme, CHART_COLORS } from '../theme/echarts'
 *   registerFrammerTheme()   // call once in App.jsx before any chart renders
 *   // then use theme="frammer-dark" on every ReactECharts component
 */

import * as echarts from 'echarts/core'

// ─── Shared Color Constants (use outside ECharts too) ─────────────────────────
export const CHART_COLORS = {
  primary:   '#e63946',
  secondary: '#666666',
  soft:      '#ff8fa3',
  blue:      '#2196f3',
  green:     '#4caf50',
  orange:    '#ff9800',
  gray1:     '#666666',
  gray2:     '#444444',
  gray3:     '#2a2a2a',
  muted:     '#a0a0a0',
  text:      '#ffffff',
}

// ─── Color Palette (spec-required order) ─────────────────────────────────────
export const PALETTE = [
  '#e63946',   // accent red
  '#ff6b6b',   // lighter red
  '#666666',   // neutral gray
  '#444444',   // darker gray
  '#2a2a2a',   // deep gray
  '#ff8fa3',   // accent soft
  '#555555',   // mid gray
  '#2196f3',   // info blue (extra)
  '#4caf50',   // success green (extra)
  '#ff9800',   // warning orange (extra)
]

const frammerDark = {
  color: PALETTE,
  backgroundColor: 'transparent',
  textStyle: {},
  title: {
    textStyle: { color: '#ffffff' },
    subtextStyle: { color: '#a0a0a0' },
  },
  line: { itemStyle: { borderWidth: 1 }, lineStyle: { width: 2 }, symbolSize: 4, symbol: 'circle', smooth: false },
  radar: { itemStyle: { borderWidth: 1 }, lineStyle: { width: 2 }, symbolSize: 4, symbol: 'circle', smooth: false },
  bar: {
    itemStyle: { barBorderWidth: 0, barBorderColor: '#1f1f1f' },
  },
  pie: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  scatter: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  boxplot: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  parallel: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  sankey: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  funnel: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  gauge: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
  },
  candlestick: {
    itemStyle: {
      color: '#e63946',
      color0: '#4caf50',
      borderColor: '#e63946',
      borderColor0: '#4caf50',
      borderWidth: 1,
    },
  },
  graph: {
    itemStyle: { borderWidth: 0, borderColor: '#1f1f1f' },
    lineStyle: { width: 1, color: '#333333' },
    symbolSize: 4,
    symbol: 'circle',
    smooth: false,
    color: PALETTE,
    label: { color: '#ffffff' },
  },
  map: {
    itemStyle: {
      areaColor: '#1f1f1f',
      borderColor: '#333333',
      borderWidth: 0.5,
    },
    label: { color: '#ffffff' },
    emphasis: {
      itemStyle: { areaColor: '#e63946', borderColor: '#e63946', borderWidth: 1 },
      label: { color: '#ffffff' },
    },
  },
  geo: {
    itemStyle: {
      areaColor: '#1f1f1f',
      borderColor: '#333333',
      borderWidth: 0.5,
    },
    label: { color: '#ffffff' },
    emphasis: {
      itemStyle: { areaColor: '#e63946', borderColor: '#e63946', borderWidth: 1 },
      label: { color: '#ffffff' },
    },
  },
  categoryAxis: {
    axisLine: { show: true, lineStyle: { color: '#1f1f1f' } },
    axisTick: { show: false, lineStyle: { color: '#1f1f1f' } },
    axisLabel: { show: true, color: '#555555' },
    splitLine: { show: false, lineStyle: { color: '#1f1f1f' } },
    splitArea: { show: false, areaStyle: { color: ['rgba(255,255,255,0.02)', 'rgba(0,0,0,0)'] } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: true, color: '#555555' },
    splitLine: { show: true, lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    splitArea: { show: false },
  },
  logAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: true, color: '#555555' },
    splitLine: { show: true, lineStyle: { color: '#1a1a1a', type: 'dashed' } },
    splitArea: { show: false },
  },
  timeAxis: {
    axisLine: { show: true, lineStyle: { color: '#1f1f1f' } },
    axisTick: { show: false },
    axisLabel: { show: true, color: '#555555' },
    splitLine: { show: false },
    splitArea: { show: false },
  },
  toolbox: {
    iconStyle: { borderColor: '#555555' },
    emphasis: { iconStyle: { borderColor: '#a0a0a0' } },
  },
  legend: {
    textStyle: { color: '#a0a0a0' },
  },
  tooltip: {
    axisPointer: {
      lineStyle: { color: '#333333', width: 1 },
      crossStyle: { color: '#333333', width: 1 },
    },
  },
  timeline: {
    lineStyle: { color: '#333333', width: 1 },
    itemStyle: { color: '#333333', borderWidth: 1 },
    controlStyle: {
      color: '#333333',
      borderColor: '#333333',
      borderWidth: 0.5,
    },
    checkpointStyle: { color: '#e63946', borderColor: '#e63946' },
    label: { color: '#a0a0a0' },
    emphasis: {
      itemStyle: { color: '#e63946' },
      controlStyle: {
        color: '#555555',
        borderColor: '#555555',
        borderWidth: 0.5,
      },
      label: { color: '#ffffff' },
    },
  },
  visualMap: {
    color: ['#e63946', '#ff9800', '#4caf50'],
  },
  dataZoom: {
    backgroundColor: '#111111',
    dataBackgroundColor: '#1f1f1f',
    fillerColor: 'rgba(230,57,70,0.1)',
    handleColor: '#e63946',
    handleSize: '100%',
    textStyle: { color: '#555555' },
  },
  markPoint: {
    label: { color: '#ffffff' },
    emphasis: { label: { color: '#ffffff' } },
  },
}

// ─── Public registration function (call once in App.jsx) ─────────────────────
let _registered = false
export function registerFrammerTheme() {
  if (_registered) return
  try {
    echarts.registerTheme('frammer-dark', frammerDark)
    _registered = true
  } catch {
    // already registered — safe to ignore
  }
}

// Also register immediately for convenience when imported
registerFrammerTheme()

export default frammerDark
