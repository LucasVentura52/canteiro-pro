<template>
  <MainLayout title="Histórico">
    <div class="page-stack">
      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Filtros</p>
            <p class="section-subtitle">Busque por mês e status</p>
          </div>
        </div>

        <v-row>
          <v-col cols="12" sm="4">
            <v-text-field v-model="filters.mes" type="month" label="Mês" prepend-inner-icon="mdi-calendar-month-outline" />
          </v-col>

          <v-col cols="12" sm="4">
            <v-select v-model="filters.status" label="Status" :items="statusFilterOptions" prepend-inner-icon="mdi-filter-outline" />
          </v-col>

          <v-col cols="12" sm="4">
            <v-btn block color="primary" prepend-icon="mdi-magnify" @click="loadOrcamentos({ force: true })">Filtrar</v-btn>
          </v-col>
        </v-row>

        <v-btn
          block
          variant="tonal"
          color="secondary"
          class="mt-2"
          prepend-icon="mdi-plus-circle-outline"
          @click="$router.push({ name: 'OrcamentoNovo' })"
        >
          Criar novo orçamento
        </v-btn>
      </v-card>

      <v-progress-linear
        v-if="loading"
        color="primary"
        indeterminate
        rounded
      />

      <template v-if="orcamentos.length">
        <v-card
          v-for="orcamento in orcamentos"
          :key="orcamento.id"
          class="pa-4 section-card"
        >
          <div class="d-flex justify-space-between align-start mb-2">
            <div>
              <p class="section-title">{{ clienteName(orcamento.cliente_id) }}</p>
              <p class="section-subtitle mb-1">
                {{ formatDate(orcamento.data) }}
              </p>
              <v-chip
                size="small"
                :color="statusColor(orcamento.status)"
                class="status-chip"
                variant="tonal"
              >
                {{ statusText(orcamento.status) }}
              </v-chip>

              <v-chip
                size="small"
                :color="statusPagamentoColor(orcamento.pagamento_status)"
                class="status-chip ml-2"
                variant="tonal"
              >
                {{ statusPagamentoText(orcamento.pagamento_status) }}
              </v-chip>

              <p class="section-subtitle mt-1">
                Recebido: {{ formatCurrency(orcamento.total_recebido) }} | Saldo: {{ formatCurrency(orcamento.saldo) }}
              </p>
            </div>

            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(orcamento.total) }}</p>
          </div>

          <v-row class="mt-1">
            <v-col cols="12" sm="8">
              <v-select
                v-model="statusDraft[orcamento.id]"
                :items="statusOptions"
                label="Atualizar status"
                prepend-inner-icon="mdi-refresh"
                hide-details
              />
            </v-col>

            <v-col cols="12" sm="4" class="d-flex align-end">
              <v-btn
                block
                color="secondary"
                :loading="updatingId === orcamento.id"
                prepend-icon="mdi-content-save-outline"
                @click="updateStatus(orcamento)"
              >
                Salvar
              </v-btn>
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-btn
              size="small"
              variant="tonal"
              color="secondary"
              prepend-icon="mdi-file-document-outline"
              :loading="detailLoadingId === orcamento.id"
              @click="openDetalhes(orcamento)"
            >
              Detalhes
            </v-btn>

            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-content-copy"
              :loading="duplicateLoadingId === orcamento.id"
              @click="duplicarOrcamento(orcamento)"
            >
              Duplicar
            </v-btn>

            <v-btn
              size="small"
              variant="tonal"
              color="success"
              prepend-icon="mdi-whatsapp"
              :loading="shareLoadingId === orcamento.id"
              @click="compartilharWhatsapp(orcamento)"
            >
              WhatsApp
            </v-btn>
          </div>
        </v-card>
      </template>

        <v-card v-else-if="!loading" class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-history" size="26" color="secondary" />
          <p>Nenhum orçamento encontrado para os filtros selecionados.</p>
        </v-card>

      <v-dialog
        v-model="detailDialog"
        max-width="840"
        scrollable
        class="orcamento-detail-dialog"
      >
        <v-card v-if="detailData" class="section-card orcamento-detail-card">
          <v-card-text class="pa-4 orcamento-detail-content">
          <div class="section-head">
            <div>
              <p class="section-title">{{ detailData?.cliente?.nome || clienteName(detailData.cliente_id) }}</p>
              <p class="section-subtitle">{{ formatDate(detailData.data) }} | {{ statusText(detailData.status) }}</p>
            </div>

            <p class="text-h6 font-weight-bold">{{ formatCurrency(detailData.total) }}</p>
          </div>

          <div v-if="detailData.observacao" class="inline-feedback inline-feedback--info mb-3">
            <p>{{ detailData.observacao }}</p>
          </div>

          <v-row class="mb-2">
            <v-col cols="12" sm="4">
              <v-card class="pa-3 metric-card section-card">
                <p class="metric-label">Total do orçamento</p>
                <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(detailData.financeiro?.total_orcamento ?? detailData.total) }}</p>
              </v-card>
            </v-col>

            <v-col cols="12" sm="4">
              <v-card class="pa-3 metric-card section-card">
                <p class="metric-label">Total recebido</p>
                <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(detailData.financeiro?.total_recebido) }}</p>
              </v-card>
            </v-col>

            <v-col cols="12" sm="4">
              <v-card class="pa-3 metric-card section-card">
                <p class="metric-label">Saldo</p>
                <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(detailData.financeiro?.saldo) }}</p>
                <v-chip
                  class="mt-1"
                  size="x-small"
                  variant="tonal"
                  :color="statusPagamentoColor(detailData.financeiro?.pagamento_status)"
                >
                  {{ statusPagamentoText(detailData.financeiro?.pagamento_status) }}
                </v-chip>
              </v-card>
            </v-col>
          </v-row>

          <v-table v-if="detailData.itens?.length" density="compact">
            <thead>
              <tr>
                <th>Serviço</th>
                <th class="text-right">Qtd.</th>
                <th class="text-right">Unit.</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in detailData.itens" :key="item.id">
                <td>{{ item.servico_nome }}</td>
                <td class="text-right">{{ Number(item.qtd || 0).toFixed(2) }}</td>
                <td class="text-right">{{ formatCurrency(item.valor_unit) }}</td>
                <td class="text-right">{{ formatCurrency(item.subtotal) }}</td>
              </tr>
            </tbody>
          </v-table>

          <v-card v-else class="pa-4 empty-card mt-2" variant="flat">
            <v-icon icon="mdi-text-box-search-outline" size="24" color="secondary" />
            <p>Este orçamento não possui itens vinculados.</p>
          </v-card>

          <v-card class="pa-4 section-card mt-3">
            <div class="section-head">
              <div>
                <p class="section-title">Registrar recebimento</p>
                <p class="section-subtitle">Controle financeiro do orçamento</p>
              </div>
            </div>

            <v-row>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="recebimentoForm.data"
                  type="date"
                  label="Data"
                  prepend-inner-icon="mdi-calendar"
                />
              </v-col>

              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="recebimentoForm.valor"
                  label="Valor recebido"
                  prefix="R$"
                  inputmode="numeric"
                  prepend-inner-icon="mdi-cash"
                  @update:modelValue="onRecebimentoValorInput"
                />
              </v-col>

              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="recebimentoForm.metodo"
                  label="Método"
                  prepend-inner-icon="mdi-credit-card-outline"
                  placeholder="PIX, dinheiro, cartão..."
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="recebimentoForm.observacao"
              rows="2"
              label="Observação do recebimento"
              prepend-inner-icon="mdi-note-text-outline"
            />

            <div class="d-flex justify-end mt-2">
              <v-btn
                color="primary"
                prepend-icon="mdi-cash-plus"
                :loading="recebimentoSaving"
                @click="salvarRecebimento"
              >
                Registrar recebimento
              </v-btn>
            </div>
          </v-card>

          <v-card class="pa-4 section-card mt-3">
            <div class="section-head">
              <div>
                <p class="section-title">Histórico de recebimentos</p>
                <p class="section-subtitle">{{ detailData.recebimentos?.length || 0 }} lançamento(s)</p>
              </div>
            </div>

            <v-list v-if="detailData.recebimentos?.length" class="recebimentos-list">
              <v-list-item
                v-for="recebimento in detailData.recebimentos"
                :key="recebimento.id"
                class="list-row"
              >
                <v-list-item-title class="d-flex align-center ga-2">
                  <span>{{ formatCurrency(recebimento.valor) }}</span>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    :color="isRecebimentoAtivo(recebimento) ? 'success' : 'error'"
                  >
                    {{ isRecebimentoAtivo(recebimento) ? 'Ativo' : 'Inativo' }}
                  </v-chip>
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(recebimento.data) }} | {{ recebimento.metodo || 'Método não informado' }}
                </v-list-item-subtitle>
                <v-list-item-subtitle>
                  {{ recebimento.observacao || 'Sem observações.' }}
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    :icon="isRecebimentoAtivo(recebimento) ? 'mdi-delete-outline' : 'mdi-restore'"
                    variant="text"
                    :color="isRecebimentoAtivo(recebimento) ? 'error' : 'success'"
                    size="small"
                    :loading="recebimentoTogglingId === recebimento.id"
                    @click="toggleRecebimento(recebimento)"
                  />
                </template>
              </v-list-item>
            </v-list>

            <v-card v-else class="pa-4 empty-card" variant="flat">
              <v-icon icon="mdi-cash-clock" size="24" color="secondary" />
              <p>Nenhum recebimento registrado para este orçamento.</p>
            </v-card>
          </v-card>
          </v-card-text>

          <v-divider />

          <v-card-actions class="px-4 py-3 justify-end">
            <v-btn variant="tonal" color="secondary" @click="detailDialog = false">Fechar</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </MainLayout>
