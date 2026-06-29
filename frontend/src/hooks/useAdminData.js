/**
 * useAdminData.js
 * Lightweight data-fetching hook for all admin API endpoints.
 * Uses native fetch + JWT from AuthContext — no extra dependencies.
 */

import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/admin'

function getToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || ''
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), ...options })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// ── Generic data hook ─────────────────────────────────────────────────────────
export function useAdminEndpoint(path, deps = [], interval = null) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      const result = await apiFetch(path)
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    fetch()
    if (interval) {
      const id = setInterval(fetch, interval)
      return () => clearInterval(id)
    }
  }, [fetch, interval, ...deps])

  return { data, loading, error, refetch: fetch }
}

// ── Typed wrappers ────────────────────────────────────────────────────────────
export const useDashboard  = () => useAdminEndpoint('/dashboard', [], 30_000)
export const useServer     = () => useAdminEndpoint('/server',    [], 10_000)
export const useSettings   = () => useAdminEndpoint('/settings')

export function useAnalytics(period) {
  return useAdminEndpoint(`/analytics?period=${period}`, [period])
}

export function useLogs({ level, search, limit }) {
  const qs = new URLSearchParams({ level: level || '', search: search || '', limit: limit || 150 }).toString()
  return useAdminEndpoint(`/logs?${qs}`, [level, search, limit], 15_000)
}

// ── Mutations ─────────────────────────────────────────────────────────────────
export async function saveSettings(settings) {
  return apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) })
}

export async function triggerCleanup() {
  return apiFetch('/maintenance/cleanup', { method: 'POST' })
}
