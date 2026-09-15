import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey

const REMEMBER_KEY = 'sijaka-remember-me'
const memoryStorage = new Map()

const readStorage = (storageName, key) => {
  try {
    return window[storageName].getItem(key)
  } catch {
    return memoryStorage.get(`${storageName}:${key}`) ?? null
  }
}

const writeStorage = (storageName, key, value) => {
  try {
    window[storageName].setItem(key, value)
  } catch {
    memoryStorage.set(`${storageName}:${key}`, value)
  }
}

const removeStorage = (storageName, key) => {
  try {
    window[storageName].removeItem(key)
  } catch {
    memoryStorage.delete(`${storageName}:${key}`)
  }
}

const dualStorage = {
  getItem: (key) => {
    const remember = readStorage('localStorage', REMEMBER_KEY) !== 'false'
    return remember ? readStorage('localStorage', key) : readStorage('sessionStorage', key)
  },
  setItem: (key, value) => {
    const remember = readStorage('localStorage', REMEMBER_KEY) !== 'false'
    if (remember) {
      removeStorage('sessionStorage', key)
      writeStorage('localStorage', key, value)
    } else {
      removeStorage('localStorage', key)
      writeStorage('sessionStorage', key, value)
    }
  },
  removeItem: (key) => {
    removeStorage('localStorage', key)
    removeStorage('sessionStorage', key)
  },
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-supabase-config.invalid',
  supabaseAnonKey || 'missing-supabase-anon-key',
  {
    auth: {
      storage: dualStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

export const setRememberMe = (remember) => {
  writeStorage('localStorage', REMEMBER_KEY, remember ? 'true' : 'false')
}
