<template>
  <div class="login-root">
    <v-main>
      <div class="login-wrap">
        <v-card class="pa-6 login-card section-card">
          <p class="kicker">Canteiro Pro</p>
          <h1 class="text-h5 font-weight-bold mb-2">Entrar na conta</h1>
          <p class="section-subtitle mb-4">Plataforma profissional para orçamentos e gestão de obras.</p>

          <v-alert v-if="error" class="mb-4 soft-alert alert-error" type="error" variant="tonal" density="comfortable">
            {{ error }}
          </v-alert>

          <v-text-field v-model="form.usuario" label="Usuário" prepend-inner-icon="mdi-account-outline"
            autocomplete="username" hint="Informe seu usuário de acesso" persistent-hint />

          <v-text-field class="mt-5" v-model="form.senha" label="Senha" :type="showPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            autocomplete="current-password" @click:append-inner="showPassword = !showPassword" @keyup.enter="entrar" />

          <v-btn block color="primary" :loading="loading" @click="entrar">
            Entrar
          </v-btn>

          <p class="text-caption mt-4 text-medium-emphasis">Se não tiver acesso, fale com o administrador.</p>
        </v-card>
      </div>
    </v-main>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiClient } from '@/services/apiClient';
import { getFriendlyError } from '@/utils/errorMessages';

const router = useRouter();
const loading = ref(false);
const showPassword = ref(false);
const error = ref('');

const form = reactive({
  usuario: '',
  senha: ''
});

async function entrar() {
  error.value = '';

  if (!form.usuario.trim() || !form.senha.trim()) {
    error.value = 'Preencha usuário e senha para continuar.';
    return;
  }

  loading.value = true;

  try {
    await apiClient.login(form.usuario.trim(), form.senha.trim());
    router.replace({ name: 'Home' });
  } catch (err) {
    error.value = getFriendlyError(err, 'Não foi possível fazer login agora.');
  } finally {
    loading.value = false;
  }
}
</script>