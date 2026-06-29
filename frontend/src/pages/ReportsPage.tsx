import { useState, useEffect } from 'react'

const API_URL = 'http://localhost:8000'

function ReportsPage() {
  const [notebooks, setNotebooks] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [renderError, setRenderError] = useState('')

  // Buscar lista de notebooks ao carregar a página
  useEffect(() => {
    fetch(`${API_URL}/notebooks`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        return res.json()
      })
      .then((data: { notebooks: string[] }) => {
        setNotebooks(data.notebooks)
      })
      .catch((err) => {
        setListError(err instanceof Error ? err.message : 'Erro ao buscar notebooks')
      })
  }, [])

  // Buscar HTML do notebook selecionado
  const handleSelect = async (filename: string) => {
    setSelected(filename)
    setLoading(true)
    setHtml('')
    setRenderError('')

    try {
      const res = await fetch(`${API_URL}/notebooks/${encodeURIComponent(filename)}`)
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json()
      setHtml(data.html)
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Erro ao renderizar notebook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Relatórios
        </h1>
        <p className="text-slate-400 text-lg">
          Selecione um notebook para visualizar a análise e comparação dos modelos
        </p>
      </div>

      {/* Erro ao carregar lista */}
      {listError && (
        <div className="p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/50 text-center mb-6">
          <p className="text-red-400 font-medium">❌ {listError}</p>
          <p className="text-slate-500 text-sm mt-2">
            Verifique se o back-end está rodando em {API_URL}
          </p>
        </div>
      )}

      {/* Layout: lista à esquerda, conteúdo à direita */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lista de Notebooks */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-phish-card rounded-2xl border border-white/10 overflow-hidden sticky top-24">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                📁 Notebooks ({notebooks.length})
              </h2>
            </div>
            {notebooks.length === 0 && !listError ? (
              <div className="p-6 text-center text-slate-500">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-sm">Nenhum notebook encontrado na pasta <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">notebooks/</code></p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {notebooks.map((name) => (
                  <li key={name}>
                    <button
                      onClick={() => handleSelect(name)}
                      className={`w-full text-left px-5 py-4 transition-all duration-200 hover:bg-white/5 ${
                        selected === name
                          ? 'bg-phish-accent/10 border-l-4 border-phish-accent text-white'
                          : 'text-slate-300 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📓</span>
                        <span className="text-sm font-medium truncate">{name}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Conteúdo do Notebook */}
        <div className="flex-1 min-w-0">
          {!selected && (
            <div className="text-center p-16 rounded-2xl border border-dashed border-white/10">
              <div className="text-5xl mb-4 opacity-50">📊</div>
              <p className="text-slate-500 text-lg">
                Selecione um notebook na lista ao lado para visualizar
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center p-16">
              <svg className="spinner w-10 h-10 mx-auto mb-4 text-phish-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-slate-400">Renderizando notebook...</p>
            </div>
          )}

          {renderError && (
            <div className="p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/50 text-center">
              <p className="text-red-400 font-medium">❌ {renderError}</p>
            </div>
          )}

          {html && !loading && (
            <div className="bg-phish-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  📓 {selected}
                </h3>
              </div>
              <div
                className="notebook-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportsPage
