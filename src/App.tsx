import { useEffect } from 'react'
import axios from 'axios'
import Header from './components/Layout/Header'
import TracerModule from './components/Tracer/TracerModule'
import ZoneMapperModule from './components/ZoneMapper/ZoneMapperModule'
import TextureModule from './components/TextureManager/TextureModule'
import RealismModule from './components/RealismEngine/RealismModule'
import PreviewModule from './components/Preview/PreviewModule'
import ExportModule from './components/Export/ExportModule'
import { useAppStore } from './store/appStore'

export default function App() {
  const { currentModule, setServerStatus } = useAppStore()

  // Verificar estado del servidor al cargar
  useEffect(() => {
    const check = async () => {
      try {
        await axios.get('/api/health')
        setServerStatus('online')
      } catch {
        setServerStatus('offline')
      }
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-dark-900 text-gray-900 overflow-hidden font-sans">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        {currentModule === 'tracer'   && <TracerModule />}
        {currentModule === 'zones'    && <ZoneMapperModule />}
        {currentModule === 'textures' && <TextureModule />}
        {currentModule === 'realism'  && <RealismModule />}
        {currentModule === 'preview'  && <PreviewModule />}
        {currentModule === 'export'   && <ExportModule />}
      </main>
    </div>
  )
}
