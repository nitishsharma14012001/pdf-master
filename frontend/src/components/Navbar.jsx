import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun, Menu, X, FileText, ChevronDown, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { toolCategories } from '../../utils/tools'

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dropdown, setDropdown] = useState(null)
  const [userMenu, setUserMenu] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    setOpen(false)
    setDropdown(null)
    setUserMenu(false)
  }, [location])

  const navLinks = [
    { label: 'Tools', hasDropdown: true },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Features', to: '/#features' },
    { label: 'Contact', to: '/contact' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'shadow-lg' : ''}`}
      style={{ background: scrolled ? 'var(--bg)' : 'transparent', borderBottom: scrolled ? '1px solid var(--border)' : 'none' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
            >
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="gradient-text">PDF Master</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) =>
              link.hasDropdown ? (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setDropdown('tools')}
                  onMouseLeave={() => setDropdown(null)}
                >
                  <button
                    className="flex items-center gap-1 font-medium text-sm transition-colors hover:text-blue-600"
                    style={{ color: 'var(--text)' }}
                  >
                    {link.label} <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {dropdown === 'tools' && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[640px]">
                      <div
                        className="rounded-2xl shadow-2xl p-6 grid grid-cols-2 gap-6"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                      >
                        {toolCategories.map((cat) => (
                          <div key={cat.id}>
                            <p
                              className="text-xs font-bold uppercase tracking-widest mb-3"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {cat.label}
                            </p>
                            <div className="space-y-1">
                              {cat.tools.slice(0, 4).map((tool) => (
                                <Link
                                  key={tool.id}
                                  to={`/tools/${tool.id}`}
                                  className="block px-3 py-1.5 rounded-lg text-sm transition-colors hover:text-blue-600"
                                  style={{ color: 'var(--text)' }}
                                >
                                  {tool.label}
                                </Link>
                              ))}
                              <Link to="/#tools" className="block px-3 py-1.5 text-sm font-medium text-blue-600">
                                View all →
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  to={link.to}
                  className="font-medium text-sm transition-colors hover:text-blue-600"
                  style={{ color: 'var(--text)' }}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu((v) => !v)}
                  className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                    {user.name[0]}
                  </div>
                  {user.name.split(' ')[0]}
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                </button>
                {userMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl overflow-hidden"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                  >
                    <Link
                      to="/dashboard"
                      className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        style={{ color: 'var(--text)' }}
                      >
                        <Shield className="w-4 h-4" /> Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={logout}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login" className="btn-secondary text-sm py-2 px-4">
                  <User className="w-3.5 h-3.5" />
                  Login
                </Link>
                <Link to="/signup" className="btn-primary text-sm py-2 px-4">
                  Sign Up Free
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text)' }}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-4 space-y-2">
            <Link to="/#features" className="block px-3 py-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
              Features
            </Link>
            {toolCategories.map((cat) => (
              <div key={cat.id}>
                <p className="text-xs font-bold uppercase tracking-widest px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                  {cat.label}
                </p>
                {cat.tools.slice(0, 3).map((tool) => (
                  <Link key={tool.id} to={`/tools/${tool.id}`} className="block px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text)' }}>
                    {tool.label}
                  </Link>
                ))}
              </div>
            ))}
            <div className="pt-4 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>
              <Link to="/pricing" className="block px-3 py-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                Pricing
              </Link>
              <Link to="/contact" className="block px-3 py-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                Contact
              </Link>
              {!user && (
                <>
                  <Link to="/login" className="btn-secondary text-sm py-2 text-center">
                    Login
                  </Link>
                  <Link to="/signup" className="btn-primary text-sm py-2 text-center">
                    Sign Up Free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
