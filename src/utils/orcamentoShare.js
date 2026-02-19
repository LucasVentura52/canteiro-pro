import { formatCurrency, formatDate } from '@/utils/formatters';

function formatItemLine(item) {
  const nome = item?.servico_nome || 'Serviço';
  const qtd = Number(item?.qtd || 0).toFixed(2).replace('.', ',');
  const unidade = item?.unidade || 'un';
  const subtotal = formatCurrency(item?.subtotal || 0);

  return `- ${nome}: ${qtd} ${unidade} (${subtotal})`;
}

export function buildOrcamentoWhatsappMessage(detail) {
  if (!detail) return 'Orçamento indisponível.';

  const lines = [
    '*Orçamento de Obra*',
    '',
    `Cliente: ${detail?.cliente?.nome || 'Não informado'}`,
    `Data: ${formatDate(detail?.data)}`,
    `Status: ${String(detail?.status || 'rascunho')}`,
    ''
  ];

  const itens = Array.isArray(detail.itens) ? detail.itens : [];
  if (itens.length) {
    lines.push('*Itens:*');
    itens.forEach((item) => {
      lines.push(formatItemLine(item));
    });
    lines.push('');
  }

  if (detail?.observacao) {
    lines.push(`Observação: ${detail.observacao}`);
    lines.push('');
  }

  lines.push(`*Total:* ${formatCurrency(detail?.total || 0)}`);

  return lines.join('\n');
}
