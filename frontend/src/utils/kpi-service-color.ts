const serviceColors = {
  FIBER: '#e99a28',
  MYTV: '#e05b65',
  MESH: '#8b61cf',
  CAMERA: '#0789c7',
  DITT: '#16a6a0',
  CNTT: '#7da934',
  TSL: '#b768a3',
} as const

export function kpiServiceColor(code: string, title = ''): string {
  const key = code.toUpperCase()
  const text = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'D').toUpperCase()
  const matches = (pattern: string) => new RegExp(`(?:^|[._])(?:${pattern})(?=$|[._])`).test(key)
  if (matches('FIBER|FTTX|BRCD') || /\b(FIBER|FTTX|BRCD)\b/.test(text)) return serviceColors.FIBER
  if (matches('MYTV|MYTVFIX') || /\bMYTV(?:FIX)?\b/.test(text)) return serviceColors.MYTV
  if (matches('MESH') || /\bMESH\b/.test(text)) return serviceColors.MESH
  if (matches('CAM|CAMERA') || /\b(CAM|CAMERA)\b/.test(text)) return serviceColors.CAMERA
  if (matches('DITT') || /\bINTERNET TRUC TIEP\b/.test(text)) return serviceColors.DITT
  if (matches('CNTT') || /^F4\.1(?:_|$)/.test(key) || /\bCNTT\b/.test(text)) return serviceColors.CNTT
  if (matches('TSL') || /^F4\.3(?:_|$)/.test(key) || /\bTSL\b/.test(text)) return serviceColors.TSL
  // Keep new services stable when tabs or the returned KPI order change.
  const identity = key.replace(/^(?:DTPTM|SLPTM)_/, '').replace(/_C3(?:_DT)?$/, '')
  let hash = 0
  for (const character of identity) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return `hsl(${hash % 360}, 55%, 47%)`
}
