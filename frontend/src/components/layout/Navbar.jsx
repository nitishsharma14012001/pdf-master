import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Moon, Sun, Menu, X, FileText, ChevronDown, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { toolCategories } from '../../utils/tools'
import { track } from '../../analytics'

export default function Navbar() {
  const { theme, toggle }   = useTheme()
  const { user, logout }    = useAuth()
  const [open, setOpen]     = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dropdown, setDropdown] = useState(null)
  const [userMenu, setUserMenu] = useState(false)
  const location  = useLocation()
  const navigate  = useNavigate()

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
    { label: 'Tools',    hasDropdown: true },
    { label: 'Pricing',  to: '/pricing' },
    { label: 'Features', to: '/#features' },
    { label: 'Contact',  to: '/contact' },
  ]

  const handleLoginClick = (location = 'navbar') => {
    track.login({ location })
    navigate('/login')
  }

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
            <span style={{ color: 'var(--text)' }}>PDF Master</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) =>
              link.hasDropdown ? (
                <div key={link.label} className="relative">
                  <button
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:text-blue-600"
                    style={{ color: 'var(--text)' }}
                    onClick={() => setDropdown(dropdown === link.label ? null : link.label)}
                    aria-expanded={dropdown === link.label}
                    aria-haspopup="true"
                  >
                    {link.label}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${dropdown === link.label ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {dropdown === link.label && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdown(null)} aria-hidden="true" />
                      <div
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[600px] rounded-2xl p-5 z-20 grid grid-cols-2 gap-2"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
                      >
                        {toolCategories.map((cat) => (
                          <div key={cat.label} className="mb-3">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--text-muted)' }}>
                              {cat.label}
                            </p>
                            {cat.tools.slice(0, 4).map((tool) => (
                              <Link
                                key={tool.id}
                                to={`/tools/${tool.id}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                                style={{ color: 'var(--text)' }}
                              >
                                {tool.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  to={link.to}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:text-blue-600"
                  style={{ color: 'var(--text)' }}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-muted)' }}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              /* User menu */
              <div className="relative">
                <button
                  onClick={() => setUserMenu(!userMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors hover:bg-black/5"
                  style={{ color: 'var(--text)', border: '1px solid var(--border)' }}
                  aria-expanded={userMenu}
                  aria-haspopup="true"
                  aria-label="User menu"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block max-w-[100px] truncate">{user.name || user.email}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${userMenu ? 'rotate-180' : ''}`} />
                </button>

                {userMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} aria-hidden="true" />
                    <div
                      className="absolute right-0 top-full mt-2 w-48 rounded-xl z-20 py-1 overflow-hidden"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
                    >
                      <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--text)' }}>
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ color: 'var(--text)' }}>
                          <Shield className="w-4 h-4" /> Admin
                        </Link>
                      )}
                      <hr style={{ borderColor: 'var(--border)', margin: '4px 0' }} />
                      <button
                        onClick={() => { logout(); setUserMenu(false) }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm w-full text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-red-500"
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Auth CTA — tracked */
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => handleLoginClick('navbar')}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:text-blue-600"
                  style={{ color: 'var(--text)' }}
                >
                  Sign in
                </button>
                <Link
                  to="/signup"
                  className="btn-primary py-2 px-4 text-sm"
                >
                  Get started
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(!open)}
              className="md:hidden p-2 rounded-lg"
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
        <div
          className="md:hidden border-t py-4 px-4 space-y-1"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {navLinks.filter((l) => !l.hasDropdown).map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="block px-3 py-2 rounded-lg text-sm font-medium"
              style={{ color: 'var(--text)' }}
            >
              {link.label}
            </Link>
          ))}
          <Link to="/tools/merge-pdf" className="block px-3 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--text)' }}>
            All Tools
          </Link>
          <hr style={{ borderColor: 'var(--border)', margin: '8px 0' }} />
          {user ? (
            <>
              <Link to="/dashboard" className="block px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text)' }}>Dashboard</Link>
              <button
                onClick={logout}
                className="block w-full text-left px-3 py-2 rounded-lg text-sm text-red-500"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleLoginClick('mobile_menu')}
                className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium"
                style={{ color: 'var(--text)' }}
              >
                Sign in
              </button>
              <Link to="/signup" className="btn-primary w-full justify-center mt-1">
                Get started
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
