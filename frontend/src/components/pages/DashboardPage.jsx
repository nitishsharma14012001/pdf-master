import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { FileText, Download, Clock, Star, Crown, Settings, LogOut, BarChart3, Zap } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { allTools } from '../../utils/tools'
import { Link } from 'react-router-dom'

const mockHistory = [
  { id: 1, tool: 'Merge PDF', files: 'doc1.pdf, doc2.pdf', output: 'merged.pdf', date: '2025-01-15', size: '2.4 MB' },
  { id: 2, tool: 'Compress PDF', files: 'report.pdf', output: 'report_compressed.pdf', date: '2025-01-14', size: '1.1 MB' },
  { id: 3, tool: 'PDF to Word', files: 'contract.pdf', output: 'contract.docx', date: '2025-01-13', size: '450 KB' },
  { id: 4, tool: 'JPG to PDF', files: 'photo1.jpg, photo2.jpg', output: 'photos.pdf', date: '2025-01-12', size: '3.2 MB' },
  { id: 5, tool: 'Compress Image', files: 'banner.png', output: 'banner_compressed.png', date: '2025-01-11', size: '280 KB' },
]

const popularTools = allTools.slice(0, 8)

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  if (!user) {
    navigate('/login')
    return null
  }

  const tabs = ['overview', 'history', 'settings']

  return (
    <>
      <Helmet><title>Dashboard — PDF Master</title></Helmet>
      <div className="min-h-screen pt-20 pb-16" style={{ background: 'var(--bg-secondary)' }}>
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold">
                {user.name[0]}
              </div>
              <div>
                <h1 className="font-display text-2xl font-extrabold" style={{ color: 'var(--text)' }}>
                  Hello, {user.name.split(' ')[0]} 👋
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge text-xs ${user.plan === 'pro' ? 'badge-purple' : 'badge-blue'}`}>
                    {user.plan === 'pro' ? <><Crown className="w-3 h-3" /> Pro</> : 'Free'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</span>
                </div>
              </div>
            </div>
            {user.plan === 'free' && (
              <Link to="/pricing" className="btn-primary text-sm py-2.5 px-5">
                <Crown className="w-4 h-4" />
                Upgrade to Pro
              </Link>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'text-white shadow-sm' : ''}`}
                style={activeTab === tab ? { background: 'linear-gradient(135deg, #2563eb, #7c3aed)' } : { color: 'var(--text-muted)' }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Files Processed', value: '24', icon: FileText, color: 'text-blue-600' },
                  { label: 'Total Downloads', value: '31', icon: Download, color: 'text-violet-600' },
                  { label: 'Tools Used', value: '8', icon: Zap, color: 'text-pink-600' },
                  { label: 'Storage Saved', value: '145 MB', icon: BarChart3, color: 'text-green-600' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <s.icon className={`w-6 h-6 mb-3 ${s.color}`} />
                    <p className="font-display text-2xl font-extrabold" style={{ color: 'var(--text)' }}>{s.value}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick tools */}
              <div>
                <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text)' }}>Quick Access</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {popularTools.map(tool => (
                    <Link key={tool.id} to={`/tools/${tool.id}`} className="tool-card text-center py-4">
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{tool.label}</p>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div>
                <h2 className="font-bold text-base mb-4" style={{ color: 'var(--text)' }}>Recent Activity</h2>
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  {mockHistory.slice(0, 3).map((item, i) => (
                    <div key={item.id} className={`flex items-center gap-4 px-5 py-4 ${i < 2 ? 'border-b' : ''}`} style={{ borderColor: 'var(--border)' }}>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.tool}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.files}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>{item.size}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.date}</p>
                      </div>
                      <button className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-blue-600">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {activeTab === 'history' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <h2 className="font-bold" style={{ color: 'var(--text)' }}>Download History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      {['Tool', 'Input Files', 'Output', 'Date', 'Size', ''].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockHistory.map((item, i) => (
                      <tr key={item.id} className={i < mockHistory.length - 1 ? 'border-b' : ''} style={{ borderColor: 'var(--border)' }}>
                        <td className="px-5 py-4 font-medium" style={{ color: 'var(--text)' }}>{item.tool}</td>
                        <td className="px-5 py-4" style={{ color: 'var(--text-muted)' }}>{item.files}</td>
                        <td className="px-5 py-4 text-blue-600">{item.output}</td>
                        <td className="px-5 py-4" style={{ color: 'var(--text-muted)' }}>{item.date}</td>
                        <td className="px-5 py-4" style={{ color: 'var(--text-muted)' }}>{item.size}</td>
                        <td className="px-5 py-4">
                          <button className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Settings */}
          {activeTab === 'settings' && (
            <div className="max-w-lg space-y-4">
              <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <h2 className="font-bold mb-5" style={{ color: 'var(--text)' }}>Account Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                    <input defaultValue={user.name} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                    <input defaultValue={user.email} type="email" className="input-field" />
                  </div>
                  <button className="btn-primary">Save Changes</button>
                </div>
              </div>
              <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold mb-4 text-red-500">Danger Zone</h3>
                <button onClick={() => { logout(); navigate('/') }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