</template>

<script setup>
import { onActivated, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { useFeedbackToasts } from '@/composables/useFeedbackToasts';
import { formatCurrency, formatDate, getCurrentMonth, getTodayIso } from '@/utils/formatters';
import { getFriendlyError } from '@/utils/errorMessages';
import { buildOrcamentoWhatsappMessage } from '@/utils/orcamentoShare';
import { saveOrcamentoDraft } from '@/services/orcamentoDraft';
import { maskCurrencyInput, parseCurrencyInput } from '@/utils/inputMasks';

const router = useRouter();
const orcamentos = ref([]);
const clientes = ref([]);
const loading = ref(false);
const error = ref('');
const success = ref('');
const warning = ref('');
useFeedbackToasts({ error, success, warning });
const updatingId = ref('');
const hasLoaded = ref(false);
const detailDialog = ref(false);
const detailData = ref(null);
const detailLoadingId = ref('');
const duplicateLoadingId = ref('');
const shareLoadingId = ref('');
const recebimentoSaving = ref(false);
const recebimentoTogglingId = ref('');
const statusDraft = reactive({});
const recebimentoForm = reactive({
  data: getTodayIso(),
  valor: '',
  metodo: '',
  observacao: ''
});

const statusOptions = [
  { title: 'Rascunho', value: 'rascunho' },
  { title: 'Aprovado', value: 'aprovado' },
  { title: 'Recusado', value: 'recusado' }
];

const statusFilterOptions = [
  { title: 'Todos', value: 'todos' },
  ...statusOptions
];

const filters = reactive({
  mes: getCurrentMonth(),
  status: 'todos'
});

function resetFeedback() {
  error.value = '';
  success.value = '';
  warning.value = '';
}

function clienteName(clienteId) {
  const cliente = clientes.value.find((item) => item.id === clienteId);
  return cliente ? cliente.nome : 'Cliente removido';
}

function statusColor(status) {
  if (status === 'aprovado') return 'success';
  if (status === 'recusado') return 'error';
  return 'warning';
}

function statusText(status) {
  if (status === 'aprovado') return 'Aprovado';
  if (status === 'recusado') return 'Recusado';
  return 'Rascunho';
}

function statusPagamentoText(status) {
  if (status === 'pago') return 'Pago';
  if (status === 'parcial') return 'Parcial';
  if (status === 'excedente') return 'Excedente';
  return 'Pendente';
}

function statusPagamentoColor(status) {
  if (status === 'pago') return 'success';
  if (status === 'parcial') return 'warning';
  if (status === 'excedente') return 'info';
  return 'error';
}

function isRecebimentoAtivo(recebimento) {
  if (recebimento?.ativo === undefined || recebimento?.ativo === null || String(recebimento?.ativo).trim() === '') {
    return true;
  }

  return String(recebimento?.ativo).toLowerCase() === 'true' || String(recebimento?.ativo) === '1';
}

function onRecebimentoValorInput(value) {
  recebimentoForm.valor = maskCurrencyInput(value);
}

function resetRecebimentoForm() {
  recebimentoForm.data = getTodayIso();
  recebimentoForm.valor = '';
  recebimentoForm.metodo = '';
  recebimentoForm.observacao = '';
}

async function fetchDetalhe(orcamento) {
  const response = await apiClient.getOrcamentoDetalhe(orcamento.id, { force: true });
  return response.data || null;
}

async function loadOrcamentos(options = {}) {
  loading.value = true;
  error.value = '';
  warning.value = '';

  try {
    const [orcamentosRes, clientesRes] = await Promise.all([
      apiClient.listOrcamentos({
        mes: filters.mes,
        status: filters.status === 'todos' ? '' : filters.status
      }, options),
      apiClient.listClientes(options)
    ]);

    orcamentos.value = orcamentosRes.data || [];
    clientes.value = clientesRes.data || [];

    const isStale = Boolean(orcamentosRes?.meta?.stale || clientesRes?.meta?.stale);
    warning.value = isStale
      ? 'Sem conexão estável. Dados exibidos do último sincronismo.'
      : '';
    hasLoaded.value = true;

    orcamentos.value.forEach((orcamento) => {
      statusDraft[orcamento.id] = orcamento.status || 'rascunho';
    });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao carregar orçamentos.');
  } finally {
    loading.value = false;
  }
}

async function updateStatus(orcamento) {
  resetFeedback();

  const nextStatus = statusDraft[orcamento.id];

  if (!nextStatus || nextStatus === orcamento.status) {
    success.value = 'Nenhuma alteração de status para salvar.';
    return;
  }

  updatingId.value = orcamento.id;

  try {
    await apiClient.updateOrcamentoStatus(orcamento.id, nextStatus);
    orcamento.status = nextStatus;
    success.value = 'Status atualizado com sucesso.';
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar status.');
  } finally {
    updatingId.value = '';
  }
}

async function openDetalhes(orcamento) {
  resetFeedback();
  detailLoadingId.value = orcamento.id;

  try {
    detailData.value = await fetchDetalhe(orcamento);
    resetRecebimentoForm();
    detailDialog.value = true;
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao carregar detalhes do orçamento.');
  } finally {
    detailLoadingId.value = '';
  }
}

async function refreshDetalhe(orcamentoId) {
  if (!orcamentoId) return;

  const response = await apiClient.getOrcamentoDetalhe(orcamentoId, { force: true });
  detailData.value = response.data || null;
}

async function duplicarOrcamento(orcamento) {
  resetFeedback();
  duplicateLoadingId.value = orcamento.id;

  try {
    const detail = await fetchDetalhe(orcamento);
    if (!detail) {
      error.value = 'Não foi possível duplicar este orçamento.';
      return;
    }

    const draftItems = (detail.itens || []).map((item) => ({
      servico_id: item.servico_id,
      qtd_input: Number(item.qtd || 0).toFixed(2).replace('.', ','),
      valor_unit_input: String(Math.round(Number(item.valor_unit || 0) * 100))
    }));

    saveOrcamentoDraft({
      form: {
        cliente_id: detail.cliente_id,
        data: getTodayIso(),
        status: 'rascunho',
        observacao: detail.observacao || 'Valor válido por 15 dias. Materiais não inclusos.'
      },
      items: draftItems
    });

    success.value = 'Orçamento duplicado. Revise os dados antes de salvar.';
    router.push({ name: 'OrcamentoNovo' });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao duplicar orçamento.');
  } finally {
    duplicateLoadingId.value = '';
  }
}

async function compartilharWhatsapp(orcamento) {
  resetFeedback();
  shareLoadingId.value = orcamento.id;

  try {
    const detail = await fetchDetalhe(orcamento);
    if (!detail) {
      error.value = 'Não foi possível gerar a mensagem deste orçamento.';
      return;
    }

    const text = buildOrcamentoWhatsappMessage(detail);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    success.value = 'Mensagem pronta para envio no WhatsApp.';
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao compartilhar orçamento.');
  } finally {
    shareLoadingId.value = '';
  }
}

async function salvarRecebimento() {
  resetFeedback();

  if (!detailData.value?.id) {
    error.value = 'Selecione um orçamento válido.';
    return;
  }

  const valor = parseCurrencyInput(recebimentoForm.valor);
  if (valor <= 0) {
    error.value = 'Informe um valor de recebimento maior que zero.';
    return;
  }

  recebimentoSaving.value = true;

  try {
    await apiClient.createRecebimento({
      orcamento_id: detailData.value.id,
      data: recebimentoForm.data || getTodayIso(),
      valor,
      metodo: recebimentoForm.metodo.trim(),
      observacao: recebimentoForm.observacao.trim()
    });

    success.value = 'Recebimento registrado com sucesso.';
    resetRecebimentoForm();
    await Promise.all([
      refreshDetalhe(detailData.value.id),
      loadOrcamentos({ force: true })
    ]);
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao registrar recebimento.');
  } finally {
    recebimentoSaving.value = false;
  }
}

async function toggleRecebimento(recebimento) {
  if (!detailData.value?.id) return;

  resetFeedback();
  recebimentoTogglingId.value = recebimento.id;

  try {
    await apiClient.toggleRecebimento(recebimento.id, !isRecebimentoAtivo(recebimento));
    success.value = isRecebimentoAtivo(recebimento)
      ? 'Recebimento removido com segurança.'
      : 'Recebimento restaurado com sucesso.';
    await Promise.all([
      refreshDetalhe(detailData.value.id),
      loadOrcamentos({ force: true })
    ]);
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar recebimento.');
  } finally {
    recebimentoTogglingId.value = '';
  }
}

onMounted(loadOrcamentos);

onActivated(() => {
  if (hasLoaded.value) {
    loadOrcamentos();
  }
});
</script>
