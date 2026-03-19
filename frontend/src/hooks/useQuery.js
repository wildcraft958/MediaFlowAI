/**
 * useQuery — thin data-fetching hook
 *
 * Usage:
 *   const { data, loading, error, refetch } = useQuery(fetchFn, [deps])
 *
 * - Calls fetchFn() whenever deps change (or on mount if no deps given)
 * - Returns { data, loading, error, refetch }
 * - On error, data stays as the last successful result (stale-while-revalidate-ish)
 */

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * @param {Function} fetchFn  — async function that returns the data
 * @param {Array}    deps     — dependency array (like useEffect)
 * @param {Object}   options
 * @param {any}      options.initialData    — initial value for data
 * @param {boolean}  options.skip           — if true, skip the fetch entirely
 */
export function useQuery(fetchFn, deps = [], { initialData = null, skip = false } = {}) {
  const [data, setData]       = useState(initialData)
  const [loading, setLoading] = useState(!skip)
  const [error, setError]     = useState(null)

  // Track whether the component is still mounted to prevent state updates after unmount
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const execute = useCallback(async () => {
    if (skip) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchFn()
      if (mountedRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      }
    }
  }, [fetchFn, skip])

  useEffect(() => {
    execute()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, refetch: execute }
}

export default useQuery
