import { useMemo, useState } from 'react'
import { useTracerStore } from '../../store/tracerStore'
import { useZoneStore } from '../../store/zoneStore'
import { useTextureStore } from '../../store/textureStore'
import { useRealismStore } from '../../store/realismStore'
import { generateSVG } from '../../lib/svgExport'
import { RefreshCw } from 'lucide-react'

export default function PreviewModule() {
  const { shapes, canvasWidth, canvasHeight } = useTracerStore()
  const { zones } = useZoneStore()
  const { textures } = useTextureStore()
  const realism = useRealismStore()
  const [key, setKey] = useState(0)

  const svgContent = useMemo(
    () => generateSVG({ shapes, zones, textures, realism, width: canvasWidth, height: canvasHeight }),
    // key forces regeneration on manual refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shapes, zones, textures, realism, canvasWidth, canvasHeight, key]
  )

  const zoneMap    = useMemo(() => new Map(zones.map((z) => [z.shapeId, z])), [zones])
  const textureMap = useMemo(() => new Map(textures.map((t) => [t.id, t])), [textures])
  const noShapes   = shapes.length === 0

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Viewport de previsualización */}
      <div className="flex-1 bg-dark-900 flex flex-col overflow-hidden">
        <div className="bg-dark-800 border-b border-dark-600 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            Vista en tiempo real ·
            Formas: <b className="text-gray-900">{shapes.length}</b> ·
            Zonas: <b className="text-gray-900">{zones.length}</b> ·
            Texturas: <b className="text-gray-900">{textures.filter(t => t.status === 'ready').length}</b>
          </span>
          <button
            onClick={() => setKey(k => k + 1)}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <RefreshCw size={12}/> Refrescar
          </button>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          {noShapes ? (
            <div className="text-center text-gray-600">
              <p className="text-sm">Sin formas para previsualizar</p>
              <p className="text-xs mt-1">Traza la puerta primero en el módulo Trazador</p>
            </div>
          ) : (
            <div
              key={key}
              className="border border-dark-600 rounded-lg overflow-hidden shadow-2xl"
              style={{ maxWidth: canvasWidth, maxHeight: canvasHeight, width: '100%' }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>

      {/* Panel lateral: resumen */}
      <div className="w-52 bg-dark-800 border-l border-dark-600 p-3 overflow-y-auto shrink-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Resumen</p>

        {/* Formas por módulo */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Marcos</span>
            <span className="text-amber-600 font-medium">{shapes.filter(s => s.moduleType === 'marco').length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Paneles</span>
            <span className="text-amber-400 font-medium">{shapes.filter(s => s.moduleType === 'panel').length}</span>
          </div>
        </div>

        <div className="border-t border-dark-600 my-3"/>

        {/* Zonas con su textura */}
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Zonas</p>
        <div className="space-y-2">
          {zones.length === 0 && <p className="text-xs text-gray-600">Sin zonas mapeadas</p>}
          {zones.map((zone) => {
            const tex = zone.textureId ? textureMap.get(zone.textureId) : undefined
            return (
              <div key={zone.id} className="bg-dark-700 rounded p-2">
                <p className="text-xs font-medium text-gray-900">{zone.label}</p>
                <p className="text-xs text-gray-500">{zone.tipo}</p>
                {tex ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    {(tex.hdUrl || tex.originalUrl) && (
                      <img src={tex.hdUrl || tex.originalUrl} className="w-6 h-6 rounded object-cover"/>
                    )}
                    <span className="text-xs text-green-400 truncate">{tex.name}</span>
                    {tex.hdUrl && <span className="text-xs text-accent font-bold">HD</span>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 mt-1">Sin textura</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
