import type { KpiV2PtmSubscriberRow } from '../types/kpi'

export function ptmChangeRate(row: KpiV2PtmSubscriberRow): number | null {
  return row.previousCount != null && row.previousCount > 0 && row.change != null
    ? row.change / row.previousCount * 100 : null
}

export function summarizePtmSubscribers(rows: KpiV2PtmSubscriberRow[]) {
  const sum = (key: 'monthlyCount' | 'previousCount' | 'change') => rows.length && rows.every(row => row[key] != null)
    ? rows.reduce((total, row) => total + row[key]!, 0) : null
  const comparable = rows.filter(row => row.change != null)
  const increased = comparable.filter(row => row.change! > 0)
  const decreased = comparable.filter(row => row.change! < 0)
  const total = sum('monthlyCount')
  const previous = sum('previousCount')
  const change = sum('change')
  return {
    total, previous, change,
    rate: previous != null && previous > 0 && change != null ? change / previous * 100 : null,
    increased: increased.length, decreased: decreased.length,
    unchanged: comparable.filter(row => row.change === 0).length,
    missing: rows.length - comparable.length,
    top: [...increased].sort((a, b) => b.change! - a.change!)[0],
    bottom: decreased.filter(row => ptmChangeRate(row) != null)
      .sort((a, b) => ptmChangeRate(a)! - ptmChangeRate(b)!)[0],
  }
}
