import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Line, Circle, Transformer, Path } from 'react-konva'
import Konva from 'konva'
import { useTracerStore } from '../../store/tracerStore'
import { TracedShape, ModuleType, BezierNode } from '../../types'
import { bezierNodesToPath, archRectToPath, chamferRectToPath } from '../../lib/svgFilters'
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
  if (s.shapeType === 'rect' || s.shapeType === 'archrect' || s.shapeType === 'chamferedrect' || s.shapeType === 'compound')
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
  if (s.shapeType === 'bezier' && (s as any).nodes) {
    const nodes = (s as any).nodes as BezierNode[]
    let x1=Infinity, y1=Infinity, x2=-Infinity, y2=-Infinity
    nodes.forEach(n => {
      const check = (px: number, py: number) => { x1=Math.min(x1,px+ox); x2=Math.max(x2,px+ox); y1=Math.min(y1,py+oy); y2=Math.max(y2,py+oy) }
      check(n.x, n.y)
      if (n.handleIn)  check(n.handleIn.x,  n.handleIn.y)
      if (n.handleOut) check(n.handleOut.x, n.handleOut.y)
    })
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
  onEditNodes: () => void
  opacity?: number
  strokeWidth: number
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragMove:  (e: Konva.KonvaEventObject<DragEvent>) => void
  onDragEnd:   (e: Konva.KonvaEventObject<DragEvent>) => void
}>(function ShapeEl({ shape, selected, onSelect, onEditNodes, opacity, strokeWidth, onDragStart, onDragMove, onDragEnd }, ref) {
  const s  = MOD_STYLE[shape.moduleType]
  const sw = selected ? Math.max(strokeWidth, 2) : strokeWidth
  const common = {
    id: shape.id,
    draggable: true,
    onClick:    onSelect,
    onDblClick: onEditNodes,
    rotation:   shape.rotation || 0,
    onDragStart,
    onDragMove,
    onDragEnd,
  }
  if (shape.shapeType === 'rect')
    return <Rect ref={ref as React.RefObject<Konva.Rect>}
      x={shape.x} y={shape.y} width={shape.width||0} height={shape.height||0}
      fill={s.fill} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
      opacity={opacity ?? 1} {...common}/>
  if (shape.shapeType === 'ellipse')
    return <Ellipse ref={ref as React.RefObject<Konva.Ellipse>}
      x={shape.x} y={shape.y} radiusX={shape.radiusX||50} radiusY={shape.radiusY||50}
      fill={s.fill} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
      opacity={opacity ?? 1} {...common}/>
  if (shape.shapeType === 'line')
    return <Line ref={ref as React.RefObject<Konva.Line>}
      x={shape.x||0} y={shape.y||0}
      points={shape.points||[]} stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
      lineCap="round" lineJoin="round" opacity={opacity ?? 1} {...common}/>
  if (shape.shapeType === 'bezier' && (shape as any).nodes) {
    const pathData = bezierNodesToPath((shape as any).nodes as BezierNode[], shape.closed !== false)
    return <Path
      ref={ref as React.RefObject<Konva.Path>}
      x={shape.x||0} y={shape.y||0}
      data={pathData}
      fill={s.fill}
      stroke={selected ? '#2563eb' : s.stroke}
      strokeWidth={sw}
      opacity={opacity ?? 1}
      {...common}
    />
  }
  if (shape.shapeType === 'archrect' || shape.shapeType === 'chamferedrect') {
    const pathData = shape.shapeType === 'archrect'
      ? archRectToPath(0, 0, shape.width||0, shape.height||0, shape.archHeight ?? (shape.width||0)/2)
      : chamferRectToPath(0, 0, shape.width||0, shape.height||0, shape.chamferSize ?? Math.min(shape.width||50, shape.height||50)*0.1)
    return <Path
      ref={ref as React.RefObject<Konva.Path>}
      x={shape.x||0} y={shape.y||0}
      data={pathData}
      fill={s.fill}
      stroke={selected ? '#2563eb' : s.stroke}
      strokeWidth={sw}
      opacity={opacity ?? 1}
      {...common}
    />
  }
  if (shape.shapeType === 'compound' && (shape as any).svgPath) {
    return <Path
      ref={ref as React.RefObject<Konva.Path>}
      x={shape.x || 0} y={shape.y || 0}
      data={(shape as any).svgPath}
      fill={s.fill}
      fillRule="evenodd"
      stroke={selected ? '#2563eb' : s.stroke}
      strokeWidth={sw}
      opacity={opacity ?? 1}
      {...common}
    />
  }
  // curve usa Catmull-Rom tension 0.5; freehand 0.4; polygon 0
  const tension = shape.shapeType === 'curve' ? 0.5 : shape.shapeType === 'freehand' ? 0.4 : 0
  return <Line ref={ref as React.RefObject<Konva.Line>}
    x={shape.x||0} y={shape.y||0}
    points={shape.points||[]} closed={shape.closed!==false} fill={s.fill}
    stroke={selected?'#2563eb':s.stroke} strokeWidth={sw}
    tension={tension}
    lineCap="round" lineJoin="round" opacity={opacity ?? 1} {...common}/>
})

