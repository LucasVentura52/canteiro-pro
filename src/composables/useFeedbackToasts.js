import { watch } from 'vue';
import { pushAlert } from '@/services/appAlerts';

const ALERT_CONFIG = {
  error: {
    type: 'error',
    title: 'Erro',
    timeoutMs: 6200
  },
  success: {
    type: 'success',
    title: 'Sucesso',
    timeoutMs: 4200
  },
  warning: {
    type: 'warning',
    title: 'Atenção',
    timeoutMs: 5200
  }
};

export function useFeedbackToasts(refMap, options = {}) {
  const shouldClear = options.clearAfterToast !== false;
  const entries = Object.entries(refMap || {});

  entries.forEach(([key, source]) => {
    const config = ALERT_CONFIG[key];
    if (!config || !source) return;

    watch(
      source,
      (value) => {
        const message = String(value || '').trim();
        if (!message) return;

        pushAlert({
          type: config.type,
          title: config.title,
          message,
          timeoutMs: config.timeoutMs
        });

        if (shouldClear) {
          source.value = '';
        }
      },
      { flush: 'post' }
    );
  });
}
