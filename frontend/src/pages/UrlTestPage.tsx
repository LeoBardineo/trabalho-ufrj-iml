import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:8000'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface PredictResult {
  url: string
  features: Record<string, number | string>
  prediction: number | null
  label: string | null
  model_used?: string
}

function UrlTestPage() {
  const [url, setUrl] = useState(() => sessionStorage.getItem('test_url') || '')
  const [status, setStatus] = useState<Status>(() => (sessionStorage.getItem('test_status') as Status) || 'idle')
  const [result, setResult] = useState<PredictResult | null>(() => {
    const saved = sessionStorage.getItem('test_result')
    return saved ? JSON.parse(saved) : null
  })
  const [error, setError] = useState(() => sessionStorage.getItem('test_error') || '')
  const [models, setModels] = useState<{ key: string; label: string }[]>([
    { key: 'arvore_otimizado', label: 'Automático (Árvore de Decisão Otimizada)' }
  ])
  const [selectedModel, setSelectedModel] = useState(() => sessionStorage.getItem('test_model') || 'arvore_otimizado')

  const handleSetUrl = (val: string) => {
    setUrl(val)
    sessionStorage.setItem('test_url', val)
  }
  const handleSetStatus = (val: Status) => {
    setStatus(val)
    sessionStorage.setItem('test_status', val)
  }
  const handleSetResult = (val: PredictResult | null) => {
    setResult(val)
    if (val) {
      sessionStorage.setItem('test_result', JSON.stringify(val))
    } else {
      sessionStorage.removeItem('test_result')
    }
  }
  const handleSetError = (val: string) => {
    setError(val)
    sessionStorage.setItem('test_error', val)
  }
  const handleSetSelectedModel = (val: string) => {
    setSelectedModel(val)
    sessionStorage.setItem('test_model', val)
  }

  useEffect(() => {
    fetch(`${API_URL}/predict/models`)
      .then(res => res.json())
      .then(data => {
        if (data && data.models) {
          setModels(data.models)
          if (data.default && !sessionStorage.getItem('test_model')) {
            handleSetSelectedModel(data.default)
          }
        }
      })
      .catch(err => console.error('Erro ao buscar modelos:', err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = url.trim()
    if (!trimmed) return

    handleSetStatus('loading')
    handleSetResult(null)
    handleSetError('')

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, model_key: selectedModel }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || `Erro ${response.status}`)
      }

      const data: PredictResult = await response.json()
      handleSetResult(data)
      handleSetStatus('success')
    } catch (err) {
      handleSetError(err instanceof Error ? err.message : 'Erro ao conectar com a API')
      handleSetStatus('error')
    }
  }

  const getModelLabel = (key: string) => {
    return models.find(m => m.key === key)?.label || key
  }

  const isPhishing = result?.label === 'phishing' || result?.prediction === 0
  const isLegitimate = result?.label === 'legitimate' || result?.prediction === 1
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
      <form onSubmit={handleSubmit} className="mb-8 space-y-4">
        {/* Seletor de Modelo */}
        <div className="flex flex-col gap-2">
          <label htmlFor="model-select" className="text-sm font-semibold text-slate-300">
            Modelo de Inteligência Artificial
          </label>
          <div className="relative">
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => handleSetSelectedModel(e.target.value)}
              className="w-full px-5 py-3.5 bg-phish-card border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-phish-accent focus:border-transparent transition-all text-base appearance-none cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Input da URL e Botão de Submit */}
        <div className="flex gap-3">
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => handleSetUrl(e.target.value)}
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
              <p className="text-slate-400 text-sm mt-3">
                Modelo utilizado: <span className="font-semibold text-slate-200">{getModelLabel(result.model_used || '')}</span>
              </p>
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
                <thead className="bg-[#1e293b] sticky top-0 z-10">
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
            onClick={() => { handleSetStatus('idle'); handleSetError('') }}
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