// ─── Polygon/Curve/Freehand node editor ──────────────────────────────────────
function PolyNodeEditor({ shape, updateShape, onClose }: {
  shape: TracedShape
  updateShape: (id: string, u: Partial<TracedShape>) => void
  onClose: () => void
}) {
  const ox     = shape.x || 0, oy = shape.y || 0
  const s      = MOD_STYLE[shape.moduleType]
  const tension = shape.shapeType === 'curve' ? 0.5 : shape.shapeType === 'freehand' ? 0.4 : 0
  const pts    = shape.points || []
  const count  = Math.floor(pts.length / 2)
  const closed = shape.closed !== false

  // Local state for segment-drag preview
  const [segDrag, setSegDrag] = useState<{
    segIdx: number; hoX: number; hoY: number; hiX: number; hiY: number
  } | null>(null)

  return <>
    {/* Click-trap BEHIND nodes */}
    <Rect x={-9999} y={-9999} width={99999} height={99999}
      fill="transparent" onClick={onClose} onTap={onClose}/>

    {/* Live shape preview */}
    <Line x={0} y={0}
      points={pts.map((v, i) => i % 2 === 0 ? v + ox : v + oy)}
      closed={closed} fill={s.fill} stroke={s.stroke} strokeWidth={2.5}
      tension={tension} listening={false}/>

    {/* Preview curved segment while dragging */}
    {segDrag && (() => {
      const bIdx = (segDrag.segIdx + 1) % count
      const ax2 = pts[segDrag.segIdx * 2] + ox, ay2 = pts[segDrag.segIdx * 2 + 1] + oy
      const bx2 = pts[bIdx * 2] + ox,            by2 = pts[bIdx * 2 + 1] + oy
      return <Path
        data={`M ${ax2} ${ay2} C ${segDrag.hoX} ${segDrag.hoY} ${segDrag.hiX} ${segDrag.hiY} ${bx2} ${by2}`}
        stroke="#22c55e" strokeWidth={2.5} fill="transparent" listening={false}/>
    })()}

    {/* ── Green midpoint handles — drag to curve a segment ──────────────── */}
    {Array.from({ length: closed ? count : count - 1 }, (_, i) => {
      const bIdx = (i + 1) % count
      const ax = pts[i * 2] + ox,    ay = pts[i * 2 + 1] + oy
      const bx = pts[bIdx * 2] + ox, by = pts[bIdx * 2 + 1] + oy
      return (
        <Circle key={`seg-${i}`}
          x={(ax + bx) / 2} y={(ay + by) / 2}
          radius={5} fill="#22c55e" stroke="white" strokeWidth={2} opacity={0.85}
          draggable
          onClick={e => { e.cancelBubble = true }}
          onDragMove={e => {
            e.cancelBubble = true
            const dx = e.target.x(), dy = e.target.y()
            const Qx = 2 * dx - 0.5 * ax - 0.5 * bx
            const Qy = 2 * dy - 0.5 * ay - 0.5 * by
            setSegDrag({ segIdx: i,
              hoX: ax / 3 + 2 * Qx / 3, hoY: ay / 3 + 2 * Qy / 3,
              hiX: bx / 3 + 2 * Qx / 3, hiY: by / 3 + 2 * Qy / 3
            })
          }}
          onDragEnd={() => {
            if (!segDrag) return
            const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
            if (!cur?.points) return
            const cp = cur.points, cc = Math.floor(cp.length / 2)
            const cox = cur.x || 0, coy = cur.y || 0
            const bIdx2 = (segDrag.segIdx + 1) % cc
            const newNodes: BezierNode[] = Array.from({ length: cc }, (_, j) => ({
              x: cp[j * 2], y: cp[j * 2 + 1],
              ...(j === segDrag.segIdx ? { handleOut: { x: segDrag.hoX - cox, y: segDrag.hoY - coy } } : {}),
              ...(j === bIdx2         ? { handleIn:  { x: segDrag.hiX - cox, y: segDrag.hiY - coy } } : {}),
            }))
            updateShape(shape.id, { shapeType: 'bezier', nodes: newNodes } as any)
            setSegDrag(null)
          }}
        />
      )
    })}

    {/* Draggable node circles */}
    {Array.from({ length: count }, (_, i) => {
      const nx = pts[i * 2] + ox
      const ny = pts[i * 2 + 1] + oy
      return (
        <Circle key={i} x={nx} y={ny}
          radius={7} fill="white" stroke="#3b82f6" strokeWidth={2.5}
          shadowBlur={6} shadowColor="rgba(59,130,246,0.35)"
          draggable
          onDragMove={e => {
            const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
            if (!cur?.points) return
            const newPts = [...cur.points]
            newPts[i * 2]     = e.target.x() - ox
            newPts[i * 2 + 1] = e.target.y() - oy
            updateShape(shape.id, { points: newPts })
          }}
          onDblClick={e => {
            e.cancelBubble = true
            const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
            if (!cur?.points || cur.points.length / 2 <= 3) return
            const newPts = [...cur.points]
            newPts.splice(i * 2, 2)
            updateShape(shape.id, { points: newPts })
          }}
          onClick={e => { e.cancelBubble = true }}
        />
      )
    })}
  </>
}

