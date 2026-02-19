import { getToken, saveSession, clearSession } from '@/services/session';

const BASE_URL = import.meta.env.VITE_SHEETS_API_URL;
const DEFAULT_READ_TTL_MS = 45 * 1000;
const DEFAULT_TIMEOUT_MS = 14 * 1000;
const DEFAULT_STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 450;
const MAX_RETRIES = 2;
const PERSISTED_CACHE_PREFIX = 'canteiro_pro_http_cache:';

const responseCache = new Map();
const inFlightRequests = new Map();
const routeVersions = new Map();

function ensureBaseUrl() {
  if (!BASE_URL) {
    throw new Error('Defina `VITE_SHEETS_API_URL` no arquivo `.env`.');
  }
}

function buildUrl(route, query = {}) {
  ensureBaseUrl();
  const url = new URL(BASE_URL);
  url.searchParams.set('route', route);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function withAuth(payload = {}, includeAuth = true) {
  if (!includeAuth) return payload;

  const token = getToken();
  if (!token) return payload;

  return {
    ...payload,
    auth: token,
    token
  };
}

function clonePayload(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function stableSort(value) {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSort(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSort(value));
}

function getRouteVersion(route) {
  return routeVersions.get(route) || 0;
}

function bumpRouteVersion(route) {
  routeVersions.set(route, getRouteVersion(route) + 1);
}

function makeRequestKey(route, payload) {
  return `${route}@${getRouteVersion(route)}:${stableStringify(payload)}`;
}

function clearRequestState() {
  responseCache.clear();
  inFlightRequests.clear();
  routeVersions.clear();
  clearPersistedCache();
}

function invalidateRoutes(routes = []) {
  if (!routes.length) return;

  routes.forEach((route) => {
    bumpRouteVersion(route);

    const prefix = `${route}@`;

    [...responseCache.keys()].forEach((key) => {
      if (key.startsWith(prefix)) {
        responseCache.delete(key);
      }
    });

    [...inFlightRequests.keys()].forEach((key) => {
      if (key.startsWith(prefix)) {
        inFlightRequests.delete(key);
      }
    });

    clearPersistedCache(route);
  });
}

function localStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function localStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignora erro de limite/quota.
  }
}

function localStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignora erro de storage indisponivel.
  }
}

function clearPersistedCache(route = '') {
  const prefix = route
    ? `${PERSISTED_CACHE_PREFIX}${route}@`
    : PERSISTED_CACHE_PREFIX;

  try {
    const keys = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorageRemove(key));
  } catch {
    // Ignora erro de storage indisponivel.
  }
}

function getCachedResponse(key, { allowExpired = false } = {}) {
  const now = Date.now();
  const inMemory = responseCache.get(key);

  if (inMemory) {
    const fresh = inMemory.expiresAt > now;

    if (fresh || allowExpired) {
      return clonePayload(inMemory);
    }
  }

  const persistedRaw = localStorageGet(`${PERSISTED_CACHE_PREFIX}${key}`);
  if (!persistedRaw) return null;

  try {
    const persisted = JSON.parse(persistedRaw);
    const fresh = Number(persisted.expiresAt || 0) > now;

    if (fresh || allowExpired) {
      return persisted;
    }
  } catch {
    localStorageRemove(`${PERSISTED_CACHE_PREFIX}${key}`);
  }

  return null;
}

function setCachedResponse(key, data, ttlMs) {
  if (ttlMs <= 0) return;

  const now = Date.now();
  const entry = {
    value: clonePayload(data),
    expiresAt: now + ttlMs,
    storedAt: now
  };

  responseCache.set(key, entry);
  localStorageSet(`${PERSISTED_CACHE_PREFIX}${key}`, JSON.stringify(entry));
}

function withStaleMeta(data, storedAt) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const clone = clonePayload(data);
  clone.meta = {
    ...(clone.meta || {}),
    stale: true,
    staleAt: storedAt || null
  };

  return clone;
}

