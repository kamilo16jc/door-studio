import { useState, useRef } from 'react'
import axios from 'axios'
import { useTracerStore } from '../../store/tracerStore'
import { autoTraceFromSVG, autoTraceFromMasks, autoTraceRegions, generateEdgePreview } from '../../lib/autoTrace'
import { Wand2, Cpu, Eye, Check, X, RefreshCw, Layers, Bot, ScanSearch } from 'lucide-react'
import { TracedShape } from '../../types'

type Mode = 'idle' | 'running' | 'preview' | 'error'
type Tab = 'potrace' | 'claude' | 'ai' | 'regions'

export default function AutoTracer() {
  const {
    photoBackground, canvasWidth, canvasHeight,
    addShape, shapes, clearAll, setCanvasSize, setPhotoBackground
  } = useTracerStore()

  const [mode, setMode] = useState<Mode>('idle')
  const [progress, setProgress] = useState('')
  const [detectedShapes, setDetectedShapes] = useState<TracedShape[]>([])
  const [edgePreview, setEdgePreview] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('potrace')
  const [error, setError] = useState('')

  // Claude polling state
  const [claudeStatus, setClaudeStatus] = useState<'idle' | 'polling' | 'received'>('idle')
  const [claudeShapeCount, setClaudeShapeCount] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // ¿El input cargado es un SVG vectorial? → rasterizar a alta resolución
  const [inputIsVector, setInputIsVector] = useState(false)

  const hasPhoto = !!photoBackground

  // ─── Cargar archivo (SVG vectorial o imagen raster) ────────────────────────
  // Un SVG es input ideal: líneas perfectamente nítidas sin ruido.
  // URL.createObjectURL funciona como src de <img> tanto para SVG como raster.
  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    setInputIsVector(isSvg)
    setPhotoBackground(URL.createObjectURL(file))
    setActiveTab('regions')
    setMode('idle'); setError('')
    setDetectedShapes([]); setEdgePreview(null)
    e.target.value = ''
  }

  // ─── Auto-trazar con Potrace (vectorización local vía servidor) ─────────────
  const runLocalTrace = async () => {
    if (!photoBackground) return
    setMode('running')
    setError('')
    try {
      setProgress('Preparando imagen...')

      const response = await fetch(photoBackground)
      const blob = await response.blob()
      const file = new File([blob], 'door.jpg', { type: blob.type })

      const formData = new FormData()
      formData.append('photo', file)

      setProgress('Vectorizando con Potrace...')
      const res = await axios.post('/api/door/trace', formData)
      const { svg } = res.data as { svg: string }

      setProgress('Extrayendo trazos del SVG...')
      const found = await autoTraceFromSVG(svg, canvasWidth, canvasHeight, (msg) => setProgress(msg))

      const preview = await generateEdgePreview(photoBackground, canvasWidth, canvasHeight)
      setDetectedShapes(found)
      setEdgePreview(preview)
      setMode('preview')
    } catch (e: any) {
      setError('Error en vectorización: ' + e.message)
      setMode('error')
    }
  }

  // ─── Auto-trazar con SAM (Segment Anything Model) ───────────────────────────
  const runAITrace = async () => {
    if (!photoBackground) return
    setMode('running')
    setError('')

    try {
      setProgress('Preparando imagen...')

      const response = await fetch(photoBackground)
      const blob = await response.blob()
      const file = new File([blob], 'door.jpg', { type: blob.type })

      const formData = new FormData()
      formData.append('photo', file)
      formData.append('width',  String(canvasWidth))
      formData.append('height', String(canvasHeight))

      setProgress('Enviando a SAM (Segment Anything) — puede tardar ~40s...')
      const res = await axios.post('/api/door/segment', formData)
      const { masks } = res.data as { masks: string[] }

      setProgress(`SAM generó ${masks.length} máscaras. Procesando contornos...`)
      const found = await autoTraceFromMasks(
        masks, canvasWidth, canvasHeight,
        (msg) => setProgress(msg)
      )

      const preview = await generateEdgePreview(photoBackground, canvasWidth, canvasHeight)
      setDetectedShapes(found)
      setEdgePreview(preview)
      setMode('preview')
    } catch (e: any) {
      setError('Error con SAM: ' + e.message)
      setMode('error')
    }
  }

  // ─── Auto-trazar por regiones cerradas (Flood Fill + CCL) ──────────────────
  const runRegionsTrace = async () => {
    if (!photoBackground) return
    setMode('running')
    setError('')
    try {
      setProgress('Midiendo imagen...')
      // CLAVE: trazar a la resolución/aspecto REAL de la imagen.
      // Si se traza con el canvas por defecto (800x600) la imagen se aplasta
      // y el resultado queda deformado, facetado y con regiones fusionadas.
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = reject
        img.src = photoBackground
      })
      // SVG vectorial → rasterizar a ALTA resolución (es sin pérdida, da
      // bordes mucho más nítidos). Imagen raster → tamaño nativo (capado).
      let tw: number, th: number
      if (inputIsVector) {
        const TARGET = 3000  // lado mayor objetivo
        const s = TARGET / Math.max(dims.w, dims.h)
        tw = Math.round(dims.w * s)
        th = Math.round(dims.h * s)
      } else {
        const MAX = 2000
        const s = Math.min(1, MAX / Math.max(dims.w, dims.h))
        tw = Math.round(dims.w * s)
        th = Math.round(dims.h * s)
      }
      // Ajustar el canvas para que coincida con la imagen (sin deformar)
      setCanvasSize(tw, th)

      setProgress('Analizando regiones cerradas...')
      const found = await autoTraceRegions(
        photoBackground, tw, th,
        (msg) => setProgress(msg)
      )
      const preview = await generateEdgePreview(photoBackground, tw, th)
      setDetectedShapes(found)
      setEdgePreview(preview)
      setMode('preview')
    } catch (e: any) {
      setError('Error detectando regiones: ' + e.message)
      setMode('error')
    }
  }

  // ─── Claude polling ──────────────────────────────────────────────────────────
  const startClaudePolling = () => {
    setClaudeStatus('polling')
    pollingRef.current = setInterval(async () => {
      try {
        const res = await axios.get('/api/tracer/pull')
        if (res.data.pending) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setClaudeStatus('received')
          const { shapes: incoming, zones, canvasWidth: cw, canvasHeight: ch } = res.data
          if (cw && ch) setCanvasSize(cw, ch)
          incoming.forEach((s: any) => addShape({
            moduleType: s.moduleType || 'panel',
            shapeType: s.shapeType || 'rect',
            x: s.x ?? 0, y: s.y ?? 0,
            width: s.width, height: s.height,
            archHeight: s.archHeight,
            chamferSize: s.chamferSize,
            points: s.points, nodes: s.nodes,
            closed: s.closed !== false,
            rotation: s.rotation || 0,
            svgPath: s.svgPath,
            fill: '#8B5E3C', stroke: '#5C3A1E', strokeWidth: 1,
          }))
          setClaudeShapeCount(incoming.length)
          setTimeout(() => setClaudeStatus('idle'), 3000)
        }
      } catch {}
    }, 2000)
  }

  const stopClaudePolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = null
    setClaudeStatus('idle')
  }

  // ─── Aceptar formas detectadas ───────────────────────────────────────────────
  const acceptShapes = () => {
    detectedShapes.forEach(shape => addShape({
      moduleType: shape.moduleType,
      shapeType: shape.shapeType,
      x: shape.x, y: shape.y,
      width: shape.width, height: shape.height,
      radiusX: shape.radiusX, radiusY: shape.radiusY,
      points: shape.points, closed: shape.closed,
      fill: shape.fill, stroke: shape.stroke, strokeWidth: shape.strokeWidth
    }))
    setMode('idle')
    setDetectedShapes([])
    setEdgePreview(null)
  }

  const cancelPreview = () => {
    setMode('idle')
    setDetectedShapes([])
    setEdgePreview(null)
  }

  const retry = () => {
    setMode('idle')
    setError('')
  }

  const marcoCount = detectedShapes.filter(s => s.moduleType === 'marco').length
  const panelCount = detectedShapes.filter(s => s.moduleType === 'panel').length

  if (!hasPhoto) return (
    <div className="border border-dashed border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2 text-center">
      <p className="text-xs text-amber-700">
        Carga un SVG vectorial o una imagen para auto-trazar las zonas
      </p>
      <label className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors cursor-pointer">
        <ScanSearch size={13}/> Cargar SVG / imagen
        <input type="file" accept=".svg,image/svg+xml,image/*" onChange={handleFileLoad} className="hidden"/>
      </label>
    </div>
  )

  return (
    <div className="border border-amber-100 bg-amber-50 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Wand2 size={14} className="text-amber-600"/>
        <span className="text-xs font-semibold text-amber-800">Auto-trazado</span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-white border border-amber-200 rounded p-0.5 flex-wrap">
        <button
          onClick={() => { setActiveTab('regions'); setMode('idle'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'regions' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ScanSearch size={12}/> Regiones
        </button>
        <button
          onClick={() => { setActiveTab('potrace'); setMode('idle'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'potrace' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cpu size={12}/> Potrace
        </button>
        <button
          onClick={() => setActiveTab('claude')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'claude' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot size={12}/> Claude
        </button>
        <button
          onClick={() => { setActiveTab('ai'); setMode('idle'); setError('') }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
            activeTab === 'ai' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wand2 size={12}/> Con IA
        </button>
      </div>

      {/* ── Regiones tab ── */}
      {activeTab === 'regions' && (
        <>
          {mode === 'idle' && (
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                Detecta cada región cerrada como una zona independiente. Un SVG vectorial da el mejor resultado.
              </p>
              <button
                onClick={runRegionsTrace}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors"
              >
                <ScanSearch size={13}/> Detectar regiones
              </button>
              <label className="w-full flex items-center justify-center gap-2 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-700 rounded text-xs font-medium transition-colors cursor-pointer">
                <RefreshCw size={12}/> Cargar otro SVG / imagen
                <input type="file" accept=".svg,image/svg+xml,image/*" onChange={handleFileLoad} className="hidden"/>
              </label>
            </div>
          )}
          {mode === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={13} className="text-amber-600 animate-spin"/>
                <span className="text-xs text-amber-700">{progress}</span>
              </div>
              <div className="w-full bg-amber-100 rounded-full h-1.5">
                <div className="bg-amber-500 h-1.5 rounded-full animate-pulse w-2/3"/>
              </div>
            </div>
          )}
          {mode === 'preview' && renderPreview()}
          {mode === 'error' && renderError()}
        </>
      )}

      {/* ── Potrace tab ── */}
      {activeTab === 'potrace' && (
        <>
          {mode === 'idle' && (
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                Potrace convierte la foto en trazos vectoriales limpios (SVG). Rápido y preciso para puertas.
              </p>
              <button
                onClick={runLocalTrace}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors"
              >
                <Wand2 size={13}/> Auto-trazar ahora
              </button>
            </div>
          )}
          {mode === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={13} className="text-amber-600 animate-spin"/>
                <span className="text-xs text-amber-700">{progress}</span>
              </div>
              <div className="w-full bg-amber-100 rounded-full h-1.5">
                <div className="bg-amber-500 h-1.5 rounded-full animate-pulse w-2/3"/>
              </div>
            </div>
          )}
          {mode === 'preview' && renderPreview()}
          {mode === 'error' && renderError()}
        </>
      )}

      {/* ── Claude tab ── */}
      {activeTab === 'claude' && (
        <div className="space-y-2">
          {claudeStatus === 'idle' && (
            <>
              <p className="text-xs text-amber-700">
                Activa para recibir el trazado de Claude automáticamente
              </p>
              <button
                onClick={startClaudePolling}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors"
              >
                <Bot size={13}/> Activar
              </button>
            </>
          )}
          {claudeStatus === 'polling' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"/>
                <span className="text-xs text-amber-700">Esperando trazado de Claude...</span>
              </div>
              <button
                onClick={stopClaudePolling}
                className="w-full flex items-center justify-center gap-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium transition-colors"
              >
                <X size={12}/> Detener
              </button>
            </div>
          )}
          {claudeStatus === 'received' && (
            <div className="flex items-center gap-2 text-green-700 text-xs font-semibold">
              <Check size={14} className="text-green-500"/>
              ¡Trazado recibido! {claudeShapeCount} formas cargadas
            </div>
          )}
        </div>
      )}

      {/* ── Con IA tab ── */}
      {activeTab === 'ai' && (
        <>
          {mode === 'idle' && (
            <div className="space-y-2">
              <p className="text-xs text-amber-700">
                SAM (Segment Anything Model) de Meta detecta y traza cada región de la puerta automáticamente. ~40s.
              </p>
              <button
                onClick={runAITrace}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold transition-colors"
              >
                <Wand2 size={13}/> Auto-trazar con IA
              </button>
            </div>
          )}
          {mode === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw size={13} className="text-amber-600 animate-spin"/>
                <span className="text-xs text-amber-700">{progress}</span>
              </div>
              <div className="w-full bg-amber-100 rounded-full h-1.5">
                <div className="bg-amber-500 h-1.5 rounded-full animate-pulse w-2/3"/>
              </div>
            </div>
          )}
          {mode === 'preview' && renderPreview()}
          {mode === 'error' && renderError()}
        </>
      )}
    </div>
  )

  function renderPreview() {
    return (
      <div className="space-y-2">
        {edgePreview && (
          <div className="relative rounded overflow-hidden border border-amber-200">
            <img src={edgePreview} alt="Bordes detectados" className="w-full h-24 object-cover opacity-80"/>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Eye size={10}/> Bordes detectados
              </span>
            </div>
          </div>
        )}
        <div className="bg-white border border-amber-200 rounded p-2 space-y-1">
          <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Layers size={12} className="text-amber-500"/>
            {detectedShapes.length} formas detectadas
          </p>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>Marcos: <b className="text-amber-700">{marcoCount}</b></span>
            <span>Paneles: <b className="text-amber-500">{panelCount}</b></span>
          </div>
        </div>
        {detectedShapes.length === 0 && (
          <p className="text-xs text-red-500">No se detectaron formas. Intenta con la opción IA o traza manualmente.</p>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={acceptShapes}
            disabled={detectedShapes.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded text-xs font-semibold transition-colors"
          >
            <Check size={12}/> Aceptar
          </button>
          <button
            onClick={cancelPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
          >
            <X size={12}/> Cancelar
          </button>
        </div>
      </div>
    )
  }

  function renderError() {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">{error}</p>
        <button
          onClick={retry}
          className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    )
  }
}
