const STORAGE_KEY = 'sijaka-app-settings'

export const DEFAULT_APP_SETTINGS = {
  darkMode: false,
  textScale: 'normal',
  highContrast: false,
  reduceMotion: false,
  dataSaver: false,
  mapView: 'all',
  mapLayer: 'standard',
  notifications: true,
  locationAccess: true,
}

export function getAppSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...DEFAULT_APP_SETTINGS, ...stored }
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export function saveAppSettings(updates) {
  const next = { ...getAppSettings(), ...updates }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('sijaka:app-settings', { detail: next }))
  return next
}

export function applyAppSettings(settings = getAppSettings()) {
  const root = document.documentElement
  root.dataset.textScale = settings.textScale
  root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
  root.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false'
  root.dataset.dataSaver = settings.dataSaver ? 'true' : 'false'
  root.dataset.theme = settings.darkMode ? 'dark' : 'light'
}