function isRetryableError(error) {
  const message = String(error?.message || '').toLowerCase();

  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('request_timeout')
    || message.includes('timeout');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function parseJsonResponse(response) {
  const raw = await response.text();
  if (!raw) {
    throw new Error('Resposta vazia da API.');
  }

  try {
    return JSON.parse(raw);
  } catch {
    const normalized = raw.toLowerCase();

    if (normalized.includes('<html') || normalized.includes('<!doctype')) {
      throw new Error('Resposta HTML inesperada da API.');
    }

    throw new Error('Resposta inválida da API.');
  }
}

async function parseResponse(response) {
  const data = await parseJsonResponse(response);

  if (!data) {
    throw new Error('Resposta inválida da API.');
  }

  const unauthorized = response.status === 401 || data.error === 'Unauthorized';

  if (unauthorized) {
    clearSession();
    clearRequestState();
    throw new Error('Unauthorized');
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }

  return data;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('request_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function request(method, route, payload = {}, options = {}) {
  const {
    includeAuth = true,
    query = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = MAX_RETRIES
  } = options;

  const authPayload = withAuth(payload, includeAuth);
  const authQuery = withAuth(query, includeAuth);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        buildUrl(route, method === 'GET' ? authQuery : query),
        {
          method,
          headers: method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
          body: method === 'POST' ? JSON.stringify(authPayload) : undefined
        },
        timeoutMs
      );

      const transientStatus = [429, 500, 502, 503, 504];
      if (transientStatus.includes(response.status) && attempt < retries) {
        await sleep(RETRY_BASE_DELAY_MS * (2 ** attempt));
        continue;
      }

      return await parseResponse(response);
    } catch (error) {
      if (attempt < retries && isRetryableError(error)) {
        await sleep(RETRY_BASE_DELAY_MS * (2 ** attempt));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Falha ao processar requisição.');
}

async function get(route, query = {}, includeAuth = true) {
  return request('GET', route, {}, { includeAuth, query });
}

async function post(route, payload = {}, includeAuth = true) {
  return request('POST', route, payload, { includeAuth });
}

async function postRead(route, payload = {}, options = {}) {
  const {
    includeAuth = true,
    ttlMs = DEFAULT_READ_TTL_MS,
    force = false,
    allowStaleOnError = true,
    staleMaxAgeMs = DEFAULT_STALE_MAX_AGE_MS
  } = options;

  const requestBody = withAuth(payload, includeAuth);
  const key = makeRequestKey(route, requestBody);

  if (!force) {
    const cached = getCachedResponse(key, { allowExpired: false });
    if (cached) {
      return clonePayload(cached.value);
    }
  }

  if (inFlightRequests.has(key)) {
    const inFlight = await inFlightRequests.get(key);
    return clonePayload(inFlight);
  }

  const requestPromise = post(route, payload, includeAuth)
    .then((data) => {
      setCachedResponse(key, data, ttlMs);

      return data;
    })
    .catch((error) => {
      if (!allowStaleOnError) throw error;

      const stale = getCachedResponse(key, { allowExpired: true });
      const staleAge = stale ? Date.now() - Number(stale.storedAt || 0) : Infinity;

      if (stale && staleAge <= staleMaxAgeMs) {
        return withStaleMeta(stale.value, stale.storedAt);
      }

      throw error;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, requestPromise);

  const data = await requestPromise;
  return clonePayload(data);
}

export const apiClient = {
  async health() {
    return get('health', {}, false);
  },

  async login(usuario, senha) {
    clearRequestState();

    const data = await post('auth/login', { usuario, senha }, false);
    saveSession(data.token, data.user);

    return data;
  },

  async me(options = {}) {
    const { force = false } = options;

    return postRead('auth/me', {}, {
      ttlMs: 60 * 1000,
      force
    });
  },

  async listClientes(options = {}) {
    const { force = false, includeInativos = false } = options;

    return postRead('clientes/list', {
      include_inativos: includeInativos ? 1 : 0
    }, {
      ttlMs: 5 * 60 * 1000,
      force
    });
  },

  async createCliente(payload) {
    const data = await post('clientes/create', payload);
    invalidateRoutes(['clientes/list']);

    return data;
  },

  async updateCliente(payload) {
    const data = await post('clientes/update', payload);
    invalidateRoutes(['clientes/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async toggleCliente(id, ativo) {
    const payload = { id };
    if (ativo !== undefined) {
      payload.ativo = ativo;
    }

    const data = await post('clientes/toggle', payload);
    invalidateRoutes(['clientes/list', 'orcamentos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async listServicos(options = {}) {
    const { force = false, includeInativos = false } = options;

    return postRead('servicos/list', {
      include_inativos: includeInativos ? 1 : 0
    }, {
      ttlMs: 5 * 60 * 1000,
      force
    });
  },

  async createServico(payload) {
    const data = await post('servicos/create', payload);
    invalidateRoutes(['servicos/list']);

    return data;
  },

  async updateServico(payload) {
    const data = await post('servicos/update', payload);
    invalidateRoutes(['servicos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async toggleServico(id, ativo) {
    const payload = { id };
    if (ativo !== undefined) {
      payload.ativo = ativo;
    }

    const data = await post('servicos/toggle', payload);
    invalidateRoutes(['servicos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async listOrcamentos({ mes, status } = {}, options = {}) {
    const { force = false } = options;

    return postRead('orcamentos/list', { mes, status }, {
      ttlMs: 90 * 1000,
      force
    });
  },

  async createOrcamento(payload) {
    const data = await post('orcamentos/create', payload);
    invalidateRoutes(['orcamentos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async updateOrcamentoStatus(id, status) {
    const data = await post('orcamentos/update-status', { id, status });
    invalidateRoutes(['orcamentos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async getOrcamentoDetalhe(id, options = {}) {
    const { force = false } = options;

    return postRead('orcamentos/detail', { id }, {
      ttlMs: 90 * 1000,
      force
    });
  },

  async listRecebimentos(orcamentoId, options = {}) {
    const { force = false, includeInativos = false } = options;

    return postRead('recebimentos/list', {
      orcamento_id: orcamentoId,
      include_inativos: includeInativos ? 1 : 0
    }, {
      ttlMs: 45 * 1000,
      force
    });
  },

  async createRecebimento(payload) {
    const data = await post('recebimentos/create', payload);
    invalidateRoutes(['recebimentos/list', 'orcamentos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async toggleRecebimento(id, ativo) {
    const payload = { id };
    if (ativo !== undefined) {
      payload.ativo = ativo;
    }

    const data = await post('recebimentos/toggle', payload);
    invalidateRoutes(['recebimentos/list', 'orcamentos/list', 'orcamentos/detail', 'relatorios/mensal']);

    return data;
  },

  async relatorioMensal(ano, mes, options = {}) {
    const { force = false } = options;

    return postRead('relatorios/mensal', { ano, mes }, {
      ttlMs: 90 * 1000,
      force
    });
  },

  async logout() {
    try {
      await post('auth/logout', {});
    } catch {
      // Se a API estiver indisponivel, limpa sessao local mesmo assim.
    } finally {
      clearSession();
      clearRequestState();
    }
  }
};
