import { NavLink } from 'react-router-dom'

function Navbar() {
  return (
    <nav className="bg-phish-card/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Deep Phishing
            </span>
          </div>

          {/* Links de navegação */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/test"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-phish-accent text-white shadow-lg shadow-phish-accent/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              🔍 Teste de URL
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-phish-accent text-white shadow-lg shadow-phish-accent/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              📊 Relatórios
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
