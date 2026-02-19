<template>
  <MainLayout title="Novo Orçamento">
    <div class="page-stack">
      <v-progress-linear
        v-if="loading"
        color="primary"
        indeterminate
        rounded
      />

      <v-alert
        v-if="error"
        class="soft-alert alert-error"
        type="error"
        variant="tonal"
      >
        {{ error }}
      </v-alert>

      <v-alert
        v-if="success"
        class="soft-alert alert-success"
        type="success"
        variant="tonal"
      >
        {{ success }}
      </v-alert>

      <v-alert
        v-if="draftInfo"
        class="soft-alert"
        type="info"
        variant="tonal"
      >
        {{ draftInfo }}
        <div class="mt-2">
          <v-btn
            size="small"
            variant="outlined"
            color="secondary"
            prepend-icon="mdi-trash-can-outline"
            @click="discardDraft"
          >
            Limpar rascunho local
          </v-btn>
        </div>
      </v-alert>

      <v-alert
        v-if="warning"
        class="soft-alert alert-warning"
        type="warning"
        variant="tonal"
      >
        {{ warning }}
      </v-alert>

      <v-alert
        v-if="!hasClientes || !hasServicos"
        class="soft-alert alert-warning"
        type="warning"
        variant="tonal"
      >
        Para criar um orçamento, cadastre pelo menos 1 cliente e 1 serviço.
        <div class="mt-2 d-flex ga-2">
          <v-btn size="small" variant="outlined" color="secondary" @click="$router.push({ name: 'Clientes' })">
            Ir para Clientes
          </v-btn>
          <v-btn size="small" variant="outlined" color="secondary" @click="$router.push({ name: 'Servicos' })">
            Ir para Serviços
          </v-btn>
        </div>
      </v-alert>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Dados do orçamento</p>
            <p class="section-subtitle">Preencha os campos principais da proposta</p>
          </div>
        </div>

        <v-select
          v-model="form.cliente_id"
          :items="clienteOptions"
          label="Cliente"
          prepend-inner-icon="mdi-account-circle-outline"
        />

        <v-row>
          <v-col cols="12" sm="6">
            <v-text-field v-model="form.data" label="Data" type="date" prepend-inner-icon="mdi-calendar-month-outline" />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select v-model="form.status" :items="statusOptions" label="Status" prepend-inner-icon="mdi-flag-outline" />
          </v-col>
        </v-row>

        <v-textarea
          v-model="form.observacao"
          label="Observação"
          rows="2"
          prepend-inner-icon="mdi-text-box-outline"
        />
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Itens do orçamento</p>
            <p class="section-subtitle">Adicione serviços, quantidade e valor</p>
          </div>

          <v-btn size="small" color="secondary" prepend-icon="mdi-plus" @click="addItem">Adicionar item</v-btn>
        </div>

        <div v-for="(item, index) in items" :key="item.rowId" class="item-wrap">
          <div class="d-flex align-center justify-space-between mb-2">
            <p class="text-caption mb-0">Item {{ index + 1 }}</p>
            <v-btn
              v-if="items.length > 1"
              variant="text"
              color="error"
              size="small"
              icon="mdi-trash-can-outline"
              @click="removeItem(index)"
            />
          </div>

          <v-select
            v-model="item.servico_id"
            :items="servicoOptions"
            label="Serviço"
            prepend-inner-icon="mdi-tools"
            @update:modelValue="onServicoChange(item)"
          />

          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="item.qtd_input"
                label="Quantidade"
                prepend-inner-icon="mdi-ruler-square"
                inputmode="decimal"
                placeholder="0,00"
                @update:modelValue="onQtdInput(item, $event)"
              />
            </v-col>

            <v-col cols="6">
              <v-text-field
                v-model="item.valor_unit_input"
                label="Valor unitário"
                prepend-inner-icon="mdi-cash"
                prefix="R$"
                inputmode="numeric"
                placeholder="0,00"
                @update:modelValue="onValorInput(item, $event)"
              />
            </v-col>
          </v-row>

          <div class="d-flex justify-space-between align-center">
            <p class="text-body-2">Subtotal</p>
            <p class="text-subtitle-1 font-weight-bold">{{ formatCurrency(item.subtotal) }}</p>
          </div>
        </div>

        <v-divider class="my-3" />

        <div class="d-flex justify-space-between align-center mt-2">
          <p class="text-subtitle-1 font-weight-bold">Total</p>
          <p class="text-h6 font-weight-black">{{ formatCurrency(total) }}</p>
        </div>

        <v-btn
          block
          color="primary"
          class="mt-4"
          :loading="saving"
          :disabled="!hasClientes || !hasServicos"
          prepend-icon="mdi-content-save-outline"
          @click="saveOrcamento"
        >
          Salvar orçamento
        </v-btn>
      </v-card>
    </div>
  </MainLayout>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { formatCurrency, getTodayIso } from '@/utils/formatters';
