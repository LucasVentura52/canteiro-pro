import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi
    }
  },
  theme: {
    defaultTheme: 'obra',
    themes: {
      obra: {
        dark: false,
        colors: {
          primary: '#ff6f00',
          secondary: '#12344d',
          accent: '#2e7d32',
          info: '#0288d1',
          warning: '#f57c00',
          success: '#2e7d32',
          error: '#c62828',
          surface: '#ffffff',
          background: '#f5f7fa'
        }
      }
    }
  },
  defaults: {
    VCard: {
      rounded: 'xl',
      elevation: 2
    },
    VBtn: {
      rounded: 'lg',
      size: 'large'
    },
    VTextField: {
      variant: 'outlined',
      density: 'compact'
    },
    VSelect: {
      variant: 'outlined',
      density: 'compact'
    },
    VTextarea: {
      variant: 'outlined',
      density: 'compact'
    }
  }
});

export default vuetify;
