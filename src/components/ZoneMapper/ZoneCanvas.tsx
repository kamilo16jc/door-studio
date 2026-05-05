import { Stage, Layer, Rect, Line, Text } from 'react-konva'
import Konva from 'konva'
import { useTracerStore } from '../../store/tracerStore'
import { useZoneStore } from '../../store/zoneStore'
import { TracedShape } from '../../types'

function ZoneShape({ shape }: { shape: TracedShape }) {
  const { addZone, getZoneByShapeId, getZoneColor } = useZoneStore()

  const zone = getZoneByShapeId(shape.id)
  const fill = zone ? getZoneColor(zone.tipo) + '66' : 'rgba(255,255,255,0.05)'
  const stroke = zone ? getZoneColor(zone.tipo) : '#555'

  const handleClick = () => addZone(shape.id)

  const ox = shape.x || 0
  const oy = shape.y || 0

  const cx = shape.shapeType === 'rect'
    ? shape.x + (shape.width || 0) / 2
    : ox + (shape.points?.reduce((s, v, i) => i % 2 === 0 ? s + v : s, 0) || 0) / ((shape.points?.length || 2) / 2)

  const cy = shape.shapeType === 'rect'
    ? shape.y + (shape.height || 0) / 2
    : oy + (shape.points?.reduce((s, v, i) => i % 2 !== 0 ? s + v : s, 0) || 0) / ((shape.points?.length || 2) / 2)

  return (
    <>
      {shape.shapeType === 'rect' ? (
        <Rect
          x={shape.x} y={shape.y}
          width={shape.width} height={shape.height}
          fill={fill} stroke={stroke} strokeWidth={2}
          onClick={handleClick} onTap={handleClick}
          style={{ cursor: 'pointer' }}
        />
      ) : (
        <Line
          x={ox} y={oy}
          points={shape.points || []}
          fill={fill} stroke={stroke} strokeWidth={2}
          closed
          onClick={handleClick} onTap={handleClick}
        />
      )}
      {zone && (
        <Text
          x={cx - 30} y={cy - 8}
          text={zone.label}
          fontSize={11}
          fill="white"
          fontStyle="bold"
          shadowColor="black"
          shadowBlur={4}
          listening={false}
        />
      )}
      {!zone && (
        <Text
          x={cx - 20} y={cy - 8}
          text="+ Zona"
          fontSize={10}
          fill="#888"
          listening={false}
        />
      )}
    </>
  )
}

export default function ZoneCanvas() {
  const { shapes, canvasWidth, canvasHeight } = useTracerStore()

  return (
    <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
      <Stage width={canvasWidth} height={canvasHeight} className="border border-dark-600 rounded">
        <Layer>
          {shapes.map((shape) => (
            <ZoneShape key={shape.id} shape={shape} />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