// ─── Bezier node editor ───────────────────────────────────────────────────────
function BezierNodeEditor({ shape, updateShape, onClose }: {
  shape: TracedShape
  updateShape: (id: string, u: Partial<TracedShape>) => void
  onClose: () => void
}) {
  const ox    = shape.x || 0, oy = shape.y || 0
  const s     = MOD_STYLE[shape.moduleType]
  const nodes = (shape as any).nodes as BezierNode[]
  if (!nodes || nodes.length < 2) return null

  const pathData = bezierNodesToPath(nodes, shape.closed !== false)

  const updateNode = (i: number, patch: Partial<BezierNode>) => {
    const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
    const curNodes = (cur as any)?.nodes as BezierNode[]
    if (!curNodes) return
    const newNodes = curNodes.map((n, idx) => idx === i ? { ...n, ...patch } : n)
    updateShape(shape.id, { nodes: newNodes } as any)
  }

  const closed = shape.closed !== false
  const n      = nodes.length

  return <>
    {/* Click-trap */}
    <Rect x={-9999} y={-9999} width={99999} height={99999}
      fill="transparent" onClick={onClose} onTap={onClose}/>

    {/* Live bezier shape preview */}
    <Path x={ox} y={oy} data={pathData}
      fill={s.fill} stroke={s.stroke} strokeWidth={2.5} listening={false}/>

    {/* ── Green midpoint handles — drag to reshape a segment ────────────── */}
    {Array.from({ length: closed ? n : n - 1 }, (_, i) => {
      const bIdx = (i + 1) % n
      const a = nodes[i], b = nodes[bIdx]
      const mx = (a.x + b.x) / 2 + ox
      const my = (a.y + b.y) / 2 + oy
      return (
        <Circle key={`seg-${i}`} x={mx} y={my}
          radius={5} fill="#22c55e" stroke="white" strokeWidth={2} opacity={0.85}
          draggable
          onClick={e => { e.cancelBubble = true }}
          onDragMove={e => {
            e.cancelBubble = true
            const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
            const cn  = (cur as any)?.nodes as BezierNode[]
            if (!cn) return
            const cox = cur?.x || 0, coy = cur?.y || 0
            const ca  = cn[i], cb = cn[(i + 1) % cn.length]
            const cax = ca.x + cox, cay = ca.y + coy
            const cbx = cb.x + cox, cby = cb.y + coy
            const dx  = e.target.x(), dy = e.target.y()
            const Qx  = 2 * dx - 0.5 * cax - 0.5 * cbx
            const Qy  = 2 * dy - 0.5 * cay - 0.5 * cby
            const newNodes = cn.map((nd, j) => {
              if (j === i)               return { ...nd, handleOut: { x: cax/3 + 2*Qx/3 - cox, y: cay/3 + 2*Qy/3 - coy } }
              if (j === (i+1)%cn.length) return { ...nd, handleIn:  { x: cbx/3 + 2*Qx/3 - cox, y: cby/3 + 2*Qy/3 - coy } }
              return nd
            })
            updateShape(shape.id, { nodes: newNodes } as any)
          }}
        />
      )
    })}

    {nodes.map((node, i) => {
      const nx       = node.x + ox
      const ny       = node.y + oy
      const isSmooth = !!(node.handleIn || node.handleOut)

      return (
        <React.Fragment key={i}>
          {/* Handle In line + diamond */}
          {node.handleIn && <>
            <Line points={[nx, ny, node.handleIn.x + ox, node.handleIn.y + oy]}
              stroke="#f97316" strokeWidth={1.2} dash={[4, 3]} listening={false}/>
            <Circle x={node.handleIn.x + ox} y={node.handleIn.y + oy}
              radius={5} fill="#f97316" stroke="white" strokeWidth={2}
              shadowBlur={4} shadowColor="rgba(249,115,22,0.4)"
              draggable
              onClick={e => { e.cancelBubble = true }}
              onDragMove={e => {
                const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
                const curNodes = (cur as any)?.nodes as BezierNode[]
                if (!curNodes) return
                const n   = curNodes[i]
                const hiX = e.target.x() - ox
                const hiY = e.target.y() - oy
                updateNode(i, {
                  handleIn:  { x: hiX, y: hiY },
                  handleOut: { x: n.x - (hiX - n.x), y: n.y - (hiY - n.y) }
                })
              }}
            />
          </>}

          {/* Handle Out line + diamond */}
          {node.handleOut && <>
            <Line points={[nx, ny, node.handleOut.x + ox, node.handleOut.y + oy]}
              stroke="#f97316" strokeWidth={1.2} dash={[4, 3]} listening={false}/>
            <Circle x={node.handleOut.x + ox} y={node.handleOut.y + oy}
              radius={5} fill="#f97316" stroke="white" strokeWidth={2}
              shadowBlur={4} shadowColor="rgba(249,115,22,0.4)"
              draggable
              onClick={e => { e.cancelBubble = true }}
              onDragMove={e => {
                const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
                const curNodes = (cur as any)?.nodes as BezierNode[]
                if (!curNodes) return
                const n   = curNodes[i]
                const hoX = e.target.x() - ox
                const hoY = e.target.y() - oy
                updateNode(i, {
                  handleOut: { x: hoX, y: hoY },
                  handleIn:  { x: n.x - (hoX - n.x), y: n.y - (hoY - n.y) }
                })
              }}
            />
          </>}

          {/* Node circle — click toggles smooth/corner, dblclick deletes */}
          <Circle x={nx} y={ny}
            radius={isSmooth ? 8 : 6}
            fill={isSmooth ? '#f97316' : 'white'}
            stroke={isSmooth ? 'white' : '#3b82f6'}
            strokeWidth={2.5}
            shadowBlur={6}
            shadowColor={isSmooth ? 'rgba(249,115,22,0.4)' : 'rgba(59,130,246,0.35)'}
            draggable
            onClick={e => {
              e.cancelBubble = true
              const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
              const curNodes = (cur as any)?.nodes as BezierNode[]
              if (!curNodes) return
              const n = curNodes[i]
              const hasHandles = !!(n.handleIn || n.handleOut)
              if (hasHandles) {
                // Remove handles → corner node
                updateNode(i, { handleIn: undefined, handleOut: undefined })
              } else {
                // Add handles → smooth node based on adjacent nodes
                const total = curNodes.length
                const prev  = curNodes[(i - 1 + total) % total]
                const next  = curNodes[(i + 1) % total]
                const dx = (next.x - prev.x) * 0.2
                const dy = (next.y - prev.y) * 0.2
                updateNode(i, {
                  handleOut: { x: n.x + dx, y: n.y + dy },
                  handleIn:  { x: n.x - dx, y: n.y - dy }
                })
              }
            }}
            onDblClick={e => {
              e.cancelBubble = true
              const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
              const curNodes = (cur as any)?.nodes as BezierNode[]
              if (!curNodes || curNodes.length <= 3) return
              updateShape(shape.id, { nodes: curNodes.filter((_, idx) => idx !== i) } as any)
            }}
            onDragMove={e => {
              const cur = useTracerStore.getState().shapes.find(sh => sh.id === shape.id)
              const curNodes = (cur as any)?.nodes as BezierNode[]
              if (!curNodes) return
              const n  = curNodes[i]
              const dx = e.target.x() - ox - n.x
              const dy = e.target.y() - oy - n.y
              updateNode(i, {
                x: n.x + dx,
                y: n.y + dy,
                handleIn:  n.handleIn  ? { x: n.handleIn.x  + dx, y: n.handleIn.y  + dy } : undefined,
                handleOut: n.handleOut ? { x: n.handleOut.x + dx, y: n.handleOut.y + dy } : undefined,
              })
            }}
          />
        </React.Fragment>
      )
    })}
  </>
}

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

  // ── Node editor state ─────────────────────────────────────────────────────
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null)

  // ── Multi-select state ────────────────────────────────────────────────────
  const [copiedShapes, setCopiedShapes] = useState<TracedShape[]>([])
  const [marquee,      setMarquee]      = useState<{x:number;y:number;w:number;h:number}|null>(null)
  const marqueeOrigin  = useRef<{x:number;y:number}|null>(null)

  // ── Bezier pen state ──────────────────────────────────────────────────────
  const [bezNodes,       setBezNodes]      = useState<BezierNode[]>([])
  const [bezDragOrigin,  setBezDragOrigin] = useState<{x:number;y:number}|null>(null)
  const [bezDragHandle,  setBezDragHandle] = useState<{x:number;y:number}|null>(null)
  const bezDragOriginRef = useRef<{x:number;y:number}|null>(null)

  // Posiciones iniciales capturadas al empezar arrastre de grupo
  const dragInitPos = useRef(new Map<string, {x:number;y:number}>())

  // ── Exit node edit mode when tool changes ─────────────────────────────────
  useEffect(() => {
    setEditingShapeId(null)
  }, [activeTool])

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
      if (shape.shapeType === 'archrect' || shape.shapeType === 'chamferedrect' || shape.shapeType === 'compound') {
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        const newW = (shape.width||0)*sx
        const newH = (shape.height||0)*sy
        const updates: any = { x: node.x(), y: node.y(), width: newW, height: newH, rotation: node.rotation() }
        if (shape.shapeType === 'archrect') updates.archHeight = (shape.archHeight ?? newW/2) * sy
        if (shape.shapeType === 'chamferedrect') updates.chamferSize = (shape.chamferSize ?? 10) * Math.min(sx, sy)
        updateShape(id, updates)
      } else if (shape.shapeType === 'rect') {
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        updateShape(id, { x: node.x(), y: node.y(), width:(shape.width||0)*sx, height:(shape.height||0)*sy, rotation: node.rotation() })
      } else if (shape.shapeType === 'ellipse') {
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        updateShape(id, { radiusX:(shape.radiusX||50)*sx, radiusY:(shape.radiusY||50)*sy, rotation: node.rotation() })
      } else if (shape.points && shape.points.length >= 2) {
        // polygon / freehand / curve / line — scale all points
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        const scaledPts = shape.points.map((v, i) => i % 2 === 0 ? v * sx : v * sy)
        updateShape(id, { x: node.x(), y: node.y(), points: scaledPts, rotation: node.rotation() })
      } else if ((shape as any).nodes) {
        // bezier — scale all node positions and handles
        const sx = node.scaleX(), sy = node.scaleY()
        node.scaleX(1); node.scaleY(1)
        const scaledNodes = ((shape as any).nodes as BezierNode[]).map(n => ({
          x: n.x * sx, y: n.y * sy,
          handleIn:  n.handleIn  ? { x: n.handleIn.x  * sx, y: n.handleIn.y  * sy } : undefined,
          handleOut: n.handleOut ? { x: n.handleOut.x * sx, y: n.handleOut.y * sy } : undefined,
        }))
        updateShape(id, { x: node.x(), y: node.y(), nodes: scaledNodes, rotation: node.rotation() } as any)
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

  const RECT_TOOLS = ['rect','ellipse','square','circle','archrect','chamferedrect']
  const DRAG_TOOLS = [...RECT_TOOLS,'arrow']
  const POLY_TOOLS = ['pen','triangle','diamond']
  const CURVE_PEN_TOOLS = ['pen','curve']  // ambas usan polyPts

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
        setEditingShapeId(null)
        setPolyPts([]); setLineChain([]); setDragStart(null)
        setTempShape(null); setFreePoints([]); setDrawing(false); setSnapPt(null)
        marqueeOrigin.current = null; setMarquee(null)
        setBezNodes([]); setBezDragOrigin(null); setBezDragHandle(null); bezDragOriginRef.current = null
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
          const usesPts = ['polygon','freehand','line','curve'].includes(src.shapeType)
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
          const usesPts = ['polygon','freehand','line','curve'].includes(src.shapeType)
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
    if (editingShapeId) return  // node editor handles all interaction
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

    // ── Bezier pen tool ────────────────────────────────────────────────────────
    if (activeTool === 'bezier') {
      if (!isStage) return
      const {x, y} = raw
      // Check if closing path (near first node)
      if (bezNodes.length >= 3) {
        const first = bezNodes[0]
        if (Math.hypot(first.x - x, first.y - y) < 14) {
          openPopup({ shapeType: 'bezier', x: 0, y: 0, nodes: bezNodes, closed: true })
          setBezNodes([]); setBezDragOrigin(null); setBezDragHandle(null)
          bezDragOriginRef.current = null
          return
        }
      }
      bezDragOriginRef.current = { x, y }
      setBezDragOrigin({ x, y })
      setBezDragHandle(null)
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
    if (POLY_TOOLS.includes(activeTool) || CURVE_PEN_TOOLS.includes(activeTool)) {
      if (activeTool === 'pen') {
        if (polyPts.length>=6 && nearFirst(x,y)) {
          openPopup({ shapeType:'polygon', x:0,y:0, points:polyPts, closed:true })
          setPolyPts([]); return
        }
        setPolyPts(p=>[...p,x,y])
      }
      if (activeTool === 'curve') {
        if (polyPts.length>=6 && nearFirst(x,y)) {
          openPopup({ shapeType:'curve', x:0,y:0, points:polyPts, closed:true })
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

    // ── Bezier drag handle tracking ────────────────────────────────────────────
    if (activeTool === 'bezier') {
      const {x, y} = raw
      setMouse({x, y}); setSnapPt(null)
      if (bezDragOriginRef.current) {
        const origin = bezDragOriginRef.current
        if (Math.hypot(x - origin.x, y - origin.y) > 6) {
          setBezDragHandle({x, y})
        }
      }
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

    // ── Bezier: commit node on mouse up ───────────────────────────────────────
    if (activeTool === 'bezier' && bezDragOriginRef.current) {
      const origin = bezDragOriginRef.current
      const newNode: BezierNode = { x: origin.x, y: origin.y }
      const handle = bezDragHandle
      if (handle && Math.hypot(handle.x - origin.x, handle.y - origin.y) > 6) {
        const dx = handle.x - origin.x
        const dy = handle.y - origin.y
        newNode.handleOut = { x: handle.x,            y: handle.y            }
        newNode.handleIn  = { x: origin.x - dx, y: origin.y - dy }
      }
      setBezNodes(n => [...n, newNode])
      bezDragOriginRef.current = null
      setBezDragOrigin(null)
      setBezDragHandle(null)
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
    if (activeTool === 'archrect')
      openPopup({ shapeType:'archrect', x:minX, y:minY, width:w, height:h, archHeight: Math.min(w/2, h*0.6) })
    if (activeTool === 'chamferedrect')
      openPopup({ shapeType:'chamferedrect', x:minX, y:minY, width:w, height:h, chamferSize: Math.min(w,h)*0.1 })
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
    if (editingShapeId) return  // handled by node editor's click trap
    if (e.target === stageRef.current && activeTool === 'select') {
      if (!e.evt.shiftKey) selectShapes([])
    }
  }

  const onStageDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'bezier' && bezNodes.length >= 2) {
      const closed = bezNodes.length >= 3
      openPopup({ shapeType: 'bezier', x: 0, y: 0, nodes: [...bezNodes], closed })
      setBezNodes([]); setBezDragOrigin(null); setBezDragHandle(null)
      bezDragOriginRef.current = null
      return
    }
    if (activeTool === 'line') {
      if (lineChain.length < 6) return
      openPopup({ shapeType:'polygon', x:0,y:0, points:[...lineChain], closed:true })
      setLineChain([]); setTempShape(null); setDrawing(false)
      return
    }
    if (activeTool === 'curve' && polyPts.length >= 4) {
      // Doble-click finaliza la curva (cerrada si hay ≥3 puntos, abierta si no)
      const closed = polyPts.length >= 6
      openPopup({ shapeType:'curve', x:0,y:0, points:[...polyPts], closed })
      setPolyPts([])
    }
  }

  // ── Preview shape mientras se dibuja ─────────────────────────────────────
  const renderPreview = () => {
    if (!tempShape) return null
    const {x,y,x2,y2} = tempShape
    const minX=Math.min(x,x2), minY=Math.min(y,y2), w=Math.abs(x2-x), h=Math.abs(y2-y)
    const style = { stroke:'#3b82f6', strokeWidth:sw, dash:[5,3] as number[], fill:'rgba(59,130,246,0.05)' as string, listening:false as boolean }
    if (activeTool==='rect') return <Rect x={minX} y={minY} width={w} height={h} {...style}/>
    if (activeTool==='square') { const s=Math.max(w,h); return <Rect x={minX} y={minY} width={s} height={s} {...style}/> }
    if (activeTool==='archrect') return <Path x={minX} y={minY} data={archRectToPath(0, 0, w, h, Math.min(w/2, h*0.6))} {...style}/>
    if (activeTool==='chamferedrect') return <Path x={minX} y={minY} data={chamferRectToPath(0, 0, w, h, Math.min(w,h)*0.1)} {...style}/>
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
    return s && ['polygon','freehand','line','curve','bezier'].includes(s.shapeType)
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
                onEditNodes={() => {
                  selectShape(shape.id)
                  setEditingShapeId(shape.id)
                }}
                opacity={editingShapeId && editingShapeId !== shape.id ? 0.3 : 1}
                onDragStart={makeDragStart(shape)}
                onDragMove={makeDragMove(shape)}
                onDragEnd={makeDragEnd(shape)}
              />
            ))}

            <Transformer
              ref={trRef}
              rotateEnabled={true}
              boundBoxFunc={!multiSel ? (o,n) => (n.width<5||n.height<5?o:n) : undefined}
              onTransformEnd={onTransformEnd}
            />
          </Layer>

          {/* ── Arch / Chamfer handle layer ───────────────────────────────── */}
          {activeTool === 'select' && selectedShapeIds.length === 1 && (() => {
            const selShape = shapes.find(s => s.id === selectedShapeIds[0])
            if (!selShape) return null
            if (selShape.shapeType === 'archrect') {
              const ah = selShape.archHeight ?? (selShape.width||0)/2
              const hx = (selShape.x||0) + (selShape.width||0)/2
              const hy = (selShape.y||0) + ah
              return (
                <Layer>
                  <Circle
                    x={hx} y={hy}
                    radius={7}
                    fill="#fbbf24" stroke="white" strokeWidth={2}
                    draggable
                    dragBoundFunc={(pos) => ({ x: hx, y: pos.y })}
                    cursor="ns-resize"
                    onDragMove={e => {
                      const newAh = Math.max(5, Math.min((selShape.height||0), e.target.y() - (selShape.y||0)))
                      updateShape(selShape.id, { archHeight: newAh })
                    }}
                    onDragEnd={e => {
                      const newAh = Math.max(5, Math.min((selShape.height||0), e.target.y() - (selShape.y||0)))
                      updateShape(selShape.id, { archHeight: newAh })
                    }}
                  />
                </Layer>
              )
            }
            if (selShape.shapeType === 'chamferedrect') {
              const cs = selShape.chamferSize ?? Math.min(selShape.width||50, selShape.height||50)*0.1
              const hx = (selShape.x||0) + cs
              const hy = selShape.y||0
              return (
                <Layer>
                  <Circle
                    x={hx} y={hy}
                    radius={7}
                    fill="#fbbf24" stroke="white" strokeWidth={2}
                    draggable
                    dragBoundFunc={(pos) => ({ x: pos.x, y: hy })}
                    cursor="ew-resize"
                    onDragMove={e => {
                      const maxCs = Math.min(selShape.width||50, selShape.height||50)/2 - 2
                      const newCs = Math.max(2, Math.min(maxCs, e.target.x() - (selShape.x||0)))
                      updateShape(selShape.id, { chamferSize: newCs })
                    }}
                    onDragEnd={e => {
                      const maxCs = Math.min(selShape.width||50, selShape.height||50)/2 - 2
                      const newCs = Math.max(2, Math.min(maxCs, e.target.x() - (selShape.x||0)))
                      updateShape(selShape.id, { chamferSize: newCs })
                    }}
                  />
                </Layer>
              )
            }
            return null
          })()}

          {/* ── Node editor layer ─────────────────────────────────────────── */}
          {editingShapeId && (() => {
            const editShape = shapes.find(s => s.id === editingShapeId)
            if (!editShape) return null
            const canEdit = editShape.points?.length || (editShape as any).nodes?.length
            if (!canEdit) return null
            return (
              <Layer>
                {editShape.points && (
                  <PolyNodeEditor
                    shape={editShape}
                    updateShape={updateShape}
                    onClose={() => setEditingShapeId(null)}
                  />
                )}
                {(editShape as any).nodes && (
                  <BezierNodeEditor
                    shape={editShape}
                    updateShape={updateShape}
                    onClose={() => setEditingShapeId(null)}
                  />
                )}
              </Layer>
            )
          })()}

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

            {/* Curve — preview suavizado con tensión Catmull-Rom */}
            {activeTool==='curve' && polyPts.length>=2 && (
              <Line
                points={[...polyPts, mouse.x, mouse.y]}
                stroke="#8b5cf6" strokeWidth={sw}
                lineCap="round" lineJoin="round"
                tension={0.5} listening={false}/>
            )}
            {activeTool==='curve' && polyPts.length>=2 && (
              <Line
                points={[polyPts[polyPts.length-2], polyPts[polyPts.length-1], mouse.x, mouse.y]}
                stroke={canClose?'#22c55e':'#c4b5fd'} strokeWidth={1} dash={[4,4]} lineCap="round"/>
            )}
            {activeTool==='curve' && polyPts.map((_,i)=>{
              if(i%2!==0) return null
              const px=polyPts[i], py=polyPts[i+1], isFirst=i===0
              return <Circle key={i} x={px} y={py}
                radius={isFirst?(canClose?9:5):3.5}
                fill={isFirst?(canClose?'#22c55e':'#8b5cf6'):'#8b5cf6'}
                stroke="white" strokeWidth={1.5}/>
            })}

            {/* ── Bezier pen preview ──────────────────────────────────────────── */}
            {activeTool === 'bezier' && (() => {
              const nearFirst = bezNodes.length >= 3 &&
                Math.hypot(bezNodes[0].x - mouse.x, bezNodes[0].y - mouse.y) < 14

              // Path of committed nodes + preview next segment
              const previewNodes: BezierNode[] = bezDragOrigin
                ? [...bezNodes, { x: bezDragOrigin.x, y: bezDragOrigin.y,
                    handleIn: bezDragHandle
                      ? { x: 2*bezDragOrigin.x - bezDragHandle.x, y: 2*bezDragOrigin.y - bezDragHandle.y }
                      : undefined
                  }]
                : [...bezNodes, { x: mouse.x, y: mouse.y }]

              const previewPath = previewNodes.length >= 2
                ? bezierNodesToPath(previewNodes, false)
                : ''

              return <>
                {/* Main path */}
                {bezNodes.length >= 2 && (
                  <Path data={bezierNodesToPath(bezNodes, false)}
                    stroke="#f97316" strokeWidth={sw} fill="transparent"/>
                )}
                {/* Preview next segment */}
                {previewPath && previewNodes.length >= 2 && (
                  <Path data={previewPath}
                    stroke={nearFirst ? '#22c55e' : '#fdba74'}
                    strokeWidth={1} fill="transparent"
                    dash={bezDragOrigin ? [] : [5, 3]}/>
                )}
                {/* Drag handle lines + circles */}
                {bezDragOrigin && bezDragHandle && Math.hypot(bezDragHandle.x - bezDragOrigin.x, bezDragHandle.y - bezDragOrigin.y) > 6 && (
                  <>
                    <Line points={[
                      2*bezDragOrigin.x - bezDragHandle.x, 2*bezDragOrigin.y - bezDragHandle.y,
                      bezDragHandle.x, bezDragHandle.y
                    ]} stroke="#f97316" strokeWidth={1.2} dash={[4,3]}/>
                    <Circle x={bezDragHandle.x} y={bezDragHandle.y} radius={4} fill="#f97316" stroke="white" strokeWidth={1.5}/>
                    <Circle x={2*bezDragOrigin.x - bezDragHandle.x} y={2*bezDragOrigin.y - bezDragHandle.y} radius={4} fill="#f97316" stroke="white" strokeWidth={1.5}/>
                  </>
                )}
                {/* Pending node indicator */}
                {bezDragOrigin && (
                  <Circle x={bezDragOrigin.x} y={bezDragOrigin.y} radius={5} fill="#f97316" stroke="white" strokeWidth={2}/>
                )}
                {/* Node dots for committed nodes */}
                {bezNodes.map((n, i) => {
                  const isFirst = i === 0
                  const close = isFirst && bezNodes.length >= 3 && Math.hypot(n.x - mouse.x, n.y - mouse.y) < 14
                  return <React.Fragment key={i}>
                    {n.handleOut && (
                      <><Line points={[n.x, n.y, n.handleOut.x, n.handleOut.y]} stroke="#f97316" strokeWidth={0.8} dash={[3,2]} opacity={0.5}/>
                      <Circle x={n.handleOut.x} y={n.handleOut.y} radius={3} fill="white" stroke="#f97316" strokeWidth={1.5}/></>
                    )}
                    {n.handleIn && (
                      <><Line points={[n.x, n.y, n.handleIn.x, n.handleIn.y]} stroke="#f97316" strokeWidth={0.8} dash={[3,2]} opacity={0.5}/>
                      <Circle x={n.handleIn.x} y={n.handleIn.y} radius={3} fill="white" stroke="#f97316" strokeWidth={1.5}/></>
                    )}
                    <Circle x={n.x} y={n.y}
                      radius={isFirst ? (close ? 9 : 6) : 4}
                      fill={isFirst ? (close ? '#22c55e' : '#f97316') : '#f97316'}
                      stroke="white" strokeWidth={1.5}/>
                  </React.Fragment>
                })}
              </>
            })()}
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
        {activeTool==='curve' && polyPts.length>0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-purple-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {canClose
              ? '🟢 Click para cerrar la curva'
              : `${polyPts.length/2} pts · Click en ● para cerrar · Doble-click para finalizar abierta · ESC cancela`}
          </div>
        )}
        {activeTool === 'bezier' && bezNodes.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-orange-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {bezNodes.length >= 3 && Math.hypot(bezNodes[0].x - mouse.x, bezNodes[0].y - mouse.y) < 14
              ? '🟢 Click para cerrar la forma'
              : `${bezNodes.length} nodos · Click=recto · Click+arrastrar=curva · Doble-click para terminar · ESC cancela`}
          </div>
        )}
        {activeTool==='line' && lineChain.length>0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
            {canCloseChain
              ? '🟢 Suelta aquí para cerrar la figura y asignar textura'
              : `${lineChain.length/2} puntos · Llega al ● verde para cerrar · Doble-click para cerrar aquí · ESC cancela`}
          </div>
        )}
        {editingShapeId && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-emerald-900/85 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"/>
            Editando nodos · Arrastra nodos (●) o manijas (◆) · Click en nodo = curva/recto · Doble-click nodo = eliminar · ESC para salir
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
