import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/500.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/700.css'
import './style.css'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import { router } from './router'

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
