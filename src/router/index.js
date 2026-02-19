import { createRouter, createWebHistory } from 'vue-router';
import { isAuthenticated } from '@/services/session';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/clientes',
    name: 'Clientes',
    component: () => import('@/views/ClientesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/servicos',
    name: 'Servicos',
    component: () => import('@/views/ServicosView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/orcamentos',
    name: 'Orcamentos',
    component: () => import('@/views/OrcamentosView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/orcamentos/novo',
    name: 'OrcamentoNovo',
    component: () => import('@/views/OrcamentoNovoView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/relatorios',
    name: 'Relatorios',
    component: () => import('@/views/RelatoriosView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    return { name: 'Login' };
  }

  if (to.meta.guestOnly && isAuthenticated()) {
    return { name: 'Home' };
  }

  return true;
});

export default router;
