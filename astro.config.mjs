import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rosettaquantum.com',
  output: 'static',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [sitemap({ i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } } })],
});
