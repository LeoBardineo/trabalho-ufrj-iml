import { useState } from 'react'

const API_URL = 'http://localhost:8000'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface PredictResult {
  url: string
  features: Record<string, number | string>
  prediction: number | null
  label: string | null
}

function UrlTestPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<PredictResult | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = url.trim()
    if (!trimmed) return

    setStatus('loading')
    setResult(null)
    setError('')

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || `Erro ${response.status}`)
      }

      const data: PredictResult = await response.json()
      setResult(data)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar com a API')
      setStatus('error')
    }
  }

  const isPhishing = result?.label === 'phishing' || result?.prediction === 1
  const isLegitimate = result?.label === 'legitimate' || result?.prediction === 0
  const hasModelResult = result?.prediction !== null && result?.prediction !== undefined

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Teste de URL
        </h1>
        <p className="text-slate-400 text-lg">
          Cole uma URL abaixo para verificar se ela é potencialmente phishing
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com.br"
            className="flex-1 px-5 py-4 bg-phish-card border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-phish-accent focus:border-transparent transition-all text-lg"
            disabled={status === 'loading'}
          />
          <button
            id="verify-button"
            type="submit"
            disabled={status === 'loading' || !url.trim()}
            className="px-8 py-4 bg-phish-accent hover:bg-blue-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-phish-accent/25 hover:shadow-phish-accent/40 text-lg"
          >
            {status === 'loading' ? (
              <span className="flex items-center gap-2">
                <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verificando...
              </span>
            ) : (
              '🔍 Verificar'
            )}
          </button>
        </div>
      </form>

      {/* Resultado */}
      {status === 'success' && result && (
        <div className="space-y-6">
          {/* Card de resultado principal */}
          {hasModelResult ? (
            <div
              id="result-card"
              className={`p-8 rounded-2xl border-2 text-center transition-all ${
                isPhishing
                  ? 'bg-red-500/10 border-red-500/50 pulse-danger'
                  : 'bg-green-500/10 border-green-500/50 pulse-safe'
              }`}
            >
              <div className="text-6xl mb-4">{isPhishing ? '🚨' : '✅'}</div>
              <h2 className={`text-3xl font-bold mb-2 ${isPhishing ? 'text-red-400' : 'text-green-400'}`}>
                {isPhishing ? 'Phishing Detectado!' : 'URL Legítima'}
              </h2>
              <p className="text-slate-400 text-lg break-all">{result.url}</p>
            </div>
          ) : (
            <div id="result-card" className="p-8 rounded-2xl border-2 bg-yellow-500/10 border-yellow-500/50 text-center">
              <div className="text-6xl mb-4">⚙️</div>
              <h2 className="text-2xl font-bold mb-2 text-yellow-400">
                Features Extraídas com Sucesso
              </h2>
              <p className="text-slate-400">
                O modelo de ML ainda não está plugado no back-end. As features abaixo foram extraídas da URL.
              </p>
            </div>
          )}

          {/* Tabela de features */}
          <div className="bg-phish-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-slate-200">
                📋 Features Extraídas ({Object.keys(result.features).length})
              </h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Feature</th>
                    <th className="text-right px-6 py-3 text-sm font-medium text-slate-400">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.features).map(([key, value]) => (
                    <tr key={key} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-3 text-sm text-slate-300 font-mono">{key}</td>
                      <td className="px-6 py-3 text-sm text-right text-slate-100 font-mono">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Erro */}
      {status === 'error' && (
        <div id="error-card" className="p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/50 text-center">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-xl font-bold text-red-400 mb-2">Erro na Verificação</h2>
          <p className="text-slate-400">{error}</p>
          <button
            onClick={() => { setStatus('idle'); setError('') }}
            className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Dica quando idle */}
      {status === 'idle' && (
        <div className="text-center p-10 rounded-2xl border border-dashed border-white/10">
          <div className="text-5xl mb-4 opacity-50">🔗</div>
          <p className="text-slate-500 text-lg">
            Cole uma URL acima e clique em <strong className="text-slate-400">Verificar</strong> para analisar
          </p>
        </div>
      )}
    </div>
  )
}

export default UrlTestPage
