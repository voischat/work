import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import './style.css'
import router from './router'
import App from './App.vue'
import '@vois/weila-sdk-ui/index.css'
import 'floating-vue/dist/style.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(PiniaColada)
app.use(router)
app.mount('#app')
