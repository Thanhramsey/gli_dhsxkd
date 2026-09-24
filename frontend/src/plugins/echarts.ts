import { use } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DataZoomComponent,
])
