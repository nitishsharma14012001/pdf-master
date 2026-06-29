import { useState, useEffect, useMemo } from 'react'
import { allTools } from '../utils/tools'

/**
 * Fuzzy search over all tools.
 * Returns up to `limit` results sorted by relevance.
 */
export function useToolSearch(query = '', limit = 8) {
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    return allTools
      .map(tool => {
        let score = 0
        // Exact label match
        if (tool.label.toLowerCase() === q) score += 100
        // Label starts with query
        if (tool.label.toLowerCase().startsWith(q)) score += 50
        // Label contains query
        if (tool.label.toLowerCase().includes(q)) score += 30
        // Description contains query
        if (tool.desc.toLowerCase().includes(q)) score += 10
        // ID contains query
        if (tool.id.includes(q.replace(/\s+/g, '-'))) score += 20
        return { ...tool, score }
      })
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }, [query, limit])

  return results
}
