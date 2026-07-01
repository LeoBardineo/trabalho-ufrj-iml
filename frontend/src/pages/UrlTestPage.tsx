import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'

const API_URL = 'http://localhost:8000'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface PcaCoords {
  pc1: number
  pc2: number
}

interface DecisionPathNode {
  node_id: number
  feature: string | null
  threshold: number | null
  value: number | null
  decision: string | null // "left", "right" ou "leaf"
  is_leaf: boolean
}

interface TreeNode {
  node_id: number
  is_leaf: boolean
  samples: number
  value: number[]
  class_name: string
  impurity: number
  feature?: string
  threshold?: number
  left?: TreeNode
  right?: TreeNode
  x?: number
  y?: number
}

interface ModelPredictResult {
  prediction: number | null
  label: string | null
  phishing_probability?: number | null
  pca_coords?: PcaCoords | null
  decision_path?: DecisionPathNode[] | null
  full_tree?: TreeNode | null
}

interface PredictResult {
  url: string
  features: Record<string, number | string>
  predictions: Record<string, ModelPredictResult>
}

interface HistoryItem {
  url: string
  timestamp: number
  model_used: string
  result: PredictResult
}

interface RenderNode {
  id: number
  x: number
  y: number
  isLeaf: boolean
  samples: number
  value: number[]
  className: string
  impurity: number
  feature?: string
  threshold?: number
  isVisited: boolean
}

interface RenderEdge {
  fromX: number
  fromY: number
  toX: number
  toY: number
  label: string
  isVisited: boolean
}

function RiskGauge({ probability }: { probability: number }) {
  const percentage = Math.round(probability * 100)
  
  let strokeColor = 'stroke-red-500'
  let textColor = 'text-red-400'
  if (percentage > 70) {
    strokeColor = 'stroke-red-500'
    textColor = 'text-red-400'
  } else if (percentage > 30) {
    strokeColor = 'stroke-yellow-500'
    textColor = 'text-yellow-400'
  } else {
    strokeColor = 'stroke-green-500'
    textColor = 'text-green-400'
  }

  // Circunferência do círculo com raio 58 é 2 * PI * 58 = 364.42
  const circumference = 364.42
  const strokeDashoffset = circumference - (circumference * percentage) / 100

  return (
    <div className="flex flex-col items-center justify-center bg-phish-card p-6 rounded-2xl border border-white/10 relative overflow-hidden">
      <h4 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Grau de Risco</h4>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r="58"
            className="stroke-slate-700 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="72"
            cy="72"
            r="58"
            className={`fill-none ${strokeColor} transition-all duration-1000 ease-out`}
            strokeWidth="8"
            strokeDasharray="364.42"
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`text-3xl font-extrabold ${textColor}`}>{percentage}%</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
            {percentage > 70 ? 'Phishing' : percentage > 30 ? 'Suspeito' : 'Seguro'}
          </span>
        </div>
      </div>
    </div>
  )
}

