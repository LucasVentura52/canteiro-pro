<template>
  <div class="app-alert-stack" aria-live="polite" aria-atomic="false">
    <transition-group name="app-alert" tag="div" class="app-alert-list">
      <section v-for="alert in alerts" :key="alert.id" class="app-alert" :class="[`app-alert--${alert.type}`]"
        role="alert">
        <div class="app-alert-icon" :class="[`app-alert-icon--${alert.type}`]">
          <v-icon :icon="iconFor(alert.type)" size="22" />
        </div>

        <div class="app-alert-content">
          <p class="app-alert-title">{{ alert.title || titleFor(alert.type) }}</p>
          <p class="app-alert-message">{{ alert.message }}</p>
        </div>

        <v-btn icon="mdi-close" size="small" density="compact" variant="text" color="secondary" class="app-alert-close"
          @click="dismissAlert(alert.id)" />
      </section>
    </transition-group>
  </div>
</template>

<script setup>
import { dismissAlert, useAppAlertsStore } from '@/services/appAlerts';

const { alerts } = useAppAlertsStore();

function iconFor(type) {
  if (type === 'success') return 'mdi-check-circle-outline';
  if (type === 'error') return 'mdi-alert-circle-outline';
  return 'mdi-alert-outline';
}

function titleFor(type) {
  if (type === 'success') return 'Sucesso';
  if (type === 'error') return 'Erro';
  return 'Atenção';
}
</script>