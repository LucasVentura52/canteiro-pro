<template>
  <MainLayout title="Clientes">
    <div class="page-stack">
      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Novo cliente</p>
            <p class="section-subtitle">Cadastre para reutilizar em futuros orçamentos</p>
          </div>
        </div>

        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="form.nome"
              label="Nome do cliente"
              prepend-inner-icon="mdi-account-outline"
              placeholder="Ex: João da Silva"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.telefone"
              label="Telefone"
              prepend-inner-icon="mdi-phone-outline"
              placeholder="(44) 99999-9999"
              maxlength="15"
              @update:modelValue="onPhoneInput"
            />
          </v-col>

          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.endereco"
              label="Endereço da obra"
              prepend-inner-icon="mdi-map-marker-outline"
            />
          </v-col>
        </v-row>

        <v-btn color="primary" prepend-icon="mdi-content-save-outline" :loading="saving" @click="saveCliente">
          Salvar cliente
        </v-btn>
      </v-card>

      <v-card class="pa-4 section-card">
        <div class="section-head">
          <div>
            <p class="section-title">Lista de clientes</p>
            <p class="section-subtitle">
              {{ filteredClientes.length }} cliente(s) {{ showInativos ? 'cadastrado(s)' : 'ativo(s)' }}
            </p>
          </div>

          <div class="d-flex ga-2 align-center flex-wrap justify-end">
            <v-switch
              v-model="showInativos"
              inset
              density="compact"
              hide-details
              color="secondary"
              label="Mostrar inativos"
            />

            <div style="min-width: 170px;">
              <v-text-field
                v-model="search"
                label="Buscar"
                prepend-inner-icon="mdi-magnify"
                density="compact"
                hide-details
              />
            </div>
          </div>
        </div>

        <v-progress-linear
          v-if="loading"
          color="primary"
          indeterminate
          rounded
          class="mb-3"
        />

        <v-list v-if="filteredClientes.length" lines="two">
          <v-list-item
            v-for="cliente in filteredClientes"
            :key="cliente.id"
            class="list-row"
          >
            <v-list-item-title class="d-flex align-center ga-2">
              <span>{{ cliente.nome }}</span>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="isClienteAtivo(cliente) ? 'success' : 'error'"
              >
                {{ isClienteAtivo(cliente) ? 'Ativo' : 'Inativo' }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ cliente.telefone || 'Sem telefone cadastrado' }}
            </v-list-item-subtitle>
            <v-list-item-subtitle>
              {{ cliente.endereco || 'Endereço não informado' }}
            </v-list-item-subtitle>

            <template #append>
              <v-btn
                icon="mdi-pencil-outline"
                variant="text"
                color="secondary"
                size="small"
                @click="openEditDialog(cliente)"
              />

              <v-btn
                :icon="isClienteAtivo(cliente) ? 'mdi-account-off-outline' : 'mdi-account-check-outline'"
                variant="text"
                :color="isClienteAtivo(cliente) ? 'error' : 'success'"
                size="small"
                :loading="togglingId === cliente.id"
                @click="toggleClienteAtivo(cliente)"
              />
            </template>
          </v-list-item>
        </v-list>

        <v-card v-else-if="!loading" class="pa-4 empty-card" variant="flat">
          <v-icon icon="mdi-account-search-outline" size="26" color="secondary" />
          <p>Nenhum cliente encontrado com esse filtro.</p>
        </v-card>
      </v-card>

      <v-dialog v-model="editDialog" max-width="560">
        <v-card class="pa-4 section-card">
          <div class="section-head">
            <div>
              <p class="section-title">Editar cliente</p>
              <p class="section-subtitle">Atualize os dados de contato e obra</p>
            </div>
          </div>

          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="editForm.nome"
                label="Nome do cliente"
                prepend-inner-icon="mdi-account-outline"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editForm.telefone"
                label="Telefone"
                prepend-inner-icon="mdi-phone-outline"
                maxlength="15"
                @update:modelValue="onEditPhoneInput"
              />
            </v-col>

            <v-col cols="12" sm="6">
              <v-text-field
                v-model="editForm.endereco"
                label="Endereço da obra"
                prepend-inner-icon="mdi-map-marker-outline"
              />
            </v-col>
          </v-row>

          <div class="d-flex ga-2 justify-end mt-2">
            <v-btn variant="text" color="secondary" @click="editDialog = false">Cancelar</v-btn>
            <v-btn color="primary" :loading="editing" prepend-icon="mdi-content-save-outline" @click="saveEditCliente">
              Salvar alterações
            </v-btn>
          </div>
        </v-card>
      </v-dialog>
    </div>
  </MainLayout>
