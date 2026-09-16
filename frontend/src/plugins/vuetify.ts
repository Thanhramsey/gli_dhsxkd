import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'dashboardTheme',
    themes: {
      dashboardTheme: {
        dark: false,
        colors: {
          background: '#f3f5f4',
          surface: '#ffffff',
          primary: '#12615b',
          secondary: '#d7a735',
          error: '#b42318',
          success: '#16794b',
          info: '#286a9d',
        },
      },
    },
  },
})