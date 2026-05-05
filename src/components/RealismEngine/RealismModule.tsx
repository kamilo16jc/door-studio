import { useRealismStore } from '../../store/realismStore'
import { FinishType } from '../../types'
import { RotateCcw } from 'lucide-react'

function Slider({
  label, value, min, max, step, onChange, unit = ''
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-accent font-medium">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-700 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

const FINISHES: { id: FinishType; label: string; desc: string }[] = [
  { id: 'mate',     label: 'Mate',     desc: 'Sin brillo, absorbe la luz' },
  { id: 'satinado', label: 'Satinado', desc: 'Brillo suave y uniforme' },
  { id: 'brillante',label: 'Brillante',desc: 'Alto brillo y reflejos' }
]

export default function RealismModule() {
  const {
    lightAngle, setLightAngle,
    lightIntensity, setLightIntensity,
    shadowDepth, setShadowDepth,
    moldureDepth, setMoldureDepth,
    finish, setFinish,
    ambientOcclusion, setAmbientOcclusion,
    glassOpacity, setGlassOpacity,
    glassBlur, setGlassBlur,
    glassReflection, setGlassReflection,
    reset
  } = useRealismStore()

  // Indicador visual de dirección de luz
  const rad = (lightAngle * Math.PI) / 180
  const lx = 24 + Math.cos(rad) * 18
  const ly = 24 + Math.sin(rad) * 18

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-dark-900">
      <div className="max-w-2xl mx-auto space-y-4">

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Motor de Realismo</h2>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            <RotateCcw size={12}/> Resetear
          </button>
        </div>

        {/* Iluminación */}
        <Section title="Iluminación">
          <div className="flex items-center gap-6">
            {/* Rueda de dirección de luz */}
            <div className="shrink-0">
              <p className="text-xs text-gray-500 mb-2 text-center">Dirección</p>
              <div
                className="relative w-12 h-12 rounded-full bg-dark-600 border border-dark-500 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const cx = rect.left + rect.width / 2
                  const cy = rect.top + rect.height / 2
                  const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
                  setLightAngle(Math.round((angle + 360) % 360))
                }}
              >
                <div
                  className="absolute w-2 h-2 rounded-full bg-accent"
                  style={{ left: lx - 4, top: ly - 4 }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">
                  {lightAngle}°
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <Slider label="Intensidad de luz" value={lightIntensity} min={0} max={1} step={0.05}
                onChange={setLightIntensity} unit=""/>
            </div>
          </div>
        </Section>

        {/* Sombras y profundidad */}
        <Section title="Sombras y Profundidad">
          <Slider label="Profundidad de sombra (panel/marco)" value={shadowDepth} min={0} max={30} step={1}
            onChange={setShadowDepth} unit="px"/>
          <Slider label="Relieve de molduras" value={moldureDepth} min={0} max={20} step={1}
            onChange={setMoldureDepth} unit="px"/>
          <Slider label="Oclusión ambiental (bordes)" value={ambientOcclusion} min={0} max={1} step={0.05}
            onChange={setAmbientOcclusion}/>
        </Section>

        {/* Acabado superficial */}
        <Section title="Acabado Superficial">
          <div className="grid grid-cols-3 gap-2">
            {FINISHES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFinish(f.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  finish === f.id
                    ? 'border-accent bg-accent/10'
                    : 'border-dark-500 hover:border-dark-400 bg-dark-600'
                }`}
              >
                <p className={`text-xs font-medium ${finish === f.id ? 'text-accent' : 'text-gray-900'}`}>
                  {f.label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Vidrio */}
        <Section title="Configuración de Vidrio">
          <Slider label="Opacidad del vidrio" value={glassOpacity} min={0} max={1} step={0.05}
            onChange={setGlassOpacity}/>
          <Slider label="Desenfoque (frosted)" value={glassBlur} min={0} max={10} step={0.5}
            onChange={setGlassBlur} unit="px"/>
          <Slider label="Intensidad de reflejo" value={glassReflection} min={0} max={1} step={0.05}
            onChange={setGlassReflection}/>
        </Section>

        {/* Preview rápida de efectos */}
        <Section title="Preview de Efectos">
          <div className="grid grid-cols-3 gap-3">
            {/* Madera */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Madera</p>
              <div
                className="h-16 rounded"
                style={{
                  background: `linear-gradient(${lightAngle}deg,
                    rgba(0,0,0,${shadowDepth * 0.02}) 0%,
                    rgba(139,94,60,0.8) 40%,
                    rgba(255,255,255,${lightIntensity * 0.3}) 100%)`,
                  filter: finish === 'brillante' ? 'brightness(1.2)' : 'none'
                }}
              />
            </div>
            {/* Vidrio */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Vidrio</p>
              <div
                className="h-16 rounded"
                style={{
                  background: `linear-gradient(135deg,
                    rgba(126,184,212,${glassReflection * 0.6}) 0%,
                    rgba(126,184,212,${glassOpacity}) 50%,
                    rgba(255,255,255,${glassReflection * 0.4}) 100%)`,
                  backdropFilter: `blur(${glassBlur}px)`
                }}
              />
            </div>
            {/* Moldura */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Moldura</p>
              <div
                className="h-16 rounded"
                style={{
                  background: `linear-gradient(${lightAngle}deg,
                    rgba(255,255,255,0.4) 0%,
                    rgba(160,133,108,0.9) 50%,
                    rgba(0,0,0,${moldureDepth * 0.02}) 100%)`
                }}
              />
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}