function UrlTestPage() {
  const [url, setUrl] = useState(() => sessionStorage.getItem('test_url') || '')
  const [status, setStatus] = useState<Status>(() => (sessionStorage.getItem('test_status') as Status) || 'idle')
  const [result, setResult] = useState<PredictResult | null>(() => {
    try {
      const saved = sessionStorage.getItem('test_result')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Apenas carrega se for do formato multi-modelo novo (evita crash na troca de features)
        return parsed && parsed.predictions ? parsed : null
      }
      return null
    } catch {
      return null
    }
  })
  const [error, setError] = useState(() => sessionStorage.getItem('test_error') || '')
  const [models, setModels] = useState<{ key: string; label: string }[]>([
    { key: 'arvore_otimizado', label: 'Automático (Árvore de Decisão Otimizada)' }
  ])
  const [focusModel, setFocusModel] = useState(() => sessionStorage.getItem('test_model') || 'arvore_otimizado')
  const [pcaBackground, setPcaBackground] = useState<{ pc1: number; pc2: number; label: number }[]>([])
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('phish_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Apenas carrega itens que contêm o dicionário 'predictions' do novo formato multi-modelo
        return Array.isArray(parsed) ? parsed.filter(item => item && item.result && item.result.predictions) : []
      }
      return []
    } catch {
      return []
    }
  })

  // Estados de Zoom e Pan para a Árvore independentes por modelo
  const [treeViews, setTreeViews] = useState<Record<string, { zoom: number, panX: number, panY: number }>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })



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
  const handleSetFocusModel = (val: string) => {
    setFocusModel(val)
    sessionStorage.setItem('test_model', val)
  }

  useEffect(() => {
    fetch(`${API_URL}/predict/models`)
      .then(res => res.json())
      .then(data => {
        if (data && data.models) {
          setModels(data.models)
          if (data.default && !sessionStorage.getItem('test_model')) {
            handleSetFocusModel(data.default)
          }
        }
      })
      .catch(err => console.error('Erro ao buscar modelos:', err))

    fetch(`${API_URL}/predict/pca-data`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPcaBackground(data)
        }
      })
      .catch(err => console.error('Erro ao buscar dados do PCA:', err))
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
        body: JSON.stringify({ url: trimmed }), // Roda todos os modelos no back-end
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || `Erro ${response.status}`)
      }

      const data: PredictResult = await response.json()
      handleSetResult(data)
      handleSetStatus('success')

      // Salvar no histórico de buscas com o resultado de predição completo
      const historyItem: HistoryItem = {
        url: data.url,
        timestamp: Date.now(),
        model_used: focusModel,
        result: data
      }
      setHistory(prev => {
        const filtered = prev.filter(h => h.url !== historyItem.url)
        const updated = [historyItem, ...filtered].slice(0, 10)
        localStorage.setItem('phish_history', JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      handleSetError(err instanceof Error ? err.message : 'Erro ao conectar com a API')
      handleSetStatus('error')
    }
  }

  const getModelLabel = (key: string) => {
    return models.find(m => m.key === key)?.label || key
  }

  const clearHistory = () => {
    localStorage.removeItem('phish_history')
    setHistory([])
  }



  // Resolvendo a predição para o modelo focado no painel
  const focusResult = result?.predictions?.[focusModel]
  const isPhishing = focusResult?.label === 'phishing' || focusResult?.prediction === 0
  const isLegitimate = focusResult?.label === 'legitimate' || focusResult?.prediction === 1
  const hasModelResult = focusResult?.prediction !== null && focusResult?.prediction !== undefined

  const legitPoints = pcaBackground.filter(p => p.label === 1)
  const phishPoints = pcaBackground.filter(p => p.label === 0)

  // Layout geométrico da árvore usando o algoritmo in-order midpoint para espaçamento compacto sem sobreposição
  const nodes: RenderNode[] = []
  const edges: RenderEdge[] = []
  let leafCount = 0

  if (focusResult?.full_tree) {
    const visitedSet = new Set(focusResult.decision_path?.map(n => n.node_id) || [])
    const maxDepth = 5 // Mantém profundidade máxima 5 como no notebook

    // Passagem 1: Calcula as coordenadas usando in-order midpoint para simetria compacta perfeita
    const assignCoords = (node: TreeNode, depth: number): number => {
      const isVisited = visitedSet.has(node.node_id)
      const isPlaceholder = !isVisited && depth >= maxDepth

      if (isPlaceholder || node.is_leaf) {
        const x = leafCount * 180 // 180px de espaçamento horizontal constante
        node.x = x
        node.y = depth * 170 // 170px de espaçamento vertical para evitar colisão das linhas
        leafCount++
        return x
      }

      const leftX = assignCoords(node.left!, depth + 1)
      const rightX = assignCoords(node.right!, depth + 1)
      const x = (leftX + rightX) / 2
      node.x = x
      node.y = depth * 170
      return x
    }

    assignCoords(focusResult.full_tree, 0)

    // Passagem 2: Centraliza a árvore em X=0 e coleta os nós/conexões para renderização
    const centerOffset = ((leafCount - 1) * 180) / 2

    const collectRenderData = (node: TreeNode, depth: number) => {
      const isVisited = visitedSet.has(node.node_id)
      const isPlaceholder = !isVisited && depth >= maxDepth
      
      const x = (node.x || 0) - centerOffset
      const y = node.y || 0

      nodes.push({
        id: node.node_id,
        x,
        y,
        isLeaf: isPlaceholder ? true : node.is_leaf,
        samples: node.samples,
        value: node.value,
        className: node.class_name,
        impurity: node.impurity,
        feature: isPlaceholder ? "[ ... ]" : node.feature,
        threshold: node.threshold,
        isVisited
      })

      if (!isPlaceholder && !node.is_leaf && node.left && node.right) {
        const leftX = (node.left.x || 0) - centerOffset
        const leftY = node.left.y || 0
        const rightX = (node.right.x || 0) - centerOffset
        const rightY = node.right.y || 0

        const leftVisited = isVisited && visitedSet.has(node.left.node_id)
        const rightVisited = isVisited && visitedSet.has(node.right.node_id)

        edges.push({
          fromX: x,
          fromY: y,
          toX: leftX,
          toY: leftY,
          label: 'Sim',
          isVisited: leftVisited
        })

        edges.push({
          fromX: x,
          fromY: y,
          toX: rightX,
          toY: rightY,
          label: 'Não',
          isVisited: rightVisited
        })

        collectRenderData(node.left, depth + 1)
        collectRenderData(node.right, depth + 1)
      }
    }

    collectRenderData(focusResult.full_tree, 0)
  }

  // Largura e ViewBox do SVG calculados de forma dinâmica para ajustar perfeitamente a árvore na tela
  const treeWidth = Math.max(leafCount * 180, 1200)
  const treeHalfWidth = treeWidth / 2

  // Foco inicial centralizado na raiz da árvore (apontando para o caminho dourado)
  const rootNode = nodes.find(n => n.id === (focusResult?.full_tree?.node_id ?? 0))
  const rootX = rootNode ? rootNode.x : 0

  const zoom = treeViews[focusModel]?.zoom ?? 0.85
  const defaultPanX = -rootX * zoom
  const panX = treeViews[focusModel]?.panX ?? defaultPanX
  const panY = treeViews[focusModel]?.panY ?? 0

  const setZoom = (val: number | ((z: number) => number)) => {
    setTreeViews(prev => {
      const oldZ = prev[focusModel]?.zoom ?? 0.85
      const newZ = typeof val === 'function' ? val(oldZ) : val
      return { ...prev, [focusModel]: { ...(prev[focusModel] || {panX: defaultPanX, panY: 0}), zoom: newZ } }
    })
  }
  const setPanX = (val: number | ((x: number) => number)) => {
    setTreeViews(prev => {
      const oldX = prev[focusModel]?.panX ?? defaultPanX
      const newX = typeof val === 'function' ? val(oldX) : val
      return { ...prev, [focusModel]: { ...(prev[focusModel] || {zoom: 0.85, panY: 0}), panX: newX } }
    })
  }
  const setPanY = (val: number | ((y: number) => number)) => {
    setTreeViews(prev => {
      const oldY = prev[focusModel]?.panY ?? 0
      const newY = typeof val === 'function' ? val(oldY) : val
      return { ...prev, [focusModel]: { ...(prev[focusModel] || {zoom: 0.85, panX: defaultPanX}), panY: newY } }
    })
  }

  // Funções de Arrastar/Pan da Árvore
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanX(e.clientX - dragStart.x)
    setPanY(e.clientY - dragStart.y)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Teste de URL
        </h1>
        <p className="text-slate-400 text-lg">
          Cole uma URL abaixo para analisar a sua legitimidade com Inteligência Artificial
        </p>
      </div>

      {/* Grid de Entrada */}
      <div className="max-w-3xl mx-auto mb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input da URL */}
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

        {/* Histórico Recente */}
        {history.length > 0 && (
          <div className="mt-4 p-4 bg-phish-card/30 border border-white/5 rounded-xl">
            <div className="flex justify-between items-center mb-2.5">
              <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">Histórico de Consultas</h3>
              <button
                onClick={clearHistory}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Limpar Histórico
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((item, idx) => {
                const itemResult = item.result
                // Fixa o modelo focado na Árvore Otimizada para determinar a cor permanente no histórico
                const focusItemResult = itemResult.predictions?.['arvore_otimizado'] || 
                  (itemResult.predictions ? Object.values(itemResult.predictions)[0] : null)
                const isPhish = focusItemResult?.label === 'phishing' || focusItemResult?.prediction === 0
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      handleSetUrl(item.url)
                      handleSetFocusModel(item.model_used)
                      handleSetResult(item.result)
                      handleSetStatus('success')
                      handleSetError('')
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                      isPhish
                        ? 'bg-red-500/5 hover:bg-red-500/10 border-red-500/20 text-red-300'
                        : 'bg-green-500/5 hover:bg-green-500/10 border-green-500/20 text-green-300'
                    }`}
                  >
                    <span>{isPhish ? '🚨' : '✅'}</span>
                    <span className="truncate max-w-[150px]">{item.url}</span>
                    <span className="text-[10px] text-slate-500 ml-1 font-mono">
                      (Consultado)
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Área de Resultados */}
      {status === 'success' && result && (
        <div className="space-y-8">
          
          {/* Painel Comparativo Multi-Modelo */}
          <div className="bg-phish-card p-6 rounded-2xl border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-200">
                  📊 Painel Comparativo de Modelos
                </h3>
                <p className="text-xs text-slate-400">
                  Comparação das predições de todos os modelos de IA para a URL analisada em tempo real. Clique em um modelo para focar.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((m) => {
                const predObj = result.predictions?.[m.key]
                if (!predObj) return null

                const isModelPhish = predObj.label === 'phishing' || predObj.prediction === 0
                const isModelLgt = predObj.label === 'legitimate' || predObj.prediction === 1
                const prob = predObj.phishing_probability !== null && predObj.phishing_probability !== undefined
                  ? Math.round(predObj.phishing_probability * 100)
                  : null

                const isActive = focusModel === m.key

                return (
                  <div
                    key={m.key}
                    onClick={() => handleSetFocusModel(m.key)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between ${
                      isActive
                        ? 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                        : 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60 hover:border-white/10'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-300 truncate max-w-[170px]" title={m.label}>
                          {m.label.replace('Automático (', '').replace(')', '')}
                        </span>
                        {m.key === 'arvore_otimizado' && (
                          <span className="text-[10px] text-[#facc15] font-semibold">🏆 Melhor Modelo</span>
                        )}
                      </div>
                      {isActive && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                          Foco
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                          isModelPhish
                            ? 'bg-red-500/15 text-red-400'
                            : isModelLgt
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isModelPhish ? '🚨 Phishing' : isModelLgt ? '✅ Seguro' : 'Sem Dados'}
                      </span>
                      
                      {prob !== null ? (
                        <span className={`text-sm font-extrabold ${isModelPhish ? 'text-red-400' : 'text-green-400'}`}>
                          {isModelPhish ? prob : 100 - prob}%
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          N/A (Geométrico)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Linha Superior: Resultados Básicos e Features Extraídas (Lado a Lado) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Lado Esquerdo: Phishing Card + Gauge (Exibido apenas se Phishing) */}
            <div className="space-y-6 flex flex-col justify-between">
              {hasModelResult ? (
                <div className={`flex flex-col ${isPhishing ? 'md:flex-row' : ''} gap-6 items-stretch h-full`}>
                  {/* Status Principal */}
                  <div
                    id="result-card"
                    className={`flex-1 p-8 rounded-2xl border-2 text-center flex flex-col items-center justify-center transition-all ${
                      isPhishing
                        ? 'bg-red-500/10 border-red-500/50'
                        : 'bg-green-500/10 border-green-500/50'
                    }`}
                  >
                    <div className="text-6xl mb-4">{isPhishing ? '🚨' : '✅'}</div>
                    <h2 className={`text-3xl font-bold mb-2 ${isPhishing ? 'text-red-400' : 'text-green-400'}`}>
                      {isPhishing ? 'Phishing Detectado!' : 'URL Legítima'}
                    </h2>
                    <p className="text-slate-400 text-sm break-all font-mono mb-2">{result.url}</p>
                    <p className="text-slate-500 text-xs mt-3">
                      Modelo em Foco: <span className="font-semibold text-slate-300">{getModelLabel(focusModel)}</span>
                    </p>
                  </div>
                  
                  {/* Grau de Risco - Exibido APENAS se isPhishing for verdadeiro */}
                  {isPhishing && focusResult?.phishing_probability !== null && focusResult?.phishing_probability !== undefined && (
                    <RiskGauge probability={focusResult.phishing_probability} />
                  )}
                </div>
              ) : (
                <div id="result-card" className="p-8 rounded-2xl border-2 bg-yellow-500/10 border-yellow-500/50 text-center h-full flex flex-col items-center justify-center">
                  <div className="text-6xl mb-4">⚙️</div>
                  <h2 className="text-2xl font-bold mb-2 text-yellow-400">
                    Features Extraídas
                  </h2>
                  <p className="text-slate-400">
                    Predição indisponível para este modelo no momento.
                  </p>
                </div>
              )}
            </div>

            {/* Lado Direito: Tabela de Features Extraídas */}
            <div className="bg-phish-card rounded-2xl border border-white/10 overflow-hidden flex flex-col h-full max-h-[340px]">
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-slate-200">
                  📋 Features Extraídas ({Object.keys(result.features).length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
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

          {/* Abaixo: Projeção PCA (Largura Total) - Exibido apenas se o modelo em foco for K-Means */}
          {focusModel === 'kmeans' && pcaBackground.length > 0 && focusResult?.pca_coords && (
            <div className="bg-phish-card p-6 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">
                📊 Projeção Geométrica PCA (2D)
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Visualização em tempo real da URL buscada (ponto brilhante) no espaço das classes do dataset.
              </p>
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
                    <XAxis
                      type="number"
                      dataKey="pc1"
                      name="PC1"
                      domain={['auto', 'auto']}
                      label={{ value: 'Componente Principal 1', position: 'bottom', fill: '#94a3b8', fontSize: 11, offset: 5 }}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="pc2"
                      name="PC2"
                      domain={['auto', 'auto']}
                      label={{ value: 'Componente Principal 2', angle: -90, position: 'left', fill: '#94a3b8', fontSize: 11, offset: 5 }}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <Tooltip cursor={false} />
                    <Scatter name="Legítimo" data={legitPoints} fill="#3b82f6" opacity={0.4} shape="circle" />
                    <Scatter name="Phishing" data={phishPoints} fill="#ef4444" opacity={0.4} shape="circle" />
                    
                    {/* Efeito Ping Pulsante na URL Testada */}
                    <Scatter
                      name="URL Testada"
                      data={[{ pc1: focusResult.pca_coords.pc1, pc2: focusResult.pca_coords.pc2 }]}
                      fill="#facc15"
                      shape={(props: any) => {
                        const { cx, cy } = props
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={10}
                            fill="#facc15"
                            className="animate-ping opacity-75"
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                          />
                        )
                      }}
                    />
                    {/* Ponto Fixo da URL Testada */}
                    <Scatter
                      name="URL Testada Fixo"
                      data={[{ pc1: focusResult.pca_coords.pc1, pc2: focusResult.pca_coords.pc2 }]}
                      fill="#facc15"
                      shape={(props: any) => {
                        const { cx, cy } = props
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="#facc15"
                            stroke="#ffffff"
                            strokeWidth={2.5}
                            className="drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]"
                          />
                        )
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              {/* Legenda do Gráfico */}
              <div className="flex justify-center gap-6 mt-2 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] opacity-80" /> Legítimo
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] opacity-80" /> Phishing
                </span>
                <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                  <span className="w-3 h-3 rounded-full bg-[#facc15] border border-white" /> URL Buscada
                </span>
              </div>
            </div>
          )}

          {/* Abaixo: Árvore de Decisão Visual Interativa (Largura Total com Zoom/Pan) - Apenas para Modelos de Árvore */}
          {(focusModel === 'arvore_base' || focusModel === 'arvore_otimizado') && focusResult?.full_tree && (
            <div className="bg-phish-card p-6 rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">
                    🌳 Gráfico da Árvore de Decisão
                  </h3>
                  <div className="text-xs text-slate-400 mt-1 space-y-1">
                    <p>Navegue pela árvore de decisão original (profundidade limite = 5).</p>
                    <p>O caminho tomado para classificar esta URL está destacado em <span className="text-[#facc15] font-semibold">dourado</span>.</p>
                    <p>Clique e arraste para mover, use os botões ao lado para dar zoom.</p>
                  </div>
                </div>
                {/* Controles de Zoom */}
                <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-white/5 select-none">
                  <button
                    onClick={() => setZoom(z => Math.min(z + 0.15, 2))}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-xs font-bold text-slate-200 transition-colors"
                    title="Aumentar Zoom"
                  >
                    🔍 Aumentar
                  </button>
                  <button
                    onClick={() => setZoom(z => Math.max(z - 0.15, 0.35))}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-xs font-bold text-slate-200 transition-colors"
                    title="Diminuir Zoom"
                  >
                    🔍 Diminuir
                  </button>
                  <button
                    onClick={() => { setZoom(0.85); setPanX(-rootX * 0.85); setPanY(0); }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-xs font-bold text-slate-200 transition-colors"
                    title="Resetar Foco"
                  >
                    🔄 Resetar
                  </button>
                </div>
              </div>
              
              {/* Box de Desenho com Drag e MouseMove */}
              <div 
                className="w-full h-[580px] bg-slate-950/60 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border border-white/5 relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div 
                  style={{
                    transform: `translate(-50%, 0) translate(${panX}px, ${panY}px) scale(${zoom})`,
                    transformOrigin: '50% 0%',
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                  }}
                  className="absolute left-1/2 top-8 pointer-events-none select-none"
                >
                  <svg width={treeWidth} height="780" viewBox={`-${treeHalfWidth} 0 ${treeWidth} 780`} style={{ overflow: 'visible' }}>
                    {/* Renderizar as Conexões (Linhas) entre Nós */}
                    {edges.map((edge, idx) => (
                      <g key={idx}>
                        <line
                          x1={edge.fromX}
                          y1={edge.fromY + 55}
                          x2={edge.toX}
                          y2={edge.toY - 55}
                          stroke={edge.isVisited ? '#facc15' : 'rgba(255,255,255,0.1)'}
                          strokeWidth={edge.isVisited ? 3 : 1}
                          strokeDasharray={edge.isVisited ? undefined : '3 3'}
                        />
                        {/* Texto descritivo True/False nos desvios */}
                        <text
                          x={(edge.fromX + edge.toX) / 2 + (edge.label === 'Sim' ? -25 : 25)}
                          y={(edge.fromY + 55 + edge.toY - 55) / 2 - 5}
                          fill={edge.isVisited ? '#facc15' : '#475569'}
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {edge.label === 'Sim' ? 'True' : 'False'}
                        </text>
                      </g>
                    ))}

                    {/* Renderizar os Cartões (Nodes) */}
                    {nodes.map((node) => {
                      const isPlaceholder = node.feature === "[ ... ]";
                      return (
                        <g key={node.id}>
                          {isPlaceholder ? (
                            /* Renderiza um nó placeholder simples com (...) em cinza escuro, igual ao notebook */
                            <g transform={`translate(${node.x - 25}, ${node.y - 15})`}>
                              <rect
                                width="50"
                                height="30"
                                rx="4"
                                fill="rgba(255,255,255,0.06)"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="1"
                              />
                              <text x="25" y="18" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">
                                (...)
                              </text>
                            </g>
                          ) : (
                            <g transform={`translate(${node.x - 75}, ${node.y - 55})`}>
                              <rect
                                width="150"
                                height="110"
                                rx="6"
                                fill={node.className === 'Phishing' ? '#2563eb' : '#ea580c'}
                                fillOpacity={node.isVisited ? 0.35 : 0.12}
                                stroke={node.isVisited ? '#facc15' : 'rgba(255,255,255,0.08)'}
                                strokeWidth={node.isVisited ? 2.5 : 1}
                                className={node.isVisited ? 'drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : ''}
                              />
                              {node.isLeaf ? (
                                /* Nó Folha: labels explicativos organizados (sem título, como no plot_tree do sklearn) */
                                <>
                                  <text x="75" y="24" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    entropy = {node.impurity.toFixed(3)}
                                  </text>
                                  <text x="75" y="48" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    amostras = {node.samples}
                                  </text>
                                  <text x="75" y="72" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    valores = [{Math.round(node.value[0] * node.samples)}, {Math.round(node.value[1] * node.samples)}]
                                  </text>
                                  <text
                                    x="75"
                                    y="96"
                                    textAnchor="middle"
                                    fill={node.className === 'Phishing' ? '#93c5fd' : '#fdba74'}
                                    fontSize="10"
                                    fontWeight="bold"
                                  >
                                    Classe = {node.className}
                                  </text>
                                </>
                              ) : (
                                /* Nó de Divisão padrão */
                                <>
                                  <text x="75" y="20" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
                                    {node.feature} &lt;= {node.threshold?.toFixed(2)}
                                  </text>
                                  <text x="75" y="38" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    entropy = {node.impurity.toFixed(3)}
                                  </text>
                                  <text x="75" y="56" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    amostras = {node.samples}
                                  </text>
                                  <text x="75" y="74" textAnchor="middle" fill="#94a3b8" fontSize="10">
                                    valores = [{Math.round(node.value[0] * node.samples)}, {Math.round(node.value[1] * node.samples)}]
                                  </text>
                                  <text
                                    x="75"
                                    y="92"
                                    textAnchor="middle"
                                    fill={node.className === 'Phishing' ? '#93c5fd' : '#fdba74'}
                                    fontSize="10"
                                    fontWeight="bold"
                                  >
                                    Classe = {node.className}
                                  </text>
                                </>
                              )}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Erro */}
      {status === 'error' && (
        <div id="error-card" className="max-w-3xl mx-auto p-6 rounded-2xl bg-red-500/10 border-2 border-red-500/50 text-center">
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
        <div className="max-w-3xl mx-auto text-center p-10 rounded-2xl border border-dashed border-white/10">
          <div className="text-5xl mb-4 opacity-50">🔗</div>
          <p className="text-slate-500 text-lg">
            Cole uma URL acima e clique em <strong className="text-slate-400">Verificar</strong> para iniciar a análise visual
          </p>
        </div>
      )}
    </div>
  )
}

export default UrlTestPage
