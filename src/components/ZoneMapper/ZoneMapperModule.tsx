import { useZoneStore } from '../../store/zoneStore'
import { useTracerStore } from '../../store/tracerStore'
import ZoneCanvas from './ZoneCanvas'
import { ZoneTipo } from '../../types'
import { Trash2 } from 'lucide-react'

const ZONE_TIPOS: { id: ZoneTipo; label: string; color: string; emoji: string }[] = [
  { id: 'madera',  label: 'Madera',  color: '#8B5E3C', emoji: '🪵' },
  { id: 'vidrio',  label: 'Vidrio',  color: '#7EB8D4', emoji: '🪟' },
  { id: 'moldura', label: 'Moldura', color: '#A0856C', emoji: '🔲' },
  { id: 'metal',   label: 'Metal',   color: '#8C9BAB', emoji: '⬜' },
  { id: 'pintura', label: 'Pintura', color: '#C4A882', emoji: '🎨' }
]

export default function ZoneMapperModule() {
  const { shapes } = useTracerStore()
  const { zones, activeZoneTipo, setActiveZoneTipo, deleteZone } = useZoneStore()

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-dark-800 border-r border-dark-600 flex flex-col gap-4 p-3">
        <section>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Tipo de Zona</p>
          <p className="text-xs text-gray-600 mb-3">Selecciona un tipo y haz click sobre la forma para asignarlo</p>
          <div className="flex flex-col gap-1">
            {ZONE_TIPOS.map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => setActiveZoneTipo(tipo.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs transition-all ${
                  activeZoneTipo === tipo.id
                    ? 'ring-1 ring-white/30 font-medium text-gray-900'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-dark-600'
                }`}
                style={activeZoneTipo === tipo.id ? { backgroundColor: tipo.color + '44', borderLeft: `3px solid ${tipo.color}` } : {}}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tipo.color }}/>
                {tipo.emoji} {tipo.label}
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-dark-600"/>

        {/* Lista de zonas asignadas */}
        <section className="flex-1 overflow-y-auto">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
            Zonas Asignadas ({zones.length})
          </p>
          {zones.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">
              Haz click sobre las formas para asignar zonas
            </p>
          )}
          <div className="flex flex-col gap-1">
            {zones.map((zone) => {
              const tipo = ZONE_TIPOS.find((t) => t.id === zone.tipo)
              return (
                <div
                  key={zone.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded bg-dark-700 text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tipo?.color }}/>
                    <span className="text-gray-600">{zone.label}</span>
                  </span>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={11}/>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Canvas */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="bg-dark-800 border-b border-dark-600 px-4 py-2 text-xs text-gray-500">
          <span>Click sobre cada forma para asignar su tipo de zona · Formas: <b className="text-gray-900">{shapes.length}</b> · Zonas mapeadas: <b className="text-accent">{zones.length}</b></span>
        </div>
        <ZoneCanvas />
      </div>
    </div>
  )
}
