const darkChartColors: Readonly<Record<string, string>> = {
  '#244252': '#e0ecf5',
  '#526a7b': '#bbccda',
  '#657b8b': '#b5c7d5',
  '#718397': '#acbfce',
  '#e8eef3': '#344756',
  '#0067b1': '#44b9f0',
  '#c62828': '#f16e6b',
  '#a66b00': '#e7b052',
  '#218349': '#58ca97',
}

function recolor(value: unknown): unknown {
  if (typeof value === 'string') return darkChartColors[value.toLowerCase()] ?? value
  if (Array.isArray(value)) return value.map(recolor)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, recolor(entry)]))
  }
  return value
}

export function adaptChartOptionForTheme<T>(option: T, dark: boolean): T {
  if (!dark) return option
  const themed = recolor(option) as T & { tooltip?: Record<string, unknown> }
  themed.tooltip = {
    ...themed.tooltip,
    backgroundColor: '#233443',
    borderColor: '#456073',
    textStyle: { color: '#e4eef5' },
  }
  return themed
}
