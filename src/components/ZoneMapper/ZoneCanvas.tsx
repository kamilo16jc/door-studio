import { Stage, Layer, Rect, Ellipse, Line, Text, Path } from 'react-konva'
import { useTracerStore } from '../../store/tracerStore'
import { useZoneStore } from '../../store/zoneStore'
import { TracedShape } from '../../types'
import { archRectToPath, chamferRectToPath, bezierNodesToPath } from '../../lib/svgFilters'

function getShapeCenter(shape: TracedShape): { cx: number; cy: number } {
  if (shape.shapeType === 'rect' || shape.shapeType === 'archrect' || shape.shapeType === 'chamferedrect' || shape.shapeType === 'compound')
    return { cx: (shape.x || 0) + (shape.width || 0) / 2, cy: (shape.y || 0) + (shape.height || 0) / 2 }
  if (shape.shapeType === 'ellipse')
    return { cx: shape.x, cy: shape.y }
  if (shape.shapeType === 'bezier' && (shape as any).nodes?.length) {
    const nodes = (shape as any).nodes as Array<{ x: number; y: number }>
    const sx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length
    const sy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
    return { cx: (shape.x || 0) + sx, cy: (shape.y || 0) + sy }
  }
  if (shape.points?.length) {
    const n = shape.points.length / 2
    const sx = shape.points.reduce((s, v, i) => i % 2 === 0 ? s + v : s, 0) / n
    const sy = shape.points.reduce((s, v, i) => i % 2 !== 0 ? s + v : s, 0) / n
    return { cx: (shape.x || 0) + sx, cy: (shape.y || 0) + sy }
  }
  return { cx: shape.x || 0, cy: shape.y || 0 }
}

function ZoneShape({ shape }: { shape: TracedShape }) {
  const { addZone, getZoneByShapeId, getZoneColor } = useZoneStore()
  const zone   = getZoneByShapeId(shape.id)
  const fill   = zone ? getZoneColor(zone.tipo) + '66' : 'rgba(200,200,200,0.15)'
  const stroke = zone ? getZoneColor(zone.tipo) : '#888'

  const handleClick = () => addZone(shape.id)
  const { cx, cy } = getShapeCenter(shape)

  const label = zone ? zone.label : '+ Zona'
  const labelProps = {
    x: cx - 25, y: cy - 7,
    text: label,
    fontSize: 11,
    fill: zone ? 'white' : '#888',
    fontStyle: zone ? 'bold' : 'normal',
    shadowColor: zone ? 'black' : undefined,
    shadowBlur: zone ? 3 : undefined,
    listening: false as const,
  }

  const shapeProps = {
    fill, stroke, strokeWidth: 2,
    onClick: handleClick, onTap: handleClick,
  }

  // ── rect ──────────────────────────────────────────────────────────────
  if (shape.shapeType === 'rect') {
    return <>
      <Rect x={shape.x} y={shape.y} width={shape.width||0} height={shape.height||0} {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── ellipse ───────────────────────────────────────────────────────────
  if (shape.shapeType === 'ellipse') {
    return <>
      <Ellipse x={shape.x} y={shape.y} radiusX={shape.radiusX||50} radiusY={shape.radiusY||50} {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── archrect ──────────────────────────────────────────────────────────
  if (shape.shapeType === 'archrect') {
    const d = archRectToPath(0, 0, shape.width||0, shape.height||0, shape.archHeight ?? (shape.width||0)/2)
    return <>
      <Path x={shape.x||0} y={shape.y||0} data={d} {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── chamferedrect ─────────────────────────────────────────────────────
  if (shape.shapeType === 'chamferedrect') {
    const cs = shape.chamferSize ?? Math.min(shape.width||50, shape.height||50) * 0.1
    const d = chamferRectToPath(0, 0, shape.width||0, shape.height||0, cs)
    return <>
      <Path x={shape.x||0} y={shape.y||0} data={d} {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── compound ──────────────────────────────────────────────────────────
  if (shape.shapeType === 'compound' && shape.svgPath) {
    return <>
      <Path x={shape.x||0} y={shape.y||0} data={shape.svgPath} fillRule="evenodd" {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── bezier ────────────────────────────────────────────────────────────
  if (shape.shapeType === 'bezier' && (shape as any).nodes) {
    const d = bezierNodesToPath((shape as any).nodes, shape.closed !== false)
    return <>
      <Path x={shape.x||0} y={shape.y||0} data={d} {...shapeProps}/>
      <Text {...labelProps}/>
    </>
  }

  // ── polygon / curve / freehand / line (points-based) ─────────────────
  if (shape.points?.length) {
    const tension = shape.shapeType === 'curve' ? 0.5 : shape.shapeType === 'freehand' ? 0.4 : 0
    return <>
      <Line
        x={shape.x||0} y={shape.y||0}
        points={shape.points}
        closed={shape.closed !== false}
        tension={tension}
        {...shapeProps}
      />
      <Text {...labelProps}/>
    </>
  }

  return null
}

export default function ZoneCanvas() {
  const { shapes, canvasWidth, canvasHeight } = useTracerStore()

  return (
    <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
      <Stage width={canvasWidth} height={canvasHeight} className="border border-dark-600 rounded bg-white shadow-xl">
        <Layer>
          {shapes.map((shape) => (
            <ZoneShape key={shape.id} shape={shape} />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
