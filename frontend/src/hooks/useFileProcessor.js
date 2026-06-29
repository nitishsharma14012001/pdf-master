import { useState, useCallback } from 'react'
import axios from 'axios'

const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://pdf-master-api-0h3j.onrender.com/api'

/**
 * Hook that wraps the tool-processing API call.
 *
 * Usage:
 *   const { process, status, progress, result, error, reset } = useFileProcessor()
 *   await process('compress-pdf', [file], { quality: 'medium' })
 */
export function useFileProcessor() {
  const [status, setStatus]   = useState('idle')   // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const process = useCallback(async (toolId, files, options = {}) => {
    if (!files || files.length === 0) {
      setError('Please upload at least one file')
      return
    }

    setStatus('uploading')
    setProgress(0)
    setError(null)
    setResult(null)

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))
    formData.append('options', JSON.stringify(options))

    try {
      const token = localStorage.getItem('auth_token')

      const res = await axios.post(
        `${API_BASE}/tools/${toolId}/process`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          onUploadProgress(evt) {
            const pct = Math.round((evt.loaded / evt.total) * 50)
            setProgress(pct)
            if (pct === 50) setStatus('processing')
          },
        }
      )

      // Simulate processing phase progress (50 → 100)
      for (let i = 51; i <= 100; i += 7) {
        await new Promise(r => setTimeout(r, 120))
        setProgress(i)
      }
      setProgress(100)
      setResult(res.data)
      setStatus('done')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Processing failed'
      setError(msg)
      setStatus('error')
    }
  }, [])

  const download = useCallback(() => {
    if (!result?.downloadUrl) return
    const a = document.createElement('a')
    a.href = `${API_BASE.replace('/api', '')}${result.downloadUrl}`
    a.download = result.outputFile
    a.click()
  }, [result])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setResult(null)
    setError(null)
  }, [])

  return { process, status, progress, result, error, reset, download }
}
