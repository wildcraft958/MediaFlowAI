import axios from 'axios'

// ─── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
)

// ─── Response Interceptor — normalize errors ──────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message =
        error.response.data?.detail ||
        error.response.data?.message ||
        `HTTP ${error.response.status}: ${error.response.statusText}`
      return Promise.reject(new Error(message))
    } else if (error.request) {
      return Promise.reject(
        new Error('Network error — backend unreachable. Is FastAPI running on :8000?')
      )
    }
    return Promise.reject(error)
  }
)

// ─── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () => api.get('/health')

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getExecutiveSummary = (params) =>
  api.get('/dashboard/executive', { params })

export const getPublishFunnel = (params) =>
  api.get('/dashboard/publish-funnel', { params })

export const getUserActivity = (params) =>
  api.get('/dashboard/users', { params })

export const getPeriodComparison = (params) =>
  api.get('/dashboard/period-comparison', { params })

export const getDataQuality = (params) =>
  api.get('/dashboard/data-quality', { params })

export const getBillableSplit = (params) =>
  api.get('/dashboard/billable-split', { params })

// ─── KPIs ────────────────────────────────────────────────────────────────────
export const getKPI = (acronym, params) =>
  api.get(`/kpis/${acronym}`, { params })

export const getKPIs = (acronyms, params) =>
  Promise.all(acronyms.map((a) => getKPI(a, params)))

// ─── Trends ──────────────────────────────────────────────────────────────────
export const getDailyTrends = (params) =>
  api.get('/trends/daily', { params })

export const getForecast = (params) =>
  api.get('/trends/forecast', { params })

export const getCategoryTrends = (params) =>
  api.get('/trends/category', { params })

export const getOutputTypeTrends = (params) =>
  api.get('/trends/output-type', { params })

// ─── CrossTab ────────────────────────────────────────────────────────────────
export const getCrosstab = (params) =>
  api.get('/crosstab', { params })

// ─── Video Explorer ───────────────────────────────────────────────────────────
export const getVideos = (params) =>
  api.get('/videos', { params })

export const exportVideos = (params) =>
  api.get('/videos/export', { params, responseType: 'blob' })

// ─── Dimensions ──────────────────────────────────────────────────────────────
export const getDimensions = () => api.get('/dimensions')

// ─── Admin — KPI Registry ────────────────────────────────────────────────────
export const getAdminKPIs = () => api.get('/admin/kpis')

export const createKPI = (data) => api.post('/admin/kpis', data)

export const updateKPI = (acronym, data) => api.put(`/admin/kpis/${acronym}`, data)

export const deleteKPI = (acronym) => api.delete(`/admin/kpis/${acronym}`)

// ─── Admin — KPI Chat Agent ──────────────────────────────────────────────────
export const kpiChat = (data) => api.post('/admin/kpi-chat', data)

// ─── Admin — Client Config ────────────────────────────────────────────────────
export const getAdminConfig = () => api.get('/admin/config')

export const updateAdminConfig = (data) => api.put('/admin/config', data)

// ─── NLQ ────────────────────────────────────────────────────────────────────
export const postNLQ = (data) => api.post('/nlq', data)

/**
 * openNLQStream — open an SSE connection to GET /api/nlq/stream
 *
 * @param {object} params  { question, session_id?, persona? }
 * @param {function} onEvent  called with each parsed event object
 * @returns EventSource instance — caller can .close() to cancel
 *
 * Event types: thought_step | sql_ready | final | error | done
 */
export function openNLQStream(params, onEvent) {
  const base = import.meta.env.VITE_API_URL || '/api'
  const url = new URL(`${base}/nlq/stream`, window.location.origin)
  url.searchParams.set('question', params.question)
  url.searchParams.set('session_id', params.session_id || 'default')
  url.searchParams.set('persona', params.persona || 'leadership')

  const source = new EventSource(url.toString())

  source.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data)
      onEvent(event)
      if (event.type === 'done' || event.type === 'error') {
        source.close()
      }
    } catch {
      // ignore malformed events
    }
  }

  source.onerror = () => {
    onEvent({ type: 'error', message: 'SSE connection failed' })
    source.close()
  }

  return source
}

/**
 * postNLQStream — POST to /api/nlq/stream with JSON body (supports context).
 * Uses fetch + ReadableStream to parse SSE events.
 *
 * @param {object} body  { question, session_id, persona, page_context?, chart_context? }
 * @param {function} onEvent  called with each parsed event object
 * @returns {{ abort: () => void }}  call abort() to cancel
 */
export function postNLQStream(body, onEvent) {
  const base = import.meta.env.VITE_API_URL || '/api'
  const controller = new AbortController()

  fetch(`${base}/nlq/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              onEvent(event)
            } catch {
              // ignore malformed events
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: 'SSE connection failed' })
      }
    })

  return { abort: () => controller.abort() }
}

export default api