import { getFriendlyError } from '@/utils/errorMessages';
import { clearOrcamentoDraft, loadOrcamentoDraft, saveOrcamentoDraft } from '@/services/orcamentoDraft';
import {
  currencyInputFromNumber,
  maskCurrencyInput,
  normalizeDecimalInput,
  parseCurrencyInput
} from '@/utils/inputMasks';

const statusOptions = [
  { title: 'Rascunho', value: 'rascunho' },
  { title: 'Aprovado', value: 'aprovado' },
  { title: 'Recusado', value: 'recusado' }
];

const clientes = ref([]);
const servicos = ref([]);
const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const draftInfo = ref('');
const warning = ref('');
const hasBootstrapped = ref(false);
let rowCounter = 0;
let draftSaveTimer = 0;
let draftSavePaused = false;
let bootstrapped = false;

const form = reactive({
  cliente_id: '',
  data: getTodayIso(),
  status: 'rascunho',
  observacao: 'Valor válido por 15 dias. Materiais não inclusos.'
});

const hasClientes = computed(() => clientes.value.length > 0);
const hasServicos = computed(() => servicos.value.length > 0);

const clienteOptions = computed(() =>
  clientes.value.map((cliente) => ({ title: cliente.nome, value: cliente.id }))
);

const servicoOptions = computed(() =>
  servicos.value.map((servico) => ({
    title: `${servico.nome} (${servico.unidade})`,
    value: servico.id
  }))
);

const total = computed(() =>
  items.value.reduce((acc, item) => acc + Number(item.subtotal || 0), 0)
);

function createItem() {
  rowCounter += 1;
  return {
    rowId: `row_${rowCounter}`,
    servico_id: '',
    qtd_input: '',
    valor_unit_input: '',
    subtotal: 0
  };
}

function addItem() {
  items.value.push(createItem());
}

function removeItem(index) {
  items.value.splice(index, 1);
}

