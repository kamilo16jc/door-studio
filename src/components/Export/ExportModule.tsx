import { useTracerStore } from '../../store/tracerStore'
import { useZoneStore } from '../../store/zoneStore'
import { useTextureStore } from '../../store/textureStore'
import { useRealismStore } from '../../store/realismStore'
import { generateSVG, downloadSVG, exportAsPNG } from '../../lib/svgExport'
import { FileCode2, Image, FileJson, Download, CheckCircle, AlertTriangle } from 'lucide-react'

export default function ExportModule() {
  const { shapes, canvasWidth, canvasHeight } = useTracerStore()
  const { zones } = useZoneStore()
  const { textures } = useTextureStore()
  const realism = useRealismStore()

  const hdTextures = textures.filter((t) => t.hdUrl)
  const assignedZones = zones.filter((z) => z.textureId)

  const checks = [
    { label: 'Formas trazadas', ok: shapes.length > 0, value: `${shapes.length} formas` },
    { label: 'Zonas mapeadas', ok: zones.length > 0, value: `${zones.length} zonas` },
    { label: 'Texturas HD', ok: hdTextures.length > 0, value: `${hdTextures.length} texturas HD` },
    { label: 'Zonas con textura', ok: assignedZones.length > 0, value: `${assignedZones.length} asignadas` }
  ]

  const canExport = shapes.length > 0

  const handleExportSVG = () => {
    const svg = generateSVG({ shapes, zones, textures, realism, width: canvasWidth, height: canvasHeight })
    downloadSVG(svg, 'puerta.svg')
  }

  const handleExportPNG = () => {
    const svg = generateSVG({ shapes, zones, textures, realism, width: canvasWidth, height: canvasHeight })
    exportAsPNG(svg, 'puerta.png')
  }

  const handleExportJSON = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      canvas: { width: canvasWidth, height: canvasHeight },
      shapes,
      zones,
      textures: textures.map((t) => ({ ...t, originalUrl: t.hdUrl || t.originalUrl })),
      realism
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'puerta-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportTexturesOnly = () => {
    hdTextures.forEach((tex) => {
      if (!tex.hdUrl) return
      const a = document.createElement('a')
      a.href = tex.hdUrl
      a.download = `textura-${tex.name}-HD.png`
      a.target = '_blank'
      a.click()
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-dark-900">
      <div className="max-w-xl mx-auto space-y-6">
        <h2 className="text-sm font-semibold text-gray-900">Exportar</h2>

        {/* Checklist */}
        <div className="bg-dark-700 rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Estado del Proyecto</p>
          {checks.map((check) => (
            <div key={check.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                {check.ok
                  ? <CheckCircle size={13} className="text-green-400"/>
                  : <AlertTriangle size={13} className="text-yellow-500"/>
                }
                <span className={check.ok ? 'text-gray-600' : 'text-gray-500'}>{check.label}</span>
              </span>
              <span className={check.ok ? 'text-green-400' : 'text-gray-600'}>{check.value}</span>
            </div>
          ))}
        </div>

        {/* Opciones de exportación */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Formatos de Exportación</p>

          {/* SVG */}
          <button
            onClick={handleExportSVG}
            disabled={!canExport}
            className="w-full flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-dark-600 hover:border-dark-500 transition-all text-left"
          >
            <div className="p-2 bg-accent/10 rounded">
              <FileCode2 size={20} className="text-accent"/>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">SVG con Texturas</p>
              <p className="text-xs text-gray-500 mt-0.5">SVG limpio con filtros de realismo y texturas embebidas. Listo para el configurador web.</p>
            </div>
            <Download size={16} className="text-gray-500"/>
          </button>

          {/* PNG */}
          <button
            onClick={handleExportPNG}
            disabled={!canExport}
            className="w-full flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-dark-600 hover:border-dark-500 transition-all text-left"
          >
            <div className="p-2 bg-blue-500/10 rounded">
              <Image size={20} className="text-blue-400"/>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">PNG de Alta Resolución</p>
              <p className="text-xs text-gray-500 mt-0.5">Render plano 2x para presentaciones y cotizaciones.</p>
            </div>
            <Download size={16} className="text-gray-500"/>
          </button>

          {/* JSON */}
          <button
            onClick={handleExportJSON}
            disabled={!canExport}
            className="w-full flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-dark-600 hover:border-dark-500 transition-all text-left"
          >
            <div className="p-2 bg-purple-500/10 rounded">
              <FileJson size={20} className="text-purple-400"/>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Configuración JSON</p>
              <p className="text-xs text-gray-500 mt-0.5">Guarda toda la configuración del proyecto para continuar después.</p>
            </div>
            <Download size={16} className="text-gray-500"/>
          </button>

          {/* Texturas HD */}
          <button
            onClick={handleExportTexturesOnly}
            disabled={hdTextures.length === 0}
            className="w-full flex items-center gap-4 p-4 bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-dark-600 hover:border-dark-500 transition-all text-left"
          >
            <div className="p-2 bg-green-500/10 rounded">
              <Image size={20} className="text-green-400"/>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Texturas HD ({hdTextures.length})</p>
              <p className="text-xs text-gray-500 mt-0.5">Descarga todas las texturas procesadas por Replicate en alta calidad.</p>
            </div>
            <Download size={16} className="text-gray-500"/>
          </button>
        </div>

        {!canExport && (
          <p className="text-xs text-center text-yellow-500">
            Necesitas al menos trazar una forma antes de exportar
          </p>
        )}
      </div>
    </div>
  )
}
