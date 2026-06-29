import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

// Demo users for prototype
const DEMO_USERS = [
  { id: '1', email: 'admin@pdfmaster.app', password: 'admin123', name: 'Admin User', role: 'admin', plan: 'pro' },
  { id: '2', email: 'user@example.com', password: 'user123', name: 'John Doe', role: 'user', plan: 'free' },
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('auth_user')
    if (saved) {
      try { setUser(JSON.parse(saved)) } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    await new Promise(r => setTimeout(r, 800)) // Simulate API
    const found = DEMO_USERS.find(u => u.email === email && u.password === password)
    if (!found) throw new Error('Invalid email or password')
    const { password: _, ...safeUser } = found
    setUser(safeUser)
    localStorage.setItem('auth_user', JSON.stringify(safeUser))
    return safeUser
  }

  const signup = async (name, email, password) => {
    await new Promise(r => setTimeout(r, 1000))
    const exists = DEMO_USERS.find(u => u.email === email)
    if (exists) throw new Error('Email already in use')
    const newUser = { id: Date.now().toString(), name, email, role: 'user', plan: 'free' }
    setUser(newUser)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    return newUser
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  const resetPassword = async (email) => {
    await new Promise(r => setTimeout(r, 800))
    // In production, send email
    return true
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
