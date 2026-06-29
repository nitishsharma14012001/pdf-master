import { Link } from 'react-router-dom'
import { FileText, Github, Twitter, Linkedin, Heart } from 'lucide-react'
import { toolCategories } from '../../utils/tools'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
              >
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="gradient-text">PDF Master</span>
            </Link>
            <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: 'var(--text-muted)' }}>
              The complete toolkit for working with PDFs and images. Free, fast, secure — no sign-up required for most tools.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                { icon: Github, href: 'https://github.com', label: 'GitHub' },
                { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:text-blue-600 hover:scale-110"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Tool categories */}
          {toolCategories.slice(0, 3).map((cat) => (
            <div key={cat.id}>
              <h4 className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>
                {cat.label}
              </h4>
              <ul className="space-y-2">
                {cat.tools.slice(0, 6).map((tool) => (
                  <li key={tool.id}>
                    <Link to={`/tools/${tool.id}`} className="text-sm transition-colors hover:text-blue-600" style={{ color: 'var(--text-muted)' }}>
                      {tool.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            © {year} PDF Master. Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> for everyone.
          </p>
          <div className="flex items-center gap-6">
            {[
              { label: 'About', to: '/about' },
              { label: 'Privacy Policy', to: '/privacy' },
              { label: 'Terms & Conditions', to: '/terms' },
              { label: 'Contact', to: '/contact' },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="text-sm transition-colors hover:text-blue-600" style={{ color: 'var(--text-muted)' }}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
