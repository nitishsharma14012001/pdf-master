import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, File, X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

const MAX_SIZE_FREE = 25 * 1024 * 1024 // 25 MB
const MAX_SIZE_PRO = 200 * 1024 * 1024 // 200 MB

function formatBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export default function FileDropzone({
  accepts = { 'application/pdf': ['.pdf'] },
  multiple = false,
  maxSize = MAX_SIZE_FREE,
  onFilesAccepted,
  description = 'Drop files here',
  hint = 'Max 25 MB per file',
}) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')

  const onDrop = useCallback((accepted, rejected) => {
    setError('')
    if (rejected.length > 0) {
      const msg = rejected[0].errors[0]?.message || 'File not accepted'
      setError(msg)
      return
    }
    const updated = multiple ? [...files, ...accepted] : accepted
    setFiles(updated)
    onFilesAccepted?.(updated)
  }, [files, multiple, onFilesAccepted])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accepts,
    multiple,
    maxSize,
  })

  const remove = (i) => {
    const updated = files.filter((_, idx) => idx !== i)
    setFiles(updated)
    onFilesAccepted?.(updated)
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={clsx('dropzone', isDragActive && 'active')}
        role="button"
        aria-label="File upload area"
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center transition-colors', isDragActive ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-800')}>
            <UploadCloud className={clsx('w-8 h-8 transition-colors', isDragActive ? 'text-blue-600' : 'text-gray-400')} />
          </div>
          <div>
            <p className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              {isDragActive ? 'Drop files here…' : description}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              or <span className="text-blue-600 font-medium cursor-pointer">browse files</span> · {hint}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{f.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatBytes(f.size)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(i) }} className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
