import { useAppStore } from '../../store/appStore'
import { AppModule } from '../../types'
import {
  PenTool, Grid3X3, Image, Sliders, Eye, Download, Layers
} from 'lucide-react'

const MODULES: { id: AppModule; label: string; icon: React.ReactNode }[] = [
  { id: 'tracer',   label: 'Trazador',    icon: <PenTool size={15}/> },
  { id: 'zones',    label: 'Zonas',       icon: <Grid3X3 size={15}/> },
  { id: 'textures', label: 'Texturas',    icon: <Image size={15}/> },
  { id: 'realism',  label: 'Realismo',    icon: <Sliders size={15}/> },
  { id: 'preview',  label: 'Vista Previa',icon: <Eye size={15}/> },
  { id: 'export',   label: 'Exportar',    icon: <Download size={15}/> }
]

export default function Header() {
  const { currentModule, setModule, serverStatus } = useAppStore()

  return (
    <header className="bg-white border-b border-gray-200 flex items-center justify-between px-4 h-14 shrink-0 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Layers size={20} className="text-accent" />
        <span className="font-semibold text-gray-900 tracking-wide text-sm">Door Studio</span>
      </div>

      {/* Navegación de módulos */}
      <nav className="flex items-center gap-1">
        {MODULES.map((mod, i) => (
          <button
            key={mod.id}
            onClick={() => setModule(mod.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all
              ${currentModule === mod.id
                ? 'bg-accent text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            {mod.icon}
            {mod.label}
            {i < MODULES.length - 1 && (
              <span className="ml-1 text-gray-300 text-xs">›</span>
            )}
          </button>
        ))}
      </nav>

      {/* Estado del servidor */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${
          serverStatus === 'online' ? 'bg-green-400' :
          serverStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400 animate-pulse'
        }`}/>
        <span className="text-xs text-gray-500">
          {serverStatus === 'online' ? 'Servidor activo' :
           serverStatus === 'offline' ? 'Servidor offline' : 'Conectando...'}
        </span>
      </div>
    </header>
  )
}