function parseQtd(input) {
  if (!input) return 0;
  const parsed = Number(String(input).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDraftTimestamp(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function recalculate(item) {
  const qtd = parseQtd(item.qtd_input);
  const valor = parseCurrencyInput(item.valor_unit_input);
  item.subtotal = Number((qtd * valor).toFixed(2));
}

function onQtdInput(item, value) {
  item.qtd_input = normalizeDecimalInput(value, 2);
  recalculate(item);
}

function onValorInput(item, value) {
  item.valor_unit_input = maskCurrencyInput(value);
  recalculate(item);
}

function onServicoChange(item) {
  const selected = servicos.value.find((servico) => servico.id === item.servico_id);
  if (selected) {
    item.valor_unit_input = currencyInputFromNumber(Number(selected.valor_padrao || 0));
  }

  recalculate(item);
}

function pauseDraftSave() {
  draftSavePaused = true;

  window.setTimeout(() => {
    draftSavePaused = false;
  }, 0);
}

function queueDraftSave() {
  if (!bootstrapped || draftSavePaused) return;

  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
  }

  draftSaveTimer = window.setTimeout(() => {
    saveOrcamentoDraft({
      form,
      items: items.value.map((item) => ({
        servico_id: item.servico_id,
        qtd_input: item.qtd_input,
        valor_unit_input: item.valor_unit_input
      }))
    });
  }, 400);
}

function restoreDraft(draft) {
  if (!draft) return;

  pauseDraftSave();

  const availableServicoIds = new Set(servicos.value.map((servico) => String(servico.id)));
  const availableClienteIds = new Set(clientes.value.map((cliente) => String(cliente.id)));

  form.cliente_id = availableClienteIds.has(String(draft.form.cliente_id || ''))
    ? String(draft.form.cliente_id)
    : '';
  form.data = draft.form.data || getTodayIso();
  form.status = draft.form.status || 'rascunho';
  form.observacao = draft.form.observacao || 'Valor válido por 15 dias. Materiais não inclusos.';

  const restoredItems = (draft.items || []).map((draftItem) => {
    const item = createItem();
    item.servico_id = availableServicoIds.has(String(draftItem.servico_id || ''))
      ? String(draftItem.servico_id)
      : '';
    item.qtd_input = normalizeDecimalInput(draftItem.qtd_input, 2);
    item.valor_unit_input = maskCurrencyInput(draftItem.valor_unit_input);
    recalculate(item);
    return item;
  });

  items.value = restoredItems.length ? restoredItems : [createItem()];

  const formattedTime = formatDraftTimestamp(draft.updated_at);
  draftInfo.value = formattedTime
    ? `Rascunho local restaurado (${formattedTime}).`
    : 'Rascunho local restaurado.';
}

function discardDraft() {
  clearOrcamentoDraft();
  draftInfo.value = '';
  success.value = 'Rascunho local removido.';
}

async function bootstrap() {
  loading.value = true;
  error.value = '';
  warning.value = '';

  try {
    const [clientesRes, servicosRes] = await Promise.all([
      apiClient.listClientes(),
      apiClient.listServicos()
    ]);

    clientes.value = clientesRes.data || [];
    servicos.value = servicosRes.data || [];
    warning.value = (clientesRes?.meta?.stale || servicosRes?.meta?.stale)
      ? 'Sem conexão estável. Clientes e serviços podem não refletir alterações recentes.'
      : '';

    const draft = loadOrcamentoDraft();
    if (draft) {
      restoreDraft(draft);
    } else if (!items.value.length) {
      addItem();
    }

    bootstrapped = true;
    hasBootstrapped.value = true;
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao carregar dados iniciais.');
  } finally {
    loading.value = false;
  }
}

async function refreshReferencesOnReturn() {
  warning.value = '';

  try {
    const [clientesRes, servicosRes] = await Promise.all([
      apiClient.listClientes(),
      apiClient.listServicos()
    ]);

    clientes.value = clientesRes.data || [];
    servicos.value = servicosRes.data || [];
    warning.value = (clientesRes?.meta?.stale || servicosRes?.meta?.stale)
      ? 'Sem conexão estável. Clientes e serviços podem não refletir alterações recentes.'
      : '';
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar clientes e serviços.');
  }
}

async function saveOrcamento() {
  error.value = '';
  success.value = '';

  if (!form.cliente_id) {
    error.value = 'Selecione o cliente para gerar o orçamento.';
    return;
  }

  const validItems = items.value
    .map((item) => {
      const qtd = parseQtd(item.qtd_input);
      const valor_unit = parseCurrencyInput(item.valor_unit_input);
      const subtotal = Number((qtd * valor_unit).toFixed(2));

      return {
        servico_id: item.servico_id,
        qtd,
        valor_unit,
        subtotal
      };
    })
    .filter((item) => item.servico_id && item.qtd > 0 && item.valor_unit > 0);

  if (!validItems.length) {
    error.value = 'Adicione pelo menos um item válido com quantidade e valor maior que zero.';
    return;
  }

  saving.value = true;

  try {
    await apiClient.createOrcamento({
      cliente_id: form.cliente_id,
      data: form.data,
      status: form.status,
      observacao: form.observacao,
      itens: validItems
    });

    pauseDraftSave();
    clearOrcamentoDraft();
    draftInfo.value = '';
    success.value = 'Orçamento salvo com sucesso.';
    form.cliente_id = '';
    form.data = getTodayIso();
    form.status = 'rascunho';
    form.observacao = 'Valor válido por 15 dias. Materiais não inclusos.';
    items.value = [createItem()];
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao salvar orçamento.');
  } finally {
    saving.value = false;
  }
}

watch(form, queueDraftSave, { deep: true });
watch(items, queueDraftSave, { deep: true });

onBeforeUnmount(() => {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
  }
});

onMounted(bootstrap);

onActivated(() => {
  if (hasBootstrapped.value) {
    refreshReferencesOnReturn();
  }
});
</script>
