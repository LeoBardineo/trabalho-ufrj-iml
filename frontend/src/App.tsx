import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import UrlTestPage from './pages/UrlTestPage'
import ReportsPage from './pages/ReportsPage'

function App() {
  return (
    <div className="min-h-screen bg-phish-dark">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/test" replace />} />
          <Route path="/test" element={<UrlTestPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
