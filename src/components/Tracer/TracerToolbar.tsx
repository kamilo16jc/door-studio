import { useState } from 'react'
import { useTracerStore } from '../../store/tracerStore'
import { Tool } from '../../types'
import {
  MousePointer2, Square, Circle, Minus, Triangle,
  PenLine, Pencil, Trash2, RotateCcw, ImagePlus,
  ZoomIn, ZoomOut, Grid3X3, Diamond, ArrowRight,
  RotateCw, FlipHorizontal, FlipVertical, Copy, Spline, Pen, Octagon, Layers,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown
} from 'lucide-react'
import { archRectToPath, chamferRectToPath } from '../../lib/svgFilters'

const ArchRectIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M1 13 L13 13 L13 6 C13 3 10.5 1 7 1 C3.5 1 1 3 1 6 Z"/>
  </svg>
)
import AutoTracer from './AutoTracer'
import { createTemplateShapes, DOOR_TEMPLATES } from '../../lib/doorTemplates'

const TOOL_GROUPS = [
  {
    label: 'Selección',
    tools: [
      { id: 'select' as Tool, label: 'Seleccionar',  icon: <MousePointer2 size={14}/> },
      { id: 'delete' as Tool, label: 'Borrar',        icon: <Trash2        size={14}/> },
    ]
  },
  {
    label: 'Rectángulos',
    tools: [
      { id: 'rect'   as Tool, label: 'Rectángulo',   icon: <Square  size={14}/> },
      { id: 'square' as Tool, label: 'Cuadrado',     icon: <Square  size={14}/> },
    ]
  },
  {
    label: 'Paneles',
    tools: [
      { id: 'archrect'      as Tool, label: 'Panel con arco',   icon: <ArchRectIcon/> },
      { id: 'chamferedrect' as Tool, label: 'Panel biselado',   icon: <Octagon size={14}/> },
    ]
  },
  {
    label: 'Círculos',
    tools: [
      { id: 'ellipse' as Tool, label: 'Elipse',      icon: <Circle  size={14}/> },
      { id: 'circle'  as Tool, label: 'Círculo',     icon: <Circle  size={14}/> },
    ]
  },
  {
    label: 'Líneas',
    tools: [
      { id: 'line'  as Tool, label: 'Línea',         icon: <Minus       size={14}/> },
      { id: 'arrow' as Tool, label: 'Flecha',        icon: <ArrowRight  size={14}/> },
    ]
  },
  {
    label: 'Polígonos',
    tools: [
      { id: 'pen'      as Tool, label: 'Pluma',      icon: <PenLine   size={14}/> },
      { id: 'triangle' as Tool, label: 'Triángulo',  icon: <Triangle  size={14}/> },
      { id: 'diamond'  as Tool, label: 'Rombo',      icon: <Diamond   size={14}/> },
    ]
  },
  {
    label: 'Curvas',
    tools: [
      { id: 'bezier'   as Tool, label: 'Pluma Bezier',  icon: <Pen    size={14}/> },
      { id: 'curve'    as Tool, label: 'Arco / Curva',  icon: <Spline size={14}/> },
      { id: 'freehand' as Tool, label: 'Lápiz libre',   icon: <Pencil size={14}/> },
    ]
  },
]

const HINTS: Partial<Record<Tool, string>> = {
  select:   'Click para seleccionar · Arrastra para mover · Handles para redimensionar · Doble-click para borrar',
  delete:   'Click sobre cualquier forma para eliminarla',
  rect:     'Arrastra para dibujar un rectángulo',
  square:   'Arrastra para dibujar un cuadrado perfecto',
  ellipse:  'Arrastra para dibujar una elipse',
  circle:   'Arrastra para dibujar un círculo perfecto',
  line:     'Arrastra de un punto a otro para trazar una línea',
  arrow:    'Arrastra para crear una flecha',
  pen:      'Click para agregar puntos · Click en el primer punto (verde) para cerrar la forma',
  triangle: 'Arrastra para dibujar un triángulo',
  diamond:  'Arrastra para dibujar un rombo',
  freehand: 'Mantén presionado y arrastra para dibujar libremente',
  curve:    'Click para agregar puntos · La línea se suaviza automáticamente · Click en ● verde para cerrar · Doble-click para terminar',
  bezier:   'Click = punto recto · Click+arrastrar = curva con manijas Bezier · Click en ● verde para cerrar · Doble-click para terminar',
  archrect:      'Arrastra para dibujar un panel con arco · Handle ● amarillo sube/baja la base del arco · Súbelo al máximo para obtener una media luna pura',
  chamferedrect: 'Arrastra para dibujar un panel biselado · Handle amarillo ajusta el bisel',
}

