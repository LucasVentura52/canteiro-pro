<template>
  <MainLayout title="Painel da Obra">
    <div class="page-stack">
      <v-row>
        <v-col cols="12" sm="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Faturamento do mês</p>
            <p class="metric-value">{{ formatCurrency(report.resumo.faturamento_total) }}</p>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Orçamentos no mês</p>
            <p class="metric-value">{{ report.resumo.total_orcamentos }}</p>
          </v-card>
        </v-col>

        <v-col cols="12">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Ticket médio</p>
            <p class="metric-value">{{ formatCurrency(report.resumo.ticket_medio) }}</p>
            <p class="metric-foot">
              Aprovados: {{ report.resumo.total_aprovados }} | Rascunho: {{ report.resumo.total_rascunho }}
            </p>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Total recebido</p>
            <p class="metric-value">{{ formatCurrency(report.resumo.total_recebido) }}</p>
          </v-card>
        </v-col>

        <v-col cols="12" sm="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Saldo a receber</p>
            <p class="metric-value">{{ formatCurrency(report.resumo.total_a_receber) }}</p>
          </v-card>
        </v-col>
      </v-row>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Atalhos rápidos</p>
            <p class="section-subtitle">Fluxo principal para usar no canteiro</p>
          </div>
        </div>

        <v-row>
          <v-col cols="12" sm="6">
            <v-btn block color="primary" prepend-icon="mdi-plus-circle-outline" @click="$router.push({ name: 'OrcamentoNovo' })">
              Novo orçamento
            </v-btn>
          </v-col>

          <v-col cols="12" sm="6">
            <v-btn block color="secondary" prepend-icon="mdi-history" @click="$router.push({ name: 'Orcamentos' })">
              Ver histórico
            </v-btn>
          </v-col>
        </v-row>
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Serviços com maior retorno</p>
            <p class="section-subtitle">Top 3 no mês atual</p>
          </div>
        </div>

        <v-list v-if="topServices.length" lines="two">
          <v-list-item
            v-for="item in topServices"
            :key="item.servico_id"
            class="list-row"
          >
            <v-list-item-title>{{ item.servico_nome }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ Number(item.quantidade_total).toFixed(2) }} un. | {{ formatCurrency(item.valor_total) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-card v-else class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-chart-box-outline" size="26" color="secondary" />
          <p>Ainda não há dados suficientes para ranking.</p>
        </v-card>
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Clientes em destaque</p>
            <p class="section-subtitle">Top 3 por faturamento no mês</p>
          </div>
        </div>

        <v-list v-if="topClientes.length" lines="two">
          <v-list-item
            v-for="item in topClientes"
            :key="item.cliente_id || item.cliente_nome"
            class="list-row"
          >
            <v-list-item-title>{{ item.cliente_nome }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ item.total_orcamentos }} orçamento(s) | {{ formatCurrency(item.valor_total) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-card v-else class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-account-group-outline" size="26" color="secondary" />
          <p>Sem dados de clientes para este período.</p>
        </v-card>
      </v-card>
    </div>
  </MainLayout>
</template>

<script setup>
import { computed, onActivated, onMounted, reactive, ref } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { useFeedbackToasts } from '@/composables/useFeedbackToasts';
import { formatCurrency } from '@/utils/formatters';
import { getFriendlyError } from '@/utils/errorMessages';

const error = ref('');
const warning = ref('');
useFeedbackToasts({ error, warning });
const hasLoaded = ref(false);
const report = reactive({
  resumo: {
    faturamento_total: 0,
    total_orcamentos: 0,
    total_aprovados: 0,
    total_rascunho: 0,
    ticket_medio: 0,
    total_recebido: 0,
    total_a_receber: 0
  },
  por_servico: [],
  por_cliente: []
});

const topServices = computed(() => (report.por_servico || []).slice(0, 3));
const topClientes = computed(() => (report.por_cliente || []).slice(0, 3));

async function loadReport() {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  error.value = '';

  try {
    const data = await apiClient.relatorioMensal(ano, mes);
    warning.value = data?.meta?.stale
      ? 'Sem conexão estável. Exibindo os últimos dados salvos neste dispositivo.'
      : '';
    Object.assign(report, data.data || {});
    hasLoaded.value = true;
  } catch (err) {
    warning.value = '';
    error.value = getFriendlyError(err, 'Não foi possível carregar os indicadores.');
  }
}

onMounted(loadReport);

onActivated(() => {
  if (hasLoaded.value) {
    loadReport();
  }
});
</script>
