import { createApp } from 'vue';
import App from './App.vue';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, fa } from 'vuetify/iconsets/fa';
import '@fortawesome/fontawesome-free/css/all.css';

const vuetify = createVuetify({
  icons: {
    defaultSet: 'fa',
    aliases,
    sets: { fa }
  }
});

createApp(App).use(vuetify).mount('#app');
