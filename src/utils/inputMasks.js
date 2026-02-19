export function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

export function maskPhone(value = '') {
  const digits = onlyDigits(value).slice(0, 11);

  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCurrencyInput(value = '') {
  const digits = onlyDigits(value);

  if (!digits) return '';

  const cents = Number(digits);
  const number = cents / 100;

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

export function currencyInputFromNumber(value = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';

  const cents = Math.round(number * 100);
  return maskCurrencyInput(String(cents));
}

export function parseCurrencyInput(value = '') {
  if (!value) return 0;

  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDecimalInput(value = '', maxDecimals = 2) {
  const raw = String(value || '');
  const cleaned = raw
    .replace(/[^0-9.,]/g, '')
    .replace(',', '.');

  if (!cleaned) return '';

  const [intPart = '', decimalPart = ''] = cleaned.split('.');

  const normalizedInt = intPart.replace(/^0+(?=\d)/, '') || '0';

  if (!decimalPart && cleaned.endsWith('.')) {
    return `${normalizedInt}.`;
  }

  const normalizedDecimal = decimalPart.slice(0, maxDecimals);

  return normalizedDecimal ? `${normalizedInt}.${normalizedDecimal}` : normalizedInt;
}
