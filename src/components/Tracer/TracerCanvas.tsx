import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Line, Circle, Transformer } from 'react-konva'
import Konva from 'konva'
import { useTracerStore } from '../../store/tracerStore'
import { TracedShape, ModuleType } from '../../types'
import useImage from 'use-image'

const MOD_STYLE: Record<ModuleType, { stroke: string; fill: string }> = {
  marco: { stroke: '#1d4ed8', fill: 'rgba(59,130,246,0.07)' },
  panel: { stroke: '#b45309', fill: 'rgba(217,119,6,0.07)'  }
}

function PhotoBg({ src, opacity, w, h }: { src:string; opacity:number; w:number; h:number }) {
  const [img] = useImage(src)
  return <KonvaImage image={img} opacity={opacity} width={w} height={h} x={0} y={0} listening={false}/>
}

function Grid({ w, h, size=40 }: { w:number; h:number; size?:number }) {
  const lines: React.ReactNode[] = []
  for (let x = size; x < w; x += size)
    lines.push(<Line key={`v${x}`} points={[x,0,x,h]} stroke="#e2e8f0" strokeWidth={0.5} listening={false}/>)
  for (let y = size; y < h; y += size)
    lines.push(<Line key={`h${y}`} points={[0,y,w,y]} stroke="#e2e8f0" strokeWidth={0.5} listening={false}/>)
  return <>{lines}</>
}

// ─── Bounding box helpers for marquee ────────────────────────────────────────
function getShapeBounds(s: TracedShape) {
  const ox = s.x || 0, oy = s.y || 0
  if (s.shapeType === 'rect')
    return { x1: s.x, y1: s.y, x2: s.x + (s.width||0), y2: s.y + (s.height||0) }
  if (s.shapeType === 'ellipse')
    return { x1: s.x-(s.radiusX||0), y1: s.y-(s.radiusY||0), x2: s.x+(s.radiusX||0), y2: s.y+(s.radiusY||0) }
  if (s.points && s.points.length >= 2) {
    let x1=Infinity, y1=Infinity, x2=-Infinity, y2=-Infinity
    for (let i=0; i<s.points.length; i+=2) {
      x1=Math.min(x1,s.points[i]+ox); x2=Math.max(x2,s.points[i]+ox)
      y1=Math.min(y1,s.points[i+1]+oy); y2=Math.max(y2,s.points[i+1]+oy)
    }
    return { x1, y1, x2, y2 }
  }
  return { x1: ox, y1: oy, x2: ox, y2: oy }
}
function shapeInBounds(s: TracedShape, r: {x:number;y:number;w:number;h:number}) {
  const b = getShapeBounds(s)
  return b.x1 >= r.x && b.y1 >= r.y && b.x2 <= r.x+r.w && b.y2 <= r.y+r.h
}

// ─── ShapeEl — forwardRef, sin Transformer propio ────────────────────────────
const ShapeEl = React.forwardRef<Konva.Shape, {
  shape: TracedShape
  selected: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDelete: () => void
  strokeWidth: number
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragMove:  (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd:   (e: Konva.KonvaEventObject<DragEvent>) => void
}>(function ShapeEl({ shape, selected, onSelect, onDelete, strokeWidth, onDragStart, onDragMove, onDragEnd }, ref) {
  const s  = MOD_STYLE[shape.moduleType]
  const sw = selected ? Math.max(strokeWidth, 2) : strokeWidth
  const common = {
    id: shape.id,
    draggable: true,
    onClick:    onSelect,
    onDblClick: onDelete,
    rotation:   shape.rotation || 0,
    onDragStart,
    onDragMove,
    onDragEnd,
  }
  if (shape.shapeType === 'rect')
    return <Rect ref={ref as React.RefObject<Konva.Rect>}
      x={shape.x} y={shape.y} width={shape.width||0} height={shape.height||0}
      fill={s.fill} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw} {...common}/>
  if (shape.shapeType === 'ellipse')
    return <Ellipse ref={ref as React.RefObject<Konva.Ellipse>}
      x={shape.x} y={shape.y} radiusX={shape.radiusX||50} radiusY={shape.radiusY||50}
      fill={s.fill} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw} {...common}/>
  if (shape.shapeType === 'line')
    return <Line ref={ref as React.RefObject<Konva.Line>}
      x={shape.x||0} y={shape.y||0}
      points={shape.points||[]} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
      lineCap="round" lineJoin="round" {...common}/>
  return <Line ref={ref as React.RefObject<Konva.Line>}
    x={shape.x||0} y={shape.y||0}
    points={shape.points||[]} closed={shape.closed!==false} fill={s.fill}
    stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
    tension={shape.shapeType==='freehand'?0.4:0}
    lineCap="round" lineJoin="round" {...common}/>
})

