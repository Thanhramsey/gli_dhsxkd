export type TerritoryMapArea = {
  id: string
  featureName: string
  label: string
  labelPoint?: [number, number]
  color: string
  tooltipTitle: string
  tooltipLines: { label: string; value: string }[]
}
