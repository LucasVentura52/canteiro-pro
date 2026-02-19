<template>
  <MainLayout title="Relatórios">
    <div class="page-stack">
      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Relatório mensal</p>
            <p class="section-subtitle">Acompanhe desempenho por período</p>
          </div>
        </div>

        <v-row>
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="month"
              type="month"
              label="Mês de referência"
              prepend-inner-icon="mdi-calendar-month-outline"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-btn block color="primary" :loading="loading" prepend-icon="mdi-refresh" @click="loadReport({ force: true })">
              Atualizar
            </v-btn>
          </v-col>
        </v-row>
      </v-card>

      <v-alert v-if="error" class="soft-alert alert-error" type="error" variant="tonal">{{ error }}</v-alert>
      <v-alert v-if="warning" class="soft-alert alert-warning" type="warning" variant="tonal">{{ warning }}</v-alert>

      <v-progress-linear
        v-if="loading"
        color="primary"
        indeterminate
        rounded
      />

      <v-row>
        <v-col cols="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Faturamento</p>
            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(report.resumo.faturamento_total) }}</p>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Ticket médio</p>
            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(report.resumo.ticket_medio) }}</p>
          </v-card>
        </v-col>

        <v-col cols="4">
          <v-card class="pa-3 text-center metric-card section-card">
            <p class="metric-label">Total</p>
            <p class="text-subtitle-1 font-weight-bold">{{ report.resumo.total_orcamentos }}</p>
          </v-card>
        </v-col>

        <v-col cols="4">
          <v-card class="pa-3 text-center metric-card section-card">
            <p class="metric-label">Aprovados</p>
            <p class="text-subtitle-1 font-weight-bold">{{ report.resumo.total_aprovados }}</p>
          </v-card>
        </v-col>

        <v-col cols="4">
          <v-card class="pa-3 text-center metric-card section-card">
            <p class="metric-label">Recusados</p>
            <p class="text-subtitle-1 font-weight-bold">{{ report.resumo.total_recusados }}</p>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Total recebido</p>
            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(report.resumo.total_recebido) }}</p>
          </v-card>
        </v-col>

        <v-col cols="6">
          <v-card class="pa-4 metric-card section-card">
            <p class="metric-label">Saldo a receber</p>
            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(report.resumo.total_a_receber) }}</p>
          </v-card>
        </v-col>
      </v-row>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Faturamento por serviço</p>
            <p class="section-subtitle">Itens com maior impacto financeiro</p>
          </div>
        </div>

        <v-table v-if="report.por_servico.length" density="comfortable">
          <thead>
            <tr>
              <th>Serviço</th>
              <th class="text-right">Quantidade</th>
              <th class="text-right">Valor</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="item in report.por_servico" :key="item.servico_id">
              <td>{{ item.servico_nome }}</td>
              <td class="text-right">{{ Number(item.quantidade_total).toFixed(2) }}</td>
              <td class="text-right">{{ formatCurrency(item.valor_total) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-card v-else class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-chart-bar" size="26" color="secondary" />
          <p>Sem dados no período selecionado.</p>
        </v-card>
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Faturamento por cliente</p>
            <p class="section-subtitle">Clientes com maior volume no período</p>
          </div>
        </div>

        <v-table v-if="report.por_cliente.length" density="comfortable">
          <thead>
            <tr>
              <th>Cliente</th>
              <th class="text-right">Orçamentos</th>
              <th class="text-right">Recebido</th>
              <th class="text-right">Ticket médio</th>
              <th class="text-right">Valor total</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="item in report.por_cliente" :key="item.cliente_id || item.cliente_nome">
              <td>{{ item.cliente_nome }}</td>
              <td class="text-right">{{ item.total_orcamentos }}</td>
              <td class="text-right">{{ formatCurrency(item.valor_recebido) }}</td>
              <td class="text-right">{{ formatCurrency(item.ticket_medio) }}</td>
              <td class="text-right">{{ formatCurrency(item.valor_total) }}</td>
            </tr>
          </tbody>
        </v-table>

        <v-card v-else class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-account-group-outline" size="26" color="secondary" />
          <p>Sem dados de clientes no período selecionado.</p>
        </v-card>
      </v-card>
    </div>
  </MainLayout>
</template>

<script setup>
import { onActivated, onMounted, reactive, ref } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { formatCurrency, getCurrentMonth } from '@/utils/formatters';
import { getFriendlyError } from '@/utils/errorMessages';

const month = ref(getCurrentMonth());
const loading = ref(false);
const error = ref('');
const warning = ref('');
const hasLoaded = ref(false);

const report = reactive({
  resumo: {
    faturamento_total: 0,
    ticket_medio: 0,
    total_orcamentos: 0,
    total_aprovados: 0,
    total_recusados: 0,
    total_recebido: 0,
    total_a_receber: 0
  },
  por_servico: [],
  por_cliente: []
});

async function loadReport(options = {}) {
  loading.value = true;
  error.value = '';
  warning.value = '';

  try {
    const [ano, mes] = month.value.split('-');
    const response = await apiClient.relatorioMensal(ano, mes, options);
    warning.value = response?.meta?.stale
      ? 'Sem conexão estável. Exibindo o último relatório salvo no dispositivo.'
      : '';
    Object.assign(report, response.data || {});
    hasLoaded.value = true;
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao gerar relatório.');
  } finally {
    loading.value = false;
  }
}

onMounted(loadReport);

onActivated(() => {
  if (hasLoaded.value) {
    loadReport();
  }
});
</script>
