import { use } from 'echarts/core'
import { BarChart, LineChart, MapChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  GeoComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LabelLayout } from 'echarts/features'

use([
  CanvasRenderer,
  LabelLayout,
  BarChart,
  LineChart,
  PieChart,
  MapChart,
  ScatterChart,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  DataZoomComponent,
])
