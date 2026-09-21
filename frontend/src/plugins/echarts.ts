import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([
  CanvasRenderer,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
])
