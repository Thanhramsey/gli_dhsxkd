export const chartMetricColors = [
  '#078bc8',
  '#169b72',
  '#f2b134',
  '#df4d4d',
  '#7568c5',
  '#00a8b5',
  '#ef7d32',
] as const

export function chartMetricColor(index: number): string {
  return chartMetricColors[index % chartMetricColors.length]!
}
