export const DAMAGE_TYPES = {
  lubang: {
    label: 'Jalan Berlubang',
    icon: '/icons/lubang.svg?v=sijaka5',
    color: '#ef4444',
  },
  retak: {
    label: 'Retak',
    icon: '/icons/retak.svg?v=sijaka5',
    color: '#eab308',
  },
  banjir: {
    label: 'Banjir',
    icon: '/icons/banjir.svg?v=sijaka5',
    color: '#3b82f6',
  },
  amblas: { label: 'Jalan Amblas', icon: '/icons/amblas.svg?v=sijaka5', color: '#dc2626' },
  drainase: { label: 'Drainase Rusak', icon: '/icons/drainase.svg?v=sijaka5', color: '#2563eb' },
  marka: { label: 'Marka Jalan Pudar', icon: '/icons/marka.svg?v=sijaka5', color: '#eab308' },
}

export function damageLabel(type) {
  return DAMAGE_TYPES[type]?.label || type
}

export function damageIcon(type) {
  return DAMAGE_TYPES[type]?.icon || '/icons/lubang.svg?v=sijaka5'
}
