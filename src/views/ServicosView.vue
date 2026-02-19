<template>
  <MainLayout title="Serviços">
    <div class="page-stack">
      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Novo serviço</p>
            <p class="section-subtitle">Defina valor base para acelerar os orçamentos</p>
          </div>
        </div>

        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="form.nome"
              label="Nome do serviço"
              prepend-inner-icon="mdi-tools"
              placeholder="Ex: Reboco interno"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-select
              v-model="form.unidade"
              :items="unidades"
              label="Unidade"
              prepend-inner-icon="mdi-ruler-square"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.valor_padrao"
              label="Valor padrão"
              prepend-inner-icon="mdi-cash-multiple"
              prefix="R$"
              inputmode="numeric"
              placeholder="0,00"
              @update:modelValue="onValorInput"
            />
          </v-col>
        </v-row>

        <v-btn color="primary" prepend-icon="mdi-content-save-outline" :loading="saving" @click="saveServico">
          Salvar serviço
        </v-btn>
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Tabela de serviços</p>
            <p class="section-subtitle">
              {{ servicos.length }} serviço(s) {{ showInativos ? 'cadastrado(s)' : 'ativo(s)' }}
            </p>
          </div>

          <v-switch
            v-model="showInativos"
            inset
            density="compact"
            hide-details
            color="secondary"
            label="Mostrar inativos"
          />
        </div>

        <v-progress-linear
          v-if="loading"
          color="primary"
          indeterminate
          rounded
          class="mb-3"
        />

        <v-list v-if="servicos.length" lines="two">
          <v-list-item
            v-for="servico in servicos"
            :key="servico.id"
            class="list-row"
          >
            <v-list-item-title class="d-flex align-center ga-2">
              <span>{{ servico.nome }}</span>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="isServicoAtivo(servico) ? 'success' : 'error'"
              >
                {{ isServicoAtivo(servico) ? 'Ativo' : 'Inativo' }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ servico.unidade }} | {{ formatCurrency(servico.valor_padrao) }}
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex ga-1">
                <v-btn
                  icon="mdi-pencil-outline"
                  variant="text"
                  color="secondary"
                  size="small"
                  @click="openEditDialog(servico)"
                />

                <v-btn
                  :icon="isServicoAtivo(servico) ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                  variant="text"
                  :color="isServicoAtivo(servico) ? 'error' : 'success'"
                  size="small"
                  :loading="togglingId === servico.id"
                  @click="toggleServicoAtivo(servico)"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>

        <v-card v-else-if="!loading" class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-tools" size="26" color="secondary" />
          <p>Nenhum serviço cadastrado ainda.</p>
        </v-card>
      </v-card>

      <v-dialog v-model="editDialog" max-width="560">
        <v-card class="pa-4 section-card">
          <div class="section-head">
            <div>
              <p class="section-title">Editar serviço</p>
              <p class="section-subtitle">Ajuste valor, unidade e disponibilidade</p>
            </div>
          </div>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="editForm.nome"
                label="Nome do serviço"
                prepend-inner-icon="mdi-tools"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-select
                v-model="editForm.unidade"
                :items="unidades"
                label="Unidade"
                prepend-inner-icon="mdi-ruler-square"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editForm.valor_padrao"
                label="Valor padrão"
                prepend-inner-icon="mdi-cash-multiple"
                prefix="R$"
                inputmode="numeric"
                @update:modelValue="onEditValorInput"
              />
            </v-col>
          </v-row>

          <v-switch
            v-model="editForm.ativo"
            inset
            color="secondary"
            label="Serviço ativo"
            hide-details
          />

          <div class="d-flex ga-2 justify-end mt-3">
            <v-btn variant="text" color="secondary" @click="editDialog = false">Cancelar</v-btn>
            <v-btn color="primary" :loading="editing" prepend-icon="mdi-content-save-outline" @click="saveEditServico">
              Salvar alterações
            </v-btn>
          </div>
        </v-card>
      </v-dialog>
    </div>
  </MainLayout>
</template>

<script setup>
import { onActivated, onMounted, reactive, ref, watch } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { useFeedbackToasts } from '@/composables/useFeedbackToasts';
import { formatCurrency } from '@/utils/formatters';
import { getFriendlyError } from '@/utils/errorMessages';
import { currencyInputFromNumber, maskCurrencyInput, parseCurrencyInput } from '@/utils/inputMasks';