</template>

<script setup>
import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue';
import MainLayout from '@/layouts/MainLayout.vue';
import { apiClient } from '@/services/apiClient';
import { useFeedbackToasts } from '@/composables/useFeedbackToasts';
import { getFriendlyError } from '@/utils/errorMessages';
import { maskPhone } from '@/utils/inputMasks';

const clientes = ref([]);
const search = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const warning = ref('');
useFeedbackToasts({ error, success, warning });
const hasLoaded = ref(false);
const editDialog = ref(false);
const editing = ref(false);
const showInativos = ref(false);
const togglingId = ref('');

const form = reactive({
  nome: '',
  telefone: '',
  endereco: ''
});

const editForm = reactive({
  id: '',
  nome: '',
  telefone: '',
  endereco: ''
});

const filteredClientes = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return clientes.value;

  return clientes.value.filter((cliente) =>
    [cliente.nome, cliente.telefone, cliente.endereco]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  );
});

function resetFeedback() {
  error.value = '';
  success.value = '';
  warning.value = '';
}

function onPhoneInput(value) {
  form.telefone = maskPhone(value);
}

function onEditPhoneInput(value) {
  editForm.telefone = maskPhone(value);
}

function openEditDialog(cliente) {
  editForm.id = cliente.id;
  editForm.nome = cliente.nome || '';
  editForm.telefone = maskPhone(cliente.telefone || '');
  editForm.endereco = cliente.endereco || '';
  editDialog.value = true;
}

function isClienteAtivo(cliente) {
  if (cliente?.ativo === undefined || cliente?.ativo === null || String(cliente?.ativo).trim() === '') {
    return true;
  }

  return String(cliente?.ativo).toLowerCase() === 'true' || String(cliente?.ativo) === '1';
}

async function loadClientes(options = {}) {
  const { force = false } = options;

  loading.value = true;
  error.value = '';
  warning.value = '';

  try {
    const response = await apiClient.listClientes({
      force,
      includeInativos: showInativos.value
    });
    clientes.value = response.data || [];
    warning.value = response?.meta?.stale
      ? 'Sem conexão estável. Lista exibida a partir do último sincronismo.'
      : '';
    hasLoaded.value = true;
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao carregar clientes.');
  } finally {
    loading.value = false;
  }
}

async function toggleClienteAtivo(cliente) {
  resetFeedback();
  togglingId.value = cliente.id;

  try {
    await apiClient.toggleCliente(cliente.id, !isClienteAtivo(cliente));
    success.value = isClienteAtivo(cliente)
      ? 'Cliente inativado com sucesso.'
      : 'Cliente reativado com sucesso.';
    await loadClientes({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar status do cliente.');
  } finally {
    togglingId.value = '';
  }
}

async function saveCliente() {
  resetFeedback();

  if (!form.nome.trim()) {
    error.value = 'Informe o nome do cliente.';
    return;
  }

  if (form.nome.trim().length < 3) {
    error.value = 'O nome precisa ter pelo menos 3 caracteres.';
    return;
  }

  saving.value = true;

  try {
    await apiClient.createCliente({
      nome: form.nome.trim(),
      telefone: form.telefone,
      endereco: form.endereco.trim()
    });

    form.nome = '';
    form.telefone = '';
    form.endereco = '';
    success.value = 'Cliente salvo com sucesso.';

    await loadClientes({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao salvar cliente.');
  } finally {
    saving.value = false;
  }
}

async function saveEditCliente() {
  resetFeedback();

  if (!editForm.id) {
    error.value = 'Cliente inválido para edição.';
    return;
  }

  if (!editForm.nome.trim() || editForm.nome.trim().length < 3) {
    error.value = 'Informe um nome válido com pelo menos 3 caracteres.';
    return;
  }

  editing.value = true;

  try {
    await apiClient.updateCliente({
      id: editForm.id,
      nome: editForm.nome.trim(),
      telefone: editForm.telefone,
      endereco: editForm.endereco.trim()
    });

    editDialog.value = false;
    success.value = 'Cliente atualizado com sucesso.';
    await loadClientes({ force: true });
  } catch (err) {
    error.value = getFriendlyError(err, 'Falha ao atualizar cliente.');
  } finally {
    editing.value = false;
  }
}

onMounted(loadClientes);

onActivated(() => {
  if (hasLoaded.value) {
    loadClientes();
  }
});

watch(showInativos, () => {
  if (hasLoaded.value) {
    loadClientes({ force: true });
  }
});
</script>
