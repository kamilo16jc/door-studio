import { useState } from 'react'
import TracerToolbar from './TracerToolbar'
import TracerCanvas from './TracerCanvas'
import { useTracerStore } from '../../store/tracerStore'

export default function TracerModule() {
  const { shapes, activeModule, setActiveModule } = useTracerStore()
  const [showGrid,    setShowGrid]    = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(1.5)

  const marcoCount = shapes.filter(s => s.moduleType === 'marco').length
  const panelCount = shapes.filter(s => s.moduleType === 'panel').length

  return (
    <div className="flex flex-1 overflow-hidden">
      <TracerToolbar
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(g => !g)}
        strokeWidth={strokeWidth}
        onStrokeWidth={setStrokeWidth}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Barra de módulo Marco/Panel */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
          <span className="text-xs text-gray-500 font-medium shrink-0">Dibujando como:</span>
          <div className="flex gap-1.5">
            <button onClick={() => setActiveModule('marco')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeModule === 'marco'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
              }`}>
              <span className={`w-2 h-2 rounded-full ${activeModule==='marco'?'bg-white':'bg-blue-600'}`}/>
              Marco
            </button>
            <button onClick={() => setActiveModule('panel')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeModule === 'panel'
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-amber-600 border-amber-300 hover:bg-amber-50'
              }`}>
              <span className={`w-2 h-2 rounded-full ${activeModule==='panel'?'bg-white':'bg-amber-500'}`}/>
              Panel
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200"/>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Marcos: <b className="text-blue-600">{marcoCount}</b></span>
            <span>Paneles: <b className="text-amber-500">{panelCount}</b></span>
            <span>Total: <b className="text-gray-700">{shapes.length}</b></span>
          </div>
        </div>

        <TracerCanvas showGrid={showGrid} strokeWidth={strokeWidth}/>

        {/* Leyenda */}
        <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-blue-600"/>Marco
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-amber-500"/>Panel
          </span>
          <span className="ml-auto">Doble-click sobre una forma para eliminarla · ESC para cancelar</span>
        </div>
      </div>
    </div>
  )
}
