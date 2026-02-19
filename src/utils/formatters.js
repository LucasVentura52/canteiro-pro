export function toNumber(value) {
  if (value === null || value === undefined) return 0;

  const normalized = String(value).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(toNumber(value));
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export function getCurrentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}
