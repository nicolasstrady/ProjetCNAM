<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
useHead({
  htmlAttrs: {
    lang: 'fr'
  },
  title: 'Jeu de Tarot',
  meta: [
    { name: 'description', content: 'Jeu de Tarot multijoueur en ligne' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#072b16' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Tarot' }
  ],
  link: [
    { rel: 'manifest', href: '/site.webmanifest' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
  ]
})
</script>

<style>
html,
body,
#__nuxt {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  min-height: 100dvh;
  overscroll-behavior: none;
}
</style>
