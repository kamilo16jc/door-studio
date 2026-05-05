import { create } from 'zustand'
import { RealismSettings, FinishType } from '../types'

interface RealismState extends RealismSettings {
  setLightAngle: (angle: number) => void
  setLightIntensity: (intensity: number) => void
  setShadowDepth: (depth: number) => void
  setMoldureDepth: (depth: number) => void
  setFinish: (finish: FinishType) => void
  setAmbientOcclusion: (value: number) => void
  setGlassOpacity: (value: number) => void
  setGlassBlur: (value: number) => void
  setGlassReflection: (value: number) => void
  reset: () => void
}

const defaults: RealismSettings = {
  lightAngle: 135,
  lightIntensity: 0.7,
  shadowDepth: 8,
  moldureDepth: 4,
  finish: 'satinado',
  ambientOcclusion: 0.3,
  glassOpacity: 0.3,
  glassBlur: 2,
  glassReflection: 0.5
}

export const useRealismStore = create<RealismState>((set) => ({
  ...defaults,
  setLightAngle: (lightAngle) => set({ lightAngle }),
  setLightIntensity: (lightIntensity) => set({ lightIntensity }),
  setShadowDepth: (shadowDepth) => set({ shadowDepth }),
  setMoldureDepth: (moldureDepth) => set({ moldureDepth }),
  setFinish: (finish) => set({ finish }),
  setAmbientOcclusion: (ambientOcclusion) => set({ ambientOcclusion }),
  setGlassOpacity: (glassOpacity) => set({ glassOpacity }),
  setGlassBlur: (glassBlur) => set({ glassBlur }),
  setGlassReflection: (glassReflection) => set({ glassReflection }),
  reset: () => set(defaults)
}))