function AssignPopup({ x, y, onAssign, onCancel }: {
  x:number; y:number; onAssign:(m:ModuleType)=>void; onCancel:()=>void
}) {
  return (
    <div className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 flex flex-col gap-2"
      style={{ left: Math.min(x+10, window.innerWidth-180), top: Math.max(y-90, 8), minWidth:160 }}>
      <p className="text-xs font-semibold text-gray-600 text-center">¿Esta parte es...?</p>
      <button onClick={()=>onAssign('marco')}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold text-blue-700 transition-colors">
        <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block"/> Marco
      </button>
      <button onClick={()=>onAssign('panel')}
        className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold text-amber-700 transition-colors">
        <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"/> Panel
      </button>
      <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 text-center">Cancelar</button>
    </div>
  )
}

// ─── Canvas principal ─────────────────────────────────────────────────────────
export default function TracerCanvas({ showGrid, strokeWidth }: { showGrid?: boolean; strokeWidth?: number }) {
  const {
    shapes, addShape, updateShape, deleteShape,
    selectedShapeIds, selectShape, selectShapes, toggleShapeSelection,
    activeTool, photoBackground, photoOpacity,
    canvasWidth, canvasHeight
  } = useTracerStore()

  const stageRef     = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const trRef        = useRef<Konva.Transformer>(null)
  const shapeRefs    = useRef(new Map<string, Konva.Shape>())

  // Siempre-actuales refs para callbacks estables
  const shapesRef      = useRef(shapes)
  const selectedIdsRef = useRef(selectedShapeIds)
  useEffect(() => { shapesRef.current = shapes },           [shapes])
  useEffect(() => { selectedIdsRef.current = selectedShapeIds }, [selectedShapeIds])

  const sw = strokeWidth || 1.5

  // ── Estado de dibujo ──────────────────────────────────────────────────────
  const [polyPts,    setPolyPts]    = useState<number[]>([])
  const [lineChain,  setLineChain]  = useState<number[]>([])
  const [dragStart,  setDragStart]  = useState<{x:number;y:number}|null>(null)
  const [tempShape,  setTempShape]  = useState<any|null>(null)
  const [freePoints, setFreePoints] = useState<number[]>([])
  const [drawing,    setDrawing]    = useState(false)
  const [mouse,      setMouse]      = useState({x:0,y:0})
  const [popup,      setPopup]      = useState<{shape:any; sx:number; sy:number}|null>(null)
  const [snapPt,     setSnapPt]     = useState<{x:number;y:number}|null>(null)

  // ── Multi-select state ────────────────────────────────────────────────────
  const [copiedShapes, setCopiedShapes] = useState<TracedShape[]>([])
  const [marquee,      setMarquee]      = useState<{x:number;y:number;w:number;h:number}|null>(null)
  const marqueeOrigin  = useRef<{x:number;y:number}|null>(null)

  // Posiciones iniciales capturadas al empezar arrastre de grupo
  const dragInitPos = useRef(new Map<string, {x:number;y:number}>())

  // ── Sync Transformer con shapes seleccionadas ─────────────────────────────
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const nodes = selectedShapeIds
      .map(id => shapeRefs.current.get(id))
      .filter((n): n is Konva.Shape => !!n)
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [selectedShapeIds])

  // ── Transform end: normaliza escala y guarda en store ──────────────────────
  const onTransformEnd = useCallback(() => {
    trRef.current?.nodes().forEach(node => {
      const id    = node.id()
      const shape = shapesRef.current.find(s => s.id === id)
      if (!shape) return
      if (shape.shapeType === 'rect') {
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        updateShape(id, { x: node.x(), y: node.y(), width:(shape.width||0)*sx, height:(shape.height||0)*sy, rotation: node.rotation() })
      } else if (shape.shapeType === 'ellipse') {
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        updateShape(id, { radiusX:(shape.radiusX||50)*sx, radiusY:(shape.radiusY||50)*sy, rotation: node.rotation() })
      } else {
        node.scaleX(1); node.scaleY(1)
        updateShape(id, { x: node.x(), y: node.y(), rotation: node.rotation() })
      }
    })
  }, [updateShape])

  // ── Group drag callbacks (estables, usan refs para posición actual) ────────
  const makeDragStart = useCallback((_shape: TracedShape) => () => {
    dragInitPos.current.clear()
    selectedIdsRef.current.forEach(id => {
      const s = shapesRef.current.find(sh => sh.id === id)
      if (s) dragInitPos.current.set(id, { x: s.x||0, y: s.y||0 })
    })
  }, [])

  const makeDragMove = useCallback((shape: TracedShape) => (e: Konva.KonvaEventObject<DragEvent>) => {
    if (selectedIdsRef.current.length <= 1) return
    if (!selectedIdsRef.current.includes(shape.id)) return
    const init = dragInitPos.current.get(shape.id)
    if (!init) return
    const dx = e.target.x() - init.x
    const dy = e.target.y() - init.y
    selectedIdsRef.current.forEach(id => {
      if (id === shape.id) return
      const ref  = shapeRefs.current.get(id)
      const ipos = dragInitPos.current.get(id)
      if (ref && ipos) { ref.x(ipos.x + dx); ref.y(ipos.y + dy) }
    })
  }, [])

  const makeDragEnd = useCallback((shape: TracedShape) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const newX = e.target.x(), newY = e.target.y()
    if (selectedIdsRef.current.length > 1 && selectedIdsRef.current.includes(shape.id)) {
      const init = dragInitPos.current.get(shape.id)
      if (!init) { updateShape(shape.id, { x: newX, y: newY }); return }
      const dx = newX - init.x, dy = newY - init.y
      selectedIdsRef.current.forEach(id => {
        const ipos = dragInitPos.current.get(id)
        if (ipos) updateShape(id, { x: ipos.x + dx, y: ipos.y + dy })
      })
    } else {
      updateShape(shape.id, { x: newX, y: newY })
    }
    dragInitPos.current.clear()
  }, [updateShape])

  // ── Snap helpers ──────────────────────────────────────────────────────────
  const SNAP_R  = 12
  const CLOSE_R = 6

  const getEndpoints = useCallback((): {x:number;y:number}[] => {
    const pts: {x:number;y:number}[] = []
    shapes.forEach(s => {
      if (!s.points || s.points.length < 2) return
      const p = s.points
      pts.push({ x: p[0], y: p[1] })
      pts.push({ x: p[p.length-2], y: p[p.length-1] })
    })
    return pts
  }, [shapes])

  const snap = useCallback((x: number, y: number) => {
    for (const ep of getEndpoints())
      if (Math.hypot(ep.x - x, ep.y - y) <= SNAP_R) return { x: ep.x, y: ep.y, snapped: true }
    return { x, y, snapped: false }
  }, [getEndpoints])

  const snapWithChain = useCallback((x: number, y: number, chain: number[]) => {
    if (chain.length >= 6) {
      const fx = chain[0], fy = chain[1]
      if (Math.hypot(fx - x, fy - y) <= CLOSE_R) return { x: fx, y: fy, snapped: true, closesChain: true }
    }
    for (const ep of getEndpoints())
      if (Math.hypot(ep.x - x, ep.y - y) <= SNAP_R) return { x: ep.x, y: ep.y, snapped: true, closesChain: false }
    return { x, y, snapped: false, closesChain: false }
  }, [getEndpoints])

  const RECT_TOOLS = ['rect','ellipse','square','circle']
  const DRAG_TOOLS = [...RECT_TOOLS,'arrow']
  const POLY_TOOLS = ['pen','triangle','diamond']

  const pos       = useCallback(() => stageRef.current?.getPointerPosition()||{x:0,y:0}, [])
  const nearFirst = useCallback((x:number,y:number) =>
    polyPts.length >= 4 && Math.hypot(polyPts[0]-x, polyPts[1]-y) < 10, [polyPts])

  const canCloseChain = lineChain.length >= 6 &&
    Math.hypot(lineChain[0]-mouse.x, lineChain[1]-mouse.y) <= CLOSE_R

  // ── Atajos de teclado ─────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const isTyping = document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement

      if (e.key === 'Escape') {
        setPolyPts([]); setLineChain([]); setDragStart(null)
        setTempShape(null); setFreePoints([]); setDrawing(false); setSnapPt(null)
        marqueeOrigin.current = null; setMarquee(null)
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+A — seleccionar todo
      if (ctrl && e.key === 'a') {
        e.preventDefault()
        selectShapes(shapesRef.current.map(s => s.id))
        return
      }

      // Ctrl+C — copiar seleccionadas
      if (ctrl && e.key === 'c') {
        const sel = shapesRef.current.filter(s => selectedIdsRef.current.includes(s.id))
        if (sel.length > 0) { setCopiedShapes([...sel]); e.preventDefault() }
        return
      }

      // Ctrl+V — pegar
      if (ctrl && e.key === 'v') {
        if (copiedShapes.length === 0) return
        e.preventDefault()
        const OFFSET = 20
        const newIds: string[] = []
        copiedShapes.forEach(src => {
          const { id: _id, ...rest } = src
          const usesPts = ['polygon','freehand','line'].includes(src.shapeType)
          const pasted  = usesPts
            ? { ...rest, points: src.points?.map((v: number) => v + OFFSET) }
            : { ...rest, x: (src.x||0) + OFFSET, y: (src.y||0) + OFFSET }
          newIds.push(addShape(pasted))
        })
        selectShapes(newIds)
        return
      }

      // Ctrl+D — duplicar seleccionadas
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        const OFFSET = 20
        const todup = shapesRef.current.filter(s => selectedIdsRef.current.includes(s.id))
        const newIds: string[] = []
        todup.forEach(src => {
          const { id: _id, ...rest } = src
          const usesPts = ['polygon','freehand','line'].includes(src.shapeType)
          const dup = usesPts
            ? { ...rest, points: src.points?.map((v: number) => v + OFFSET) }
            : { ...rest, x: (src.x||0) + OFFSET, y: (src.y||0) + OFFSET }
          newIds.push(addShape(dup))
        })
        selectShapes(newIds)
        return
      }

      // Delete / Backspace — eliminar seleccionadas
      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace')) {
        selectedIdsRef.current.forEach(id => deleteShape(id))
        return
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [copiedShapes, selectShapes, addShape, deleteShape])

  // ── Popup ─────────────────────────────────────────────────────────────────
  const openPopup = (shapeData: any) => {
    const c = containerRef.current, st = stageRef.current
    if (!c||!st) return
    const r = c.getBoundingClientRect()
    const p = st.getPointerPosition()||{x:canvasWidth/2,y:canvasHeight/2}
    setPopup({ shape: shapeData, sx: r.left+p.x, sy: r.top+p.y })
  }

  const handleAssign = (moduleType: ModuleType) => {
    if (!popup) return
    addShape({ ...popup.shape, moduleType, fill:'', stroke:'', strokeWidth: sw })
    setPopup(null); setPolyPts([]); setLineChain([])
  }

  // ── Mouse Down ────────────────────────────────────────────────────────────
  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'delete') return
    const isStage = e.target === stageRef.current
    const raw = pos()

    // ── Select: arrancar marquee sobre stage vacío ──────────────────────────
    if (activeTool === 'select') {
      if (isStage) {
        marqueeOrigin.current = raw
        setMarquee({ x: raw.x, y: raw.y, w: 0, h: 0 })
      }
      return
    }

    // ── Herramienta Línea: modo cadena ──────────────────────────────────────
    if (activeTool === 'line' && isStage) {
      let sx: number, sy: number
      if (lineChain.length >= 2) {
        sx = lineChain[lineChain.length-2]
        sy = lineChain[lineChain.length-1]
      } else {
        const s = snap(raw.x, raw.y)
        sx = s.x; sy = s.y
      }
      setDragStart({x:sx, y:sy}); setDrawing(true)
      setTempShape({x:sx, y:sy, x2:sx, y2:sy})
      return
    }

    const {x,y} = raw

    if (DRAG_TOOLS.includes(activeTool) && isStage) {
      setDragStart({x,y}); setDrawing(true)
      setTempShape({x,y,x2:x,y2:y})
    }
    if (activeTool === 'freehand' && isStage) {
      setDrawing(true); setFreePoints([x,y])
    }
    if (POLY_TOOLS.includes(activeTool)) {
      if (activeTool === 'pen') {
        if (polyPts.length>=6 && nearFirst(x,y)) {
          openPopup({ shapeType:'polygon', x:0,y:0, points:polyPts, closed:true })
          setPolyPts([]); return
        }
        setPolyPts(p=>[...p,x,y])
      }
      if ((activeTool === 'triangle' || activeTool === 'diamond') && isStage) {
        setDragStart({x,y}); setDrawing(true); setTempShape({x,y,x2:x,y2:y})
      }
    }
  }

  // ── Mouse Move ────────────────────────────────────────────────────────────
  const onMouseMove = () => {
    const raw = pos()

    // Actualizar marquee
    if (activeTool === 'select' && marqueeOrigin.current) {
      const ox = marqueeOrigin.current.x, oy = marqueeOrigin.current.y
      setMarquee({ x:Math.min(raw.x,ox), y:Math.min(raw.y,oy), w:Math.abs(raw.x-ox), h:Math.abs(raw.y-oy) })
      return
    }

    if (activeTool === 'line') {
      let mx = raw.x, my = raw.y
      let sp: {x:number;y:number}|null = null
      const s = snapWithChain(raw.x, raw.y, lineChain)
      if (s.snapped) { mx = s.x; my = s.y; sp = {x:mx,y:my} }
      setMouse({x:mx, y:my}); setSnapPt(sp)
      if (drawing) setTempShape((t:any) => t ? {...t,x2:mx,y2:my} : null)
      return
    }

    const {x,y} = raw
    setMouse({x,y}); setSnapPt(null)
    if (!drawing) return
    if (DRAG_TOOLS.includes(activeTool)||activeTool==='triangle'||activeTool==='diamond')
      setTempShape((t:any)=>t?{...t,x2:x,y2:y}:null)
    if (activeTool==='freehand') setFreePoints(p=>[...p,x,y])
  }

  // ── Mouse Up ──────────────────────────────────────────────────────────────
  const onMouseUp = () => {
    // Cerrar marquee
    if (activeTool === 'select' && marqueeOrigin.current) {
      const m = marquee
      marqueeOrigin.current = null
      setMarquee(null)
      if (m && m.w > 4 && m.h > 4) {
        const inside = shapesRef.current.filter(s => shapeInBounds(s, m)).map(s => s.id)
        selectShapes(inside)
      }
      return
    }

    if (!drawing) return
    setDrawing(false); setSnapPt(null)

    if (activeTool==='freehand' && freePoints.length>=4) {
      openPopup({ shapeType:'freehand', x:0,y:0, points:freePoints, closed:false })
      setFreePoints([])
    }

    if (activeTool==='line') {
      if (!tempShape || Math.hypot(tempShape.x2-tempShape.x, tempShape.y2-tempShape.y) < 5) {
        setTempShape(null); setDragStart(null); return
      }
      const ex = tempShape.x2, ey = tempShape.y2
      const s = snapWithChain(ex, ey, lineChain)
      const fx = s.x, fy = s.y
      if (s.closesChain && lineChain.length >= 4) {
        openPopup({ shapeType:'polygon', x:0,y:0, points:[...lineChain], closed:true })
      } else {
        const newChain = lineChain.length === 0
          ? [tempShape.x, tempShape.y, fx, fy]
          : [...lineChain, fx, fy]
        setLineChain(newChain)
      }
      setTempShape(null); setDragStart(null)
      return
    }

    if (!tempShape || Math.hypot(tempShape.x2-tempShape.x, tempShape.y2-tempShape.y)<5) {
      setTempShape(null); setDragStart(null); return
    }

    const {x,y,x2,y2} = tempShape
    const minX=Math.min(x,x2), minY=Math.min(y,y2), w=Math.abs(x2-x), h=Math.abs(y2-y)

    if (activeTool==='rect'||activeTool==='square') {
      const size = activeTool==='square'?Math.max(w,h):null
      openPopup({ shapeType:'rect', x:minX, y:minY, width:size||w, height:size||h })
    }
    if (activeTool==='ellipse'||activeTool==='circle') {
      const rx=w/2, ry=activeTool==='circle'?rx:h/2
      openPopup({ shapeType:'ellipse', x:minX+rx, y:minY+ry, radiusX:rx, radiusY:ry })
    }
    if (activeTool==='arrow')
      openPopup({ shapeType:'line', x:0,y:0, points:[x,y,x2,y2], closed:false })
    if (activeTool==='triangle') {
      const cx=(x+x2)/2
      openPopup({ shapeType:'polygon', x:0,y:0, points:[cx,y, x2,y2, x,y2], closed:true })
    }
    if (activeTool==='diamond') {
      const cx=(x+x2)/2, cy=(y+y2)/2
      openPopup({ shapeType:'polygon', x:0,y:0, points:[cx,y, x2,cy, cx,y2, x,cy], closed:true })
    }
    setTempShape(null); setDragStart(null)
  }

  const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === stageRef.current && activeTool === 'select') {
      if (!e.evt.shiftKey) selectShapes([])
    }
  }

  const onStageDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'line') return
    if (lineChain.length < 6) return
    openPopup({ shapeType:'polygon', x:0,y:0, points:[...lineChain], closed:true })
    setLineChain([]); setTempShape(null); setDrawing(false)
  }

  // ── Preview shape mientras se dibuja ─────────────────────────────────────
  const renderPreview = () => {
    if (!tempShape) return null
    const {x,y,x2,y2} = tempShape
    const minX=Math.min(x,x2), minY=Math.min(y,y2), w=Math.abs(x2-x), h=Math.abs(y2-y)
    const style = { stroke:'#3b82f6', strokeWidth:sw, dash:[5,3] as number[], fill:'rgba(59,130,246,0.05)' as string, listening:false as boolean }
    if (activeTool==='rect') return <Rect x={minX} y={minY} width={w} height={h} {...style}/>
    if (activeTool==='square') { const s=Math.max(w,h); return <Rect x={minX} y={minY} width={s} height={s} {...style}/> }
    if (activeTool==='ellipse') return <Ellipse x={minX+w/2} y={minY+h/2} radiusX={w/2} radiusY={h/2} {...style}/>
    if (activeTool==='circle') { const r=w/2; return <Ellipse x={minX+r} y={minY+r} radiusX={r} radiusY={r} {...style}/> }
    if (activeTool==='line') return <Line points={[x,y,x2,y2]} stroke={canCloseChain?'#22c55e':'#3b82f6'} strokeWidth={sw} dash={[5,3]} lineCap="round" listening={false}/>
    if (activeTool==='arrow') return <Line points={[x,y,x2,y2]} stroke="#3b82f6" strokeWidth={sw} dash={[5,3]} lineCap="round" listening={false}/>
    if (activeTool==='triangle') { const cx=(x+x2)/2; return <Line points={[cx,y,x2,y2,x,y2]} closed {...style}/> }
    if (activeTool==='diamond') { const cx=(x+x2)/2, cy=(y+y2)/2; return <Line points={[cx,y,x2,cy,cx,y2,x,cy]} closed {...style}/> }
    return null
  }

  // ── Transformer options ───────────────────────────────────────────────────
  const hasPolygon = selectedShapeIds.some(id => {
    const s = shapes.find(sh => sh.id === id)
    return s && ['polygon','freehand','line'].includes(s.shapeType)
  })
  const multiSel = selectedShapeIds.length > 1

  const canClose = nearFirst(mouse.x, mouse.y)
  const cursor = activeTool==='select'?'default': activeTool==='delete'?'not-allowed':'crosshair'

  return (
    <div ref={containerRef} className="relative flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-6">
      <div className="relative" style={{display:'inline-block'}}>
        <Stage ref={stageRef} width={canvasWidth} height={canvasHeight}
          style={{cursor,display:'block'}}
          className="shadow-xl rounded border border-gray-300 bg-white"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onClick={onStageClick} onDblClick={onStageDblClick}>

          <Layer>
            {showGrid && <Grid w={canvasWidth} h={canvasHeight}/>}
            {photoBackground && <PhotoBg src={photoBackground} opacity={photoOpacity} w={canvasWidth} h={canvasHeight}/>}
          </Layer>

          <Layer>
            {shapes.map(shape => (
              <ShapeEl
                key={shape.id}
                ref={(node) => {
                  if (node) shapeRefs.current.set(shape.id, node as Konva.Shape)
                  else shapeRefs.current.delete(shape.id)
                }}
                shape={shape}
                strokeWidth={sw}
                selected={selectedShapeIds.includes(shape.id)}
                onSelect={(e) => {
                  if (activeTool === 'delete') {
                    deleteShape(shape.id)
                  } else if (e.evt.shiftKey) {
                    toggleShapeSelection(shape.id)
                  } else {
                    selectShape(shape.id)
                  }
                }}
                onDelete={() => deleteShape(shape.id)}
                onDragStart={makeDragStart(shape)}
                onDragMove={makeDragMove(shape)}
                onDragEnd={makeDragEnd(shape)}
              />
            ))}

            <Transformer
              ref={trRef}
              rotateEnabled={true}
              enabledAnchors={hasPolygon ? [] : undefined}
              boundBoxFunc={(!multiSel && !hasPolygon) ? (o,n) => (n.width<5||n.height<5?o:n) : undefined}
              onTransformEnd={onTransformEnd}
            />
          </Layer>

          <Layer listening={false}>
            {renderPreview()}

            {/* Marquee de selección */}
            {marquee && marquee.w > 1 && (
              <Rect
                x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
                fill="rgba(59,130,246,0.06)" stroke="#3b82f6" strokeWidth={1} dash={[4,3]}
                listening={false}
              />
            )}

            {/* Cadena de líneas en construcción */}
            {activeTool==='line' && lineChain.length>=2 && (
              <Line points={lineChain} stroke="#3b82f6" strokeWidth={sw} lineCap="round" lineJoin="round"/>
            )}
            {activeTool==='line' && lineChain.length>=2 && !drawing && (
              <Line
                points={[lineChain[lineChain.length-2], lineChain[lineChain.length-1], mouse.x, mouse.y]}
                stroke={canCloseChain?'#22c55e':'#94a3b8'} strokeWidth={1} dash={[4,4]} lineCap="round"/>
            )}
            {activeTool==='line' && lineChain.length>=4 && (
              <Circle x={lineChain[0]} y={lineChain[1]}
                radius={canCloseChain?9:5}
                fill={canCloseChain?'#22c55e':'#3b82f6'}
                stroke="white" strokeWidth={1.5}/>
            )}
            {activeTool==='line' && lineChain.length>=2 && (
              <Circle x={lineChain[lineChain.length-2]} y={lineChain[lineChain.length-1]}
                radius={4} fill="#3b82f6" stroke="white" strokeWidth={1.5}/>
            )}

            {/* Snap indicator */}
            {snapPt && !canCloseChain && (
              <Circle x={snapPt.x} y={snapPt.y} radius={8} stroke="#22c55e" strokeWidth={2} fill="rgba(34,197,94,0.15)"/>
            )}

            {/* Freehand preview */}
            {activeTool==='freehand' && freePoints.length>=2 &&
              <Line points={freePoints} stroke="#3b82f6" strokeWidth={sw} lineCap="round" lineJoin="round" tension={0.4}/>}

            {/* Pen */}
            {activeTool==='pen' && polyPts.length>=2 &&
              <Line points={polyPts} stroke="#3b82f6" strokeWidth={sw} lineCap="round" lineJoin="round"/>}
            {activeTool==='pen' && polyPts.length>=2 && (
              <Line points={[polyPts[polyPts.length-2],polyPts[polyPts.length-1],mouse.x,mouse.y]}
                stroke={canClose?'#22c55e':'#94a3b8'} strokeWidth={1} dash={[4,4]} lineCap="round"/>)}
            {activeTool==='pen' && polyPts.map((_,i)=>{
              if(i%2!==0)return null
              const px=polyPts[i],py=polyPts[i+1],isFirst=i===0
              return <Circle key={i} x={px} y={py}
                radius={isFirst?(canClose?8:5):3.5}
                fill={isFirst?(canClose?'#22c55e':'#3b82f6'):'#3b82f6'}
                stroke="white" strokeWidth={1.5}/>
            })}
          </Layer>
        </Stage>

        {/* Instrucciones */}
        {activeTool==='select' && selectedShapeIds.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {selectedShapeIds.length} seleccionadas · Shift+click agregar · Ctrl+D duplicar · Ctrl+C/V copiar · Supr eliminar
          </div>
        )}
        {activeTool==='pen' && polyPts.length>0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {canClose ? '🟢 Click para cerrar' : `${polyPts.length/2} puntos · Click en el primer punto (●) para cerrar`}
          </div>
        )}
        {activeTool==='line' && lineChain.length>0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {canCloseChain
              ? '🟢 Suelta aquí para cerrar la figura y asignar textura'
              : `${lineChain.length/2} puntos · Llega al ● verde para cerrar · Doble-click para cerrar aquí · ESC cancela`}
          </div>
        )}
      </div>

      {popup && (
        <AssignPopup x={popup.sx} y={popup.sy}
          onAssign={handleAssign}
          onCancel={()=>{setPopup(null);setPolyPts([]);setLineChain([])}}/>
      )}
    </div>
  )
}
