<template>
  <v-app>
    <v-app-bar flat color="surface" border="b">
      <v-app-bar-title><span class="brand-mark">DHSXKD</span></v-app-bar-title>
      <span class="app-context">Trung tâm điều hành</span>
    </v-app-bar>
    <v-main><router-view /></v-main>
  </v-app>
</template>

<style scoped>
.brand-mark { color: #12615b; font-family: Georgia, 'Times New Roman', serif; font-size: 21px; font-weight: 700; }
.app-context { margin-right: 24px; color: #65716e; font-size: 13px; }
</style>