interface Props {
  showGrid: boolean
  onToggleGrid: () => void
  strokeWidth: number
  onStrokeWidth: (v: number) => void
}

export default function TracerToolbar({ showGrid, onToggleGrid, strokeWidth, onStrokeWidth }: Props) {
  const {
    activeTool, setActiveTool,
    photoBackground, setPhotoBackground,
    photoOpacity, setPhotoOpacity,
    canvasScale, setCanvasScale,
    canvasWidth, canvasHeight,
    setCanvasSize, clearAll,
    shapes, selectedShapeIds, updateShape, addShape,
    moveShapeUp, moveShapeDown, moveShapeToFront, moveShapeToBack,
    selectShape
  } = useTracerStore()

  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id))

  // ── Molduras concéntricas ──
  const [moldOffset, setMoldOffset] = useState(12)
  const [moldCount, setMoldCount] = useState(2)

  const generateMolduras = () => {
    if (selectedShapes.length !== 1) return
    const base = selectedShapes[0]
    if (base.shapeType !== 'archrect' && base.shapeType !== 'chamferedrect') return

    for (let i = 1; i <= moldCount; i++) {
      const off = moldOffset * i
      const newW = (base.width || 0) - 2 * off
      const newH = (base.height || 0) - 2 * off
      if (newW < 20 || newH < 20) break

      const { id: _id, ...rest } = base

      if (base.shapeType === 'archrect') {
        const newAH = Math.max(10, (base.archHeight ?? (base.width || 0) / 2) - off)
        addShape({ ...rest, x: base.x + off, y: base.y + off, width: newW, height: newH, archHeight: newAH })
      } else {
        const newCS = Math.max(2, (base.chamferSize ?? 10) - off * 0.3)
        addShape({ ...rest, x: base.x + off, y: base.y + off, width: newW, height: newH, chamferSize: newCS })
      }
    }
  }

  // ── Crear anillo / moldura compuesta ──
  const getShapePath = (s: typeof selectedShapes[0], ox: number, oy: number): string => {
    const rx = (s.x || 0) - ox
    const ry = (s.y || 0) - oy
    const w = s.width || 0
    const h = s.height || 0
    if (s.shapeType === 'archrect')
      return archRectToPath(rx, ry, w, h, s.archHeight ?? w / 2)
    if (s.shapeType === 'chamferedrect')
      return chamferRectToPath(rx, ry, w, h, s.chamferSize ?? Math.min(w, h) * 0.1)
    if (s.shapeType === 'rect')
      return `M ${rx} ${ry} h ${w} v ${h} h ${-w} Z`
    return ''
  }

  const createRing = () => {
    if (selectedShapes.length !== 2) return
    const [a, b] = selectedShapes

    const compatible = ['archrect', 'chamferedrect', 'rect']
    if (!compatible.includes(a.shapeType) || !compatible.includes(b.shapeType)) return

    const areaOf = (s: typeof a) => (s.width || 0) * (s.height || 0)
    const [outer, inner] = areaOf(a) >= areaOf(b) ? [a, b] : [b, a]

    const ox = outer.x || 0
    const oy = outer.y || 0
    const bw = outer.width || 0
    const bh = outer.height || 0

    const outerPath = getShapePath(outer, ox, oy)
    const innerPath = getShapePath(inner, ox, oy)

    if (!outerPath || !innerPath) return

    const combinedPath = outerPath + ' ' + innerPath

    const { id: _id, ...outerRest } = outer
    addShape({
      ...outerRest,
      shapeType: 'compound' as any,
      x: ox,
      y: oy,
      width: bw,
      height: bh,
      svgPath: combinedPath,
    } as any)
  }

  // ── Auto-suavizar: convierte cualquier forma a bezier suave (Catmull-Rom) ──
  const smoothShapes = () => {
    selectedShapes.forEach(s => {
      if (s.shapeType === 'rect' || s.shapeType === 'ellipse' || s.shapeType === 'line') return
      const closed = s.closed !== false

      if (s.points && s.points.length >= 6) {
        const m = Math.floor(s.points.length / 2)
        const P = Array.from({ length: m }, (_, i) => ({ x: s.points![i*2], y: s.points![i*2+1] }))
        const nodes = P.map((p, i) => {
          const prev = P[(i - 1 + m) % m], next = P[(i + 1) % m]
          if (!closed) {
            if (i === 0)     return { x: p.x, y: p.y, handleOut: { x: p.x + (P[1].x-p.x)/3,     y: p.y + (P[1].y-p.y)/3     } }
            if (i === m - 1) return { x: p.x, y: p.y, handleIn:  { x: p.x - (p.x-P[m-2].x)/3,  y: p.y - (p.y-P[m-2].y)/3  } }
          }
          const dx = (next.x - prev.x) / 6, dy = (next.y - prev.y) / 6
          return { x: p.x, y: p.y, handleIn: { x: p.x-dx, y: p.y-dy }, handleOut: { x: p.x+dx, y: p.y+dy } }
        })
        updateShape(s.id, { shapeType: 'bezier', nodes } as any)
      } else if ((s as any).nodes) {
        const cur: Array<{x:number;y:number}> = (s as any).nodes
        const m = cur.length
        if (m < 3) return
        const newNodes = cur.map((p, i) => {
          const prev = cur[(i - 1 + m) % m], next = cur[(i + 1) % m]
          if (!closed) {
            if (i === 0)     return { x: p.x, y: p.y, handleOut: { x: p.x + (next.x-p.x)/3,    y: p.y + (next.y-p.y)/3    } }
            if (i === m - 1) return { x: p.x, y: p.y, handleIn:  { x: p.x - (p.x-prev.x)/3,   y: p.y - (p.y-prev.y)/3   } }
          }
          const dx = (next.x - prev.x) / 6, dy = (next.y - prev.y) / 6
          return { x: p.x, y: p.y, handleIn: { x: p.x-dx, y: p.y-dy }, handleOut: { x: p.x+dx, y: p.y+dy } }
        })
        updateShape(s.id, { nodes: newNodes } as any)
      }
    })
  }

  const rotate = (delta: number) => {
    selectedShapes.forEach(s => {
      const cur = s.rotation || 0
      updateShape(s.id, { rotation: (cur + delta + 360) % 360 })
    })
  }

  const flipH = () => {
    selectedShapes.forEach(s => {
      if (!s.points) return
      const pts = s.points
      let minX = Infinity, maxX = -Infinity
      for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]) }
      const cx = (minX + maxX) / 2
      updateShape(s.id, { points: pts.map((v, i) => i % 2 === 0 ? 2 * cx - v : v) })
    })
  }

  const flipV = () => {
    selectedShapes.forEach(s => {
      if (!s.points) return
      const pts = s.points
      let minY = Infinity, maxY = -Infinity
      for (let i = 1; i < pts.length; i += 2) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]) }
      const cy = (minY + maxY) / 2
      updateShape(s.id, { points: pts.map((v, i) => i % 2 === 1 ? 2 * cy - v : v) })
    })
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      const MAX = 900, ratio = img.naturalWidth / img.naturalHeight
      let w = img.naturalWidth, h = img.naturalHeight
      if (w > MAX || h > MAX) {
        if (ratio >= 1) { w = MAX; h = Math.round(MAX / ratio) }
        else            { h = MAX; w = Math.round(MAX * ratio) }
      }
      setCanvasSize(w, h)
      setPhotoBackground(url)
    }
    img.src = url
    e.target.value = ''
  }

  return (
    <div className="w-52 bg-white border-r border-gray-200 flex flex-col gap-3 p-3 shrink-0 overflow-y-auto">

      {/* Foto */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Referencia</p>
        <label className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-pointer text-xs text-gray-600 transition-colors">
          <ImagePlus size={13} className="text-gray-400"/>
          {photoBackground ? 'Cambiar foto' : 'Cargar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto}/>
        </label>

        {photoBackground && (
          <div className="mt-3 space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Tamaño</span>
                <span className="text-gray-600 font-medium">{Math.round(canvasScale*100)}%</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCanvasScale(Math.max(0.2, canvasScale-0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomOut size={12} className="text-gray-400"/></button>
                <input type="range" min="0.2" max="1" step="0.05" value={canvasScale}
                  onChange={e => setCanvasScale(Number(e.target.value))}
                  className="flex-1 accent-blue-500 h-1"/>
                <button onClick={() => setCanvasScale(Math.min(1, canvasScale+0.1))} className="p-1 hover:bg-gray-100 rounded"><ZoomIn size={12} className="text-gray-400"/></button>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Opacidad</span>
                <span className="text-gray-600 font-medium">{Math.round(photoOpacity*100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={photoOpacity}
                onChange={e => setPhotoOpacity(Number(e.target.value))}
                className="w-full accent-blue-500 h-1"/>
            </div>
          </div>
        )}
      </section>

      <div className="border-t border-gray-100"/>

      {/* Opciones del canvas */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Canvas</p>
        <div className="space-y-2">
          {/* Grid */}
          <button onClick={onToggleGrid}
            className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-all border ${
              showGrid ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            <Grid3X3 size={13}/> Grilla de referencia
          </button>

          {/* Grosor de línea */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Grosor de línea</span>
              <span className="text-gray-600 font-medium">{strokeWidth}px</span>
            </div>
            <input type="range" min="0.5" max="5" step="0.5" value={strokeWidth}
              onChange={e => onStrokeWidth(Number(e.target.value))}
              className="w-full accent-blue-500 h-1"/>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100"/>

      {/* Panel de forma(s) seleccionada(s) */}
      {selectedShapes.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {selectedShapes.length > 1 ? `${selectedShapes.length} seleccionadas` : 'Forma seleccionada'}
          </p>
          <div className="space-y-2">

            {/* Rotación — muestra valor del último seleccionado */}
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Rotación</span>
                <span className="text-gray-600 font-medium">{Math.round(selectedShapes[selectedShapes.length-1].rotation || 0)}°</span>
              </div>
              <input type="range" min="0" max="359" step="1"
                value={selectedShapes[selectedShapes.length-1].rotation || 0}
                onChange={e => {
                  const val = Number(e.target.value)
                  selectedShapes.forEach(s => updateShape(s.id, { rotation: val }))
                }}
                className="w-full accent-blue-500 h-1 mb-1"/>
              <div className="flex gap-1">
                <button onClick={() => rotate(-90)} title="-90°"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                  <RotateCcw size={11}/> -90°
                </button>
                <button onClick={() => rotate(90)} title="+90°"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                  <RotateCw size={11}/> +90°
                </button>
              </div>
            </div>

            {/* Voltear (solo si hay polígonos seleccionados) */}
            {selectedShapes.some(s => s.points) && (
              <div className="flex gap-1">
                <button onClick={flipH}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                  <FlipHorizontal size={11}/> H
                </button>
                <button onClick={flipV}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
                  <FlipVertical size={11}/> V
                </button>
              </div>
            )}

            {/* Crear anillo entre 2 formas */}
            {selectedShapes.length === 2 &&
             selectedShapes.every(s => ['archrect','chamferedrect','rect'].includes(s.shapeType)) && (
              <button onClick={createRing}
                className="w-full px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                <Layers size={12}/> Crear anillo / moldura
              </button>
            )}

            {/* Suavizar curvas automáticamente */}
            {selectedShapes.some(s => s.points || (s as any).nodes) && (
              <button
                onClick={smoothShapes}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs border border-emerald-200 rounded hover:bg-emerald-50 text-emerald-700 font-medium transition-colors"
                title="Convierte todos los vértices en curvas suaves (Catmull-Rom)">
                <Spline size={11}/> Suavizar curvas
              </button>
            )}

            {/* Molduras concéntricas — solo para archrect o chamferedrect */}
            {selectedShapes.length === 1 &&
              (selectedShapes[0].shapeType === 'archrect' || selectedShapes[0].shapeType === 'chamferedrect') && (
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500">Molduras concéntricas</p>

                {/* Offset control */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Separación</span>
                    <span className="font-medium text-gray-600">{moldOffset}px</span>
                  </div>
                  <input type="range" min="4" max="40" step="1" value={moldOffset}
                    onChange={e => setMoldOffset(Number(e.target.value))}
                    className="w-full accent-amber-500 h-1"/>
                </div>

                {/* Count control */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 flex-1">Cantidad</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMoldCount(c => Math.max(1, c - 1))} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 flex items-center justify-center">−</button>
                    <span className="text-xs font-medium text-gray-700 w-4 text-center">{moldCount}</span>
                    <button onClick={() => setMoldCount(c => Math.min(5, c + 1))} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 flex items-center justify-center">+</button>
                  </div>
                </div>

                {/* Generate button */}
                <button onClick={generateMolduras}
                  className="w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                  <Layers size={12}/> Generar molduras
                </button>
              </div>
            )}

            {/* Duplicar */}
            {/* Layer order buttons — only when 1 shape selected */}
            {selectedShapes.length === 1 && (() => {
              const id = selectedShapes[0].id
              const idx = shapes.findIndex(s => s.id === id)
              return (
                <div className="space-y-1 pt-1 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden de capas</p>
                  <div className="grid grid-cols-4 gap-1">
                    <button title="Al fondo" onClick={() => moveShapeToBack(id)} disabled={idx === 0}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all">
                      <ChevronsDown size={13} className="text-gray-500"/>
                      <span className="text-[9px] text-gray-400">Fondo</span>
                    </button>
                    <button title="Bajar capa" onClick={() => moveShapeDown(id)} disabled={idx === 0}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all">
                      <ChevronDown size={13} className="text-gray-500"/>
                      <span className="text-[9px] text-gray-400">Bajar</span>
                    </button>
                    <button title="Subir capa" onClick={() => moveShapeUp(id)} disabled={idx === shapes.length - 1}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all">
                      <ChevronUp size={13} className="text-gray-500"/>
                      <span className="text-[9px] text-gray-400">Subir</span>
                    </button>
                    <button title="Al frente" onClick={() => moveShapeToFront(id)} disabled={idx === shapes.length - 1}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-all">
                      <ChevronsUp size={13} className="text-gray-500"/>
                      <span className="text-[9px] text-gray-400">Frente</span>
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-300 text-center">
                    Capa {idx + 1} de {shapes.length}
                  </p>
                </div>
              )
            })()}

            <button
              onClick={() => {
                const OFFSET = 20
                const newIds: string[] = []
                selectedShapes.forEach(s => {
                  const { id: _id, ...rest } = s
                  const usesPts = ['polygon','freehand','line','curve'].includes(s.shapeType)
                  const dup = usesPts
                    ? { ...rest, points: s.points?.map((v: number) => v + OFFSET) }
                    : { ...rest, x: (s.x||0) + OFFSET, y: (s.y||0) + OFFSET }
                  newIds.push(useTracerStore.getState().addShape(dup))
                })
                useTracerStore.getState().selectShapes(newIds)
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600">
              <Copy size={11}/> {selectedShapes.length > 1 ? `Duplicar ${selectedShapes.length}` : 'Duplicar forma'}
            </button>
          </div>
        </section>
      )}

      {selectedShapes.length > 0 && <div className="border-t border-gray-100"/>}

      {/* Herramientas agrupadas */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Herramientas</p>
        <div className="space-y-3">
          {TOOL_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-xs text-gray-300 mb-1 pl-1">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {group.tools.map(tool => (
                  <button key={tool.id} title={tool.label} onClick={() => setActiveTool(tool.id)}
                    className={`p-2 rounded-lg transition-all ${
                      activeTool === tool.id
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 border border-gray-100'
                    }`}>
                    {tool.icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Hint */}
        {HINTS[activeTool] && (
          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
            <p className="text-xs text-blue-600 leading-relaxed">{HINTS[activeTool]}</p>
          </div>
        )}
      </section>

      <div className="border-t border-gray-100"/>

      {/* Plantillas */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Plantillas</p>
        <div className="grid grid-cols-2 gap-1">
          {DOOR_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              title={tmpl.label}
              onClick={() => {
                const { canvasWidth, canvasHeight } = useTracerStore.getState()
                const shapes = createTemplateShapes(tmpl.id, canvasWidth, canvasHeight)
                const ids: string[] = []
                shapes.forEach(s => {
                  ids.push(useTracerStore.getState().addShape(s))
                })
                useTracerStore.getState().selectShapes(ids)
                useTracerStore.getState().setActiveTool('select')
              }}
              className="flex flex-col items-center gap-1 p-2 border border-gray-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 transition-all group"
            >
              <svg width="40" height="28" viewBox="0 0 40 28" className="text-gray-500 group-hover:text-orange-500">
                <path d={tmpl.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs text-gray-500 group-hover:text-orange-600 leading-tight text-center">{tmpl.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-100"/>
      <AutoTracer />

      {/* ── Panel de capas ─────────────────────────────────────── */}
      {shapes.length > 0 && (
        <>
          <div className="border-t border-gray-100"/>
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers size={11}/> Capas ({shapes.length})
            </p>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {/* Reverse: top of list = front (last in array) */}
              {[...shapes].reverse().map((shape, revIdx) => {
                const idx = shapes.length - 1 - revIdx
                const isSelected = selectedShapeIds.includes(shape.id)
                const typeLabel: Record<string, string> = {
                  rect: 'Rect', ellipse: 'Elipse', line: 'Línea',
                  polygon: 'Polígono', freehand: 'Libre', curve: 'Curva',
                  bezier: 'Bezier', archrect: 'Arco', chamferedrect: 'Bisel',
                  compound: 'Anillo'
                }
                return (
                  <div key={shape.id}
                    onClick={() => selectShape(shape.id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all group ${
                      isSelected
                        ? shape.moduleType === 'marco'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-amber-50 border border-amber-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}>
                    {/* Layer number */}
                    <span className="text-[9px] text-gray-300 w-4 text-right shrink-0">{idx + 1}</span>
                    {/* Module color dot */}
                    <span className={`w-2 h-2 rounded-sm shrink-0 ${
                      shape.moduleType === 'marco' ? 'bg-blue-400' : 'bg-amber-400'
                    }`}/>
                    {/* Type label */}
                    <span className={`text-xs flex-1 truncate ${
                      isSelected
                        ? shape.moduleType === 'marco' ? 'text-blue-700 font-semibold' : 'text-amber-700 font-semibold'
                        : 'text-gray-500'
                    }`}>
                      {typeLabel[shape.shapeType] || shape.shapeType}
                    </span>
                    {/* Quick move buttons */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Bajar" onClick={e => { e.stopPropagation(); moveShapeDown(shape.id) }}
                        disabled={idx === 0}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                        <ChevronDown size={10} className="text-gray-500"/>
                      </button>
                      <button title="Subir" onClick={e => { e.stopPropagation(); moveShapeUp(shape.id) }}
                        disabled={idx === shapes.length - 1}
                        className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30">
                        <ChevronUp size={10} className="text-gray-500"/>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      <div className="mt-auto border-t border-gray-100 pt-3">
        <button onClick={clearAll}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <RotateCcw size={12}/> Limpiar todo
        </button>
      </div>
    </div>
  )
}
