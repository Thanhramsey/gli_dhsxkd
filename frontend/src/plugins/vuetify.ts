import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dashboardTheme',
    themes: {
      dashboardTheme: {
        dark: false,
        colors: {
          background: '#f4f7fb',
          surface: '#ffffff',
          primary: '#0068b5',
          secondary: '#00aeef',
          error: '#b42318',
          success: '#16794b',
          info: '#0078bd',
        },
      },
      dashboardDark: {
        dark: true,
        colors: {
          background: '#111923',
          surface: '#1b2734',
          primary: '#28a9e2',
          secondary: '#5bc9f2',
          error: '#ef6a67',
          success: '#42b883',
          info: '#41b6e6',
        },
      },
    },
  },
})
