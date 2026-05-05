import { useState } from 'react'
import { useTextureStore } from '../../store/textureStore'
import { useZoneStore } from '../../store/zoneStore'
import { Texture, ZoneTipo } from '../../types'
import { Upload, Wand2, Zap, Trash2, CheckCircle, Clock, AlertCircle, Link } from 'lucide-react'

const ZONE_TIPOS: { id: ZoneTipo; label: string }[] = [
  { id: 'madera',  label: 'Madera'  },
  { id: 'vidrio',  label: 'Vidrio'  },
  { id: 'moldura', label: 'Moldura' },
  { id: 'metal',   label: 'Metal'   },
  { id: 'pintura', label: 'Pintura' }
]

function StatusIcon({ status }: { status: Texture['status'] }) {
  if (status === 'ready') return <CheckCircle size={12} className="text-green-400"/>
  if (status === 'processing') return <Clock size={12} className="text-yellow-400 animate-spin"/>
  if (status === 'error') return <AlertCircle size={12} className="text-red-400"/>
  return null
}

function TextureCard({ texture }: { texture: Texture }) {
  const { deleteTexture, selectTexture, selectedTextureId, updateTexture } = useTextureStore()
  const { zones, assignTexture } = useZoneStore()
  const isSelected = selectedTextureId === texture.id
  const displayUrl = texture.hdUrl || texture.originalUrl

  return (
    <div
      onClick={() => selectTexture(isSelected ? null : texture.id)}
      className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
        isSelected ? 'border-accent' : 'border-dark-600 hover:border-dark-400'
      }`}
    >
      {/* Preview de la textura */}
      <div className="aspect-square bg-dark-700 relative">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={texture.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clock size={20} className="text-gray-600 animate-spin"/>
          </div>
        )}

        {/* Badge HD */}
        {texture.hdUrl && (
          <span className="absolute top-1 right-1 bg-accent text-dark-900 text-xs font-bold px-1 rounded">HD</span>
        )}

        {/* Status */}
        <span className="absolute top-1 left-1">
          <StatusIcon status={texture.status}/>
        </span>
      </div>

      {/* Info */}
      <div className="p-2 bg-dark-700">
        <p className="text-xs font-medium text-gray-900 truncate">{texture.name}</p>
        <p className="text-xs text-gray-500">{texture.tipo}</p>

        {/* Ajustes rápidos */}
        {isSelected && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Escala</span>
              <span>{texture.scale}x</span>
            </div>
            <input type="range" min="0.1" max="5" step="0.1"
              value={texture.scale}
              onChange={(e) => updateTexture(texture.id, { scale: Number(e.target.value) })}
              className="w-full accent-accent"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Rotación</span>
              <span>{texture.rotation}°</span>
            </div>
            <input type="range" min="0" max="360" step="5"
              value={texture.rotation}
              onChange={(e) => updateTexture(texture.id, { rotation: Number(e.target.value) })}
              className="w-full accent-accent"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Asignar a zona */}
        {isSelected && zones.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Asignar a zona:</p>
            <div className="flex flex-col gap-1">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  onClick={(e) => { e.stopPropagation(); assignTexture(zone.id, texture.id) }}
                  className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                    zone.textureId === texture.id
                      ? 'bg-accent text-dark-900'
                      : 'bg-dark-600 text-gray-600 hover:bg-dark-500'
                  }`}
                >
                  <Link size={10}/>
                  {zone.label}
                  {zone.textureId === texture.id && ' ✓'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botón eliminar */}
      <button
        onClick={(e) => { e.stopPropagation(); deleteTexture(texture.id) }}
        className="absolute bottom-1 right-1 p-1 bg-dark-900/80 rounded text-gray-600 hover:text-red-400 transition-colors"
      >
        <Trash2 size={10}/>
      </button>
    </div>
  )
}

