import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  DataZoomComponent,
])
