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

// ─── KPIs ────────────────────────────────────────────────────────────────────
export const getKPI = (acronym, params) =>
  api.get(`/kpis/${acronym}`, { params })

export const getKPIs = (acronyms, params) =>
  Promise.all(acronyms.map((a) => getKPI(a, params)))

// ─── Trends ──────────────────────────────────────────────────────────────────
export const getDailyTrends = (params) =>
  api.get('/trends/daily', { params })

export const getCategoryTrends = (params) =>
  api.get('/trends/category', { params })

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

export default api