export default function TextureModule() {
  const { textures, uploadAndUpscale, uploadAndEnhance, generateTexture, isProcessing } = useTextureStore()
  const [activeTipo, setActiveTipo] = useState<ZoneTipo>('madera')
  const [activeTab, setActiveTab] = useState<'upload' | 'generate'>('upload')
  const [genPrompt, setGenPrompt] = useState('')
  const [genName, setGenName] = useState('')

  const filtered = textures.filter((t) => t.tipo === activeTipo)

  const handleUploadUpscale = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAndUpscale(file, activeTipo)
    e.target.value = ''
  }

  const handleUploadEnhance = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAndEnhance(file, activeTipo)
    e.target.value = ''
  }

  const handleGenerate = () => {
    if (genPrompt && genName) {
      generateTexture(genPrompt, activeTipo, genName)
      setGenPrompt('')
      setGenName('')
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar de acciones */}
      <div className="w-64 bg-dark-800 border-r border-dark-600 flex flex-col gap-3 p-3 overflow-y-auto shrink-0">
        {/* Filtro por tipo */}
        <section>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Tipo de Material</p>
          <div className="flex flex-col gap-1">
            {ZONE_TIPOS.map((tipo) => (
              <button
                key={tipo.id}
                onClick={() => setActiveTipo(tipo.id)}
                className={`px-3 py-1.5 rounded text-xs text-left transition-all ${
                  activeTipo === tipo.id
                    ? 'bg-accent text-dark-900 font-medium'
                    : 'text-gray-400 hover:text-gray-900 hover:bg-dark-600'
                }`}
              >
                {tipo.label} ({textures.filter((t) => t.tipo === tipo.id).length})
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-dark-600"/>

        {/* Tabs: subir vs generar */}
        <div className="flex gap-1 bg-dark-700 p-1 rounded">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'upload' ? 'bg-dark-500 text-gray-900' : 'text-gray-500'
            }`}
          >
            Subir
          </button>
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
              activeTab === 'generate' ? 'bg-dark-500 text-gray-900' : 'text-gray-500'
            }`}
          >
            Generar IA
          </button>
        </div>

        {activeTab === 'upload' && (
          <section className="space-y-2">
            <p className="text-xs text-gray-500">Sube una textura original y mejórala con Replicate</p>

            <label className={`flex items-center gap-2 w-full px-3 py-2.5 rounded cursor-pointer transition-colors text-xs ${
              isProcessing ? 'bg-dark-700 text-gray-600 cursor-not-allowed' : 'bg-dark-600 hover:bg-dark-500 text-gray-600'
            }`}>
              <Zap size={13} className="text-accent"/>
              Upscale 4x (Real-ESRGAN)
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadUpscale} disabled={isProcessing}/>
            </label>

            <label className={`flex items-center gap-2 w-full px-3 py-2.5 rounded cursor-pointer transition-colors text-xs ${
              isProcessing ? 'bg-dark-700 text-gray-600 cursor-not-allowed' : 'bg-dark-600 hover:bg-dark-500 text-gray-600'
            }`}>
              <Wand2 size={13} className="text-accent"/>
              Mejorar con IA (img2img)
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadEnhance} disabled={isProcessing}/>
            </label>

            {isProcessing && (
              <div className="text-xs text-yellow-400 flex items-center gap-1.5 px-1">
                <Clock size={12} className="animate-spin"/>
                Procesando con Replicate...
              </div>
            )}
          </section>
        )}

        {activeTab === 'generate' && (
          <section className="space-y-2">
            <p className="text-xs text-gray-500">Genera una textura nueva con IA desde una descripción</p>
            <input
              type="text"
              placeholder="Nombre de la textura"
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-xs text-gray-900 placeholder-gray-600 focus:outline-none focus:border-accent"
            />
            <textarea
              placeholder="Ej: roble oscuro con veta pronunciada..."
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-dark-600 border border-dark-500 rounded text-xs text-gray-900 placeholder-gray-600 resize-none focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleGenerate}
              disabled={isProcessing || !genPrompt || !genName}
              className="w-full flex items-center justify-center gap-2 py-2 bg-accent text-dark-900 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-light transition-colors"
            >
              <Wand2 size={13}/>
              Generar con Replicate
            </button>
          </section>
        )}
      </div>

      {/* Grid de texturas */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">
            Texturas — {activeTipo} ({filtered.length})
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <Upload size={32} className="mb-2"/>
            <p className="text-sm">No hay texturas de {activeTipo}</p>
            <p className="text-xs mt-1">Sube una textura o genera una con IA</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((texture) => (
              <TextureCard key={texture.id} texture={texture}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
