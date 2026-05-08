import { useState } from 'react'
import { useTracerStore } from '../../store/tracerStore'
import { Tool } from '../../types'
import {
  MousePointer2, Square, Circle, Minus, Triangle,
  PenLine, Pencil, Trash2, RotateCcw, ImagePlus,
  ZoomIn, ZoomOut, Grid3X3, Diamond, ArrowRight,
  RotateCw, FlipHorizontal, FlipVertical, Copy, Spline
} from 'lucide-react'
import AutoTracer from './AutoTracer'

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
      { id: 'curve'    as Tool, label: 'Arco / Curva', icon: <Spline size={14}/> },
      { id: 'freehand' as Tool, label: 'Lápiz libre',  icon: <Pencil size={14}/> },
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
    shapes, selectedShapeIds, updateShape
  } = useTracerStore()

  const selectedShapes = shapes.filter(s => selectedShapeIds.includes(s.id))

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

            {/* Duplicar */}
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
      <AutoTracer />

      <div className="mt-auto border-t border-gray-100 pt-3">
        <button onClick={clearAll}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <RotateCcw size={12}/> Limpiar todo
        </button>
      </div>
    </div>
  )
}
