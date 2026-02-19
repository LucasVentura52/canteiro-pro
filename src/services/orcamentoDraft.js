const DRAFT_KEY = 'canteiro_pro_orcamento_draft_v1';
const VALID_STATUS = new Set(['rascunho', 'aprovado', 'recusado']);
const MAX_ITEMS = 40;
const MAX_OBSERVACAO_LENGTH = 800;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignora erro de quota/storage indisponivel.
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignora erro de quota/storage indisponivel.
  }
}

function sanitizeString(value, maxLength = 255) {
  return String(value || '').slice(0, maxLength);
}

function sanitizeForm(form = {}) {
  const status = sanitizeString(form.status || 'rascunho', 24).toLowerCase();

  return {
    cliente_id: sanitizeString(form.cliente_id, 64),
    data: sanitizeString(form.data, 10),
    status: VALID_STATUS.has(status) ? status : 'rascunho',
    observacao: sanitizeString(form.observacao, MAX_OBSERVACAO_LENGTH)
  };
}

function sanitizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .slice(0, MAX_ITEMS)
    .map((item) => ({
      servico_id: sanitizeString(item?.servico_id, 64),
      qtd_input: sanitizeString(item?.qtd_input, 24),
      valor_unit_input: sanitizeString(item?.valor_unit_input, 24)
    }))
    .filter((item) => item.servico_id || item.qtd_input || item.valor_unit_input);
}

export function saveOrcamentoDraft({ form, items }) {
  const safeForm = sanitizeForm(form);
  const safeItems = sanitizeItems(items);

  const isEmptyForm = !safeForm.cliente_id && !safeForm.observacao && !safeForm.data;
  if (isEmptyForm && safeItems.length === 0) {
    storageRemove(DRAFT_KEY);
    return;
  }

  const payload = {
    form: safeForm,
    items: safeItems,
    updated_at: new Date().toISOString()
  };

  storageSet(DRAFT_KEY, JSON.stringify(payload));
}

export function loadOrcamentoDraft() {
  const raw = storageGet(DRAFT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      form: sanitizeForm(parsed.form || {}),
      items: sanitizeItems(parsed.items || []),
      updated_at: sanitizeString(parsed.updated_at, 40)
    };
  } catch {
    storageRemove(DRAFT_KEY);
    return null;
  }
}

export function clearOrcamentoDraft() {
  storageRemove(DRAFT_KEY);
}