const unidades = ['m2', 'm', 'diaria', 'unidade'];

const servicos = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const warning = ref('');
useFeedbackToasts({ error, success, warning });
const hasLoaded = ref(false);
const showInativos = ref(false);
const editDialog = ref(false);
const editing = ref(false);
const togglingId = ref('');

const form = reactive({
  nome: '',
  unidade: 'm2',
  valor_padrao: ''
});

const editForm = reactive({
  id: '',
  nome: '',
  unidade: 'm2',
  valor_padrao: '',
  ativo: true
});

function resetFeedback() {
  error.value = '';
  success.value = '';
  warning.value = '';
}

function onValorInput(value) {
  form.valor_padrao = maskCurrencyInput(value);
}

function onEditValorInput(value) {
  editForm.valor_padrao = maskCurrencyInput(value);
}

function isServicoAtivo(servico) {
  if (servico?.ativo === undefined || servico?.ativo === null || String(servico?.ativo).trim() === '') {
    return true;
  }

  return String(servico?.ativo).toLowerCase() === 'true' || String(servico?.ativo) === '1';
}

function openEditDialog(servico) {
  editForm.id = servico.id;
  editForm.nome = servico.nome || '';
  editForm.unidade = servico.unidade || 'm2';
  editForm.valor_padrao = currencyInputFromNumber(Number(servico.valor_padrao || 0));
  editForm.ativo = isServicoAtivo(servico);
  editDialog.value = true;
}

async function loadServicos(options = {}) {
  const { force = false } = options;

  loading.value = true;
  error.value = '';
  warning.value = '';

  try {
    const response = await apiClient.listServicos({
      force,
      includeInativos: showInativos.value
    });
    servicos.value = response.data || [];
    warning.value = response?.meta?.stale
      ? 'Sem conexão estável. Serviços exibidos do último sincronismo.'
      : '';
    hasLoaded.value = true;
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao carregar serviços.');
  } finally {
    loading.value = false;
  }
}

async function saveServico() {
  resetFeedback();

  if (!form.nome.trim()) {
    error.value = 'Informe o nome do serviço.';
    return;
  }

  const valor = parseCurrencyInput(form.valor_padrao);
  if (valor <= 0) {
    error.value = 'Informe um valor padrão maior que zero.';
    return;
  }

  saving.value = true;

  try {
    await apiClient.createServico({
      nome: form.nome.trim(),
      unidade: form.unidade,
      valor_padrao: valor
    });

    form.nome = '';
    form.unidade = 'm2';
    form.valor_padrao = '';
    success.value = 'Serviço salvo com sucesso.';

    await loadServicos({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao salvar serviço.');
  } finally {
    saving.value = false;
  }
}

async function saveEditServico() {
  resetFeedback();

  if (!editForm.id) {
    error.value = 'Serviço inválido para edição.';
    return;
  }

  if (!editForm.nome.trim()) {
    error.value = 'Informe o nome do serviço.';
    return;
  }

  const valor = parseCurrencyInput(editForm.valor_padrao);
  if (valor <= 0) {
    error.value = 'Informe um valor padrão maior que zero.';
    return;
  }

  editing.value = true;

  try {
    await apiClient.updateServico({
      id: editForm.id,
      nome: editForm.nome.trim(),
      unidade: editForm.unidade,
      valor_padrao: valor,
      ativo: editForm.ativo
    });

    editDialog.value = false;
    success.value = 'Serviço atualizado com sucesso.';
    await loadServicos({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar serviço.');
  } finally {
    editing.value = false;
  }
}

async function toggleServicoAtivo(servico) {
  resetFeedback();
  togglingId.value = servico.id;

  try {
    await apiClient.toggleServico(servico.id, !isServicoAtivo(servico));
    success.value = isServicoAtivo(servico)
      ? 'Serviço inativado com sucesso.'
      : 'Serviço ativado com sucesso.';
    await loadServicos({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar status do serviço.');
  } finally {
    togglingId.value = '';
  }
}

onMounted(loadServicos);

onActivated(() => {
  if (hasLoaded.value) {
    loadServicos();
  }
});

watch(showInativos, () => {
  if (hasLoaded.value) {
    loadServicos({ force: true });
  }
});
</script>
