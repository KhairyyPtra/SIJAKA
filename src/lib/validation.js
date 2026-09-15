const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function validateEmail(value) {
  const email = normalizeEmail(value)
  return email && EMAIL_PATTERN.test(email) ? '' : 'Masukkan alamat email yang valid.'
}

export function validatePassword(value, label = 'Password') {
  if (String(value || '').length < 6) return `${label} minimal 6 karakter.`
  return ''
}

export function validateRequiredText(value, label) {
  return String(value || '').trim() ? '' : `${label} wajib diisi.`
}

export function isValidCoordinate(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180
}
