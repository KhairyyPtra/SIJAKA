export function getAccountInitials(name, email, fallback = 'G') {
  const value = String(name || '').trim()
  if (value) {
    const initials = value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
    if (initials) return initials
  }

  const emailInitial = String(email || '').trim().charAt(0).toUpperCase()
  return emailInitial || fallback
}