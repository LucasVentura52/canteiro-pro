<template>
  <div class="mobile-shell" :class="{ 'desktop-shell': isDesktop }">
    <aside v-if="isDesktop" class="desktop-sidebar section-card">
      <div class="desktop-sidebar-head">
        <p class="hero-label">Canteiro Pro</p>
        <p class="desktop-sidebar-title">Gestão de Obras</p>
        <p class="desktop-sidebar-subtitle">{{ subtitle }}</p>
      </div>

      <v-list class="desktop-nav" density="comfortable" nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.value"
          :prepend-icon="item.icon"
          :title="item.label"
          :active="activeNav === item.value"
          rounded="xl"
          @click="navigate(item.value)"
        />
      </v-list>

      <div class="desktop-sidebar-foot">
        <v-chip
          size="small"
          :color="isOnline ? 'success' : 'error'"
          variant="tonal"
          class="network-chip"
        >
          {{ isOnline ? 'Online' : 'Offline' }}
        </v-chip>

        <v-btn
          block
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-logout"
          :loading="logoutLoading"
          @click="logout"
        >
          Encerrar sessão
        </v-btn>
      </div>
    </aside>

    <div class="shell-content">
      <div class="hero-band" :class="{ 'hero-band-desktop': isDesktop }">
        <div class="content-width">
          <div class="hero-topline">
            <div>
              <p class="hero-label">Canteiro Pro</p>
              <h1>{{ title }}</h1>
              <p class="hero-subtitle">{{ subtitle }}</p>
            </div>

            <div class="hero-actions">
              <v-chip
                size="small"
                :color="isOnline ? 'success' : 'error'"
                variant="flat"
                class="network-chip"
              >
                {{ isOnline ? 'Online' : 'Offline' }}
              </v-chip>

              <v-btn
                v-if="!isDesktop"
                icon
                variant="tonal"
                color="white"
                size="small"
                :loading="logoutLoading"
                @click="logout"
              >
                <v-icon icon="mdi-logout" />
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <v-main class="layout-main" :class="{ 'layout-main-desktop': isDesktop }">
        <v-container :fluid="isDesktop" class="px-4 page-content" :class="{ 'page-content-desktop': isDesktop }">
          <div class="content-width">
            <slot />
          </div>
        </v-container>
      </v-main>

      <v-bottom-navigation
        v-if="!isDesktop"
        class="shell-nav"
        density="comfortable"
        grow
        :model-value="activeNav"
        @update:modelValue="navigate"
      >
        <v-btn
          v-for="item in navItems"
          :key="item.value"
          :value="item.value"
          stacked
        >
          <v-icon :icon="item.icon" />
          <span class="nav-label">{{ item.shortLabel }}</span>
        </v-btn>
      </v-bottom-navigation>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { getUser } from '@/services/session';
import { apiClient } from '@/services/apiClient';

defineProps({
  title: {
    type: String,
    default: 'Orçamentos'
  }
});

const router = useRouter();
const route = useRoute();
const { mdAndUp } = useDisplay();
const user = getUser();
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
const logoutLoading = ref(false);
const isDesktop = computed(() => mdAndUp.value);

const navItems = [
  { value: 'Home', label: 'Início', shortLabel: 'Início', icon: 'mdi-home-variant-outline' },
  { value: 'Clientes', label: 'Clientes', shortLabel: 'Clientes', icon: 'mdi-account-group-outline' },
  { value: 'Servicos', label: 'Serviços', shortLabel: 'Serviços', icon: 'mdi-tools' },
  { value: 'Orcamentos', label: 'Orçamentos', shortLabel: 'Orç.', icon: 'mdi-calculator-variant-outline' },
  { value: 'Relatorios', label: 'Relatórios', shortLabel: 'Relat.', icon: 'mdi-chart-box-outline' }
];

const activeNav = computed(() => {
  if (route.name === 'OrcamentoNovo') return 'Orcamentos';
  return route.name;
});

const subtitle = computed(() => {
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(new Date());

  const nome = user?.nome ? `Olá, ${String(user.nome).split(' ')[0]}` : 'Bem-vindo';
  return `${nome}  |  ${today}`;
});

function navigate(value) {
  if (!value || value === route.name) return;
  router.push({ name: value });
}

function updateConnectionStatus() {
  isOnline.value = navigator.onLine;
}

async function logout() {
  if (logoutLoading.value) return;

  logoutLoading.value = true;

  try {
    await apiClient.logout();
  } finally {
    logoutLoading.value = false;
    router.replace({ name: 'Login' });
  }
}

onMounted(() => {
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', updateConnectionStatus);
  window.removeEventListener('offline', updateConnectionStatus);
});
</script>
