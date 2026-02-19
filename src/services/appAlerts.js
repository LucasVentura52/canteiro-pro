import { ref } from 'vue';

const MAX_ALERTS = 4;
const DEFAULT_TIMEOUT_MS = 4200;

const alerts = ref([]);
const timers = new Map();

let sequence = 0;
let lastSignature = '';
let lastCreatedAt = 0;

function normalizeType(type) {
  if (type === 'success') return 'success';
  if (type === 'error') return 'error';
  return 'warning';
}

function clearTimer(id) {
  if (!timers.has(id)) return;
  clearTimeout(timers.get(id));
  timers.delete(id);
}

function scheduleDismiss(id, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) return;

  clearTimer(id);
  const timer = setTimeout(() => dismissAlert(id), timeoutMs);
  timers.set(id, timer);
}

export function pushAlert(input) {
  const payload = input || {};
  const message = String(payload.message || '').trim();
  if (!message) return '';

  const type = normalizeType(payload.type);
  const title = String(payload.title || '').trim();
  const timeoutMs = Number(payload.timeoutMs || DEFAULT_TIMEOUT_MS);
  const signature = `${type}:${message}`;
  const now = Date.now();

  if (signature === lastSignature && now - lastCreatedAt < 1100) {
    return '';
  }

  lastSignature = signature;
  lastCreatedAt = now;

  const id = `alert_${now}_${sequence += 1}`;
  const nextAlert = {
    id,
    type,
    title,
    message
  };

  const nextAlerts = [nextAlert, ...alerts.value];
  while (nextAlerts.length > MAX_ALERTS) {
    const removed = nextAlerts.pop();
    if (removed && removed.id) {
      clearTimer(removed.id);
    }
  }

  alerts.value = nextAlerts;
  scheduleDismiss(id, timeoutMs);
  return id;
}

export function dismissAlert(id) {
  if (!id) return;
  clearTimer(id);
  alerts.value = alerts.value.filter((item) => item.id !== id);
}

export function clearAlerts() {
  alerts.value.forEach((item) => clearTimer(item.id));
  alerts.value = [];
}

export function useAppAlertsStore() {
  return {
    alerts
  };
}
