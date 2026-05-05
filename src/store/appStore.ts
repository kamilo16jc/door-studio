import { create } from 'zustand'
import { AppModule } from '../types'

interface AppState {
  currentModule: AppModule
  setModule: (module: AppModule) => void
  serverStatus: 'checking' | 'online' | 'offline'
  setServerStatus: (status: 'checking' | 'online' | 'offline') => void
}

export const useAppStore = create<AppState>((set) => ({
  currentModule: 'tracer',
  setModule: (module) => set({ currentModule: module }),
  serverStatus: 'checking',
  setServerStatus: (status) => set({ serverStatus: status })
}))
