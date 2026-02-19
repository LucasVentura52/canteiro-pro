<template>
  <v-app class="app-root">
    <router-view />
    <AppAlerts />
  </v-app>
</template>

<script setup>
import AppAlerts from '@/components/AppAlerts.vue';
</script>
