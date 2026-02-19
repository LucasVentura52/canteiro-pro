const knownMessages = [
  {
    match: (message) => message.includes('unauthorized'),
    text: 'Sua sessão expirou. Entre novamente para continuar.'
  },
  {
    match: (message) => message.includes('route not found'),
    text: 'A API não encontrou essa rota. Verifique a implantação do Apps Script.'
  },
  {
    match: (message) => message.includes('failed to fetch') || message.includes('networkerror'),
    text: 'Não foi possível conectar. Confira sua internet e tente novamente.'
  },
  {
    match: (message) => message.includes('request_timeout') || message.includes('timeout'),
    text: 'A conexão demorou mais que o esperado. Tente novamente em instantes.'
  },
  {
    match: (message) => message.includes('resposta html inesperada da api'),
    text: 'A API retornou uma página HTML. Verifique se o Apps Script está publicado corretamente.'
  },
  {
    match: (message) => message.includes('resposta invalida da api') || message.includes('resposta inválida da api'),
    text: 'A API respondeu em formato inválido. Tente novamente em instantes.'
  },
  {
    match: (message) => message.includes('erro http 429'),
    text: 'Muitas requisições em sequência. Aguarde alguns segundos e tente de novo.'
  },
  {
    match: (message) =>
      message.includes('erro http 500')
      || message.includes('erro http 502')
      || message.includes('erro http 503')
      || message.includes('erro http 504'),
    text: 'O serviço está instável no momento. Aguarde e tente novamente.'
  },
  {
    match: (message) => message.includes('credenciais invalidas') || message.includes('credenciais inválidas'),
    text: 'Usuário ou senha inválidos.'
  },
  {
    match: (message) => message.includes('cliente nao encontrado') || message.includes('cliente não encontrado'),
    text: 'Cliente não encontrado. Atualize a lista e tente novamente.'
  },
  {
    match: (message) => message.includes('servico nao encontrado') || message.includes('serviço não encontrado'),
    text: 'Serviço não encontrado. Atualize a lista e tente novamente.'
  },
  {
    match: (message) => message.includes('orcamento nao encontrado') || message.includes('orçamento não encontrado'),
    text: 'Orçamento não encontrado. Atualize a lista e tente novamente.'
  },
  {
    match: (message) => message.includes('valor_padrao deve ser maior que zero'),
    text: 'O valor padrão deve ser maior que zero.'
  },
  {
    match: (message) => message.includes('cliente inativo'),
    text: 'Este cliente está inativo. Reative o cadastro para criar novos orçamentos.'
  },
  {
    match: (message) => message.includes('valor deve ser maior que zero'),
    text: 'Informe um valor de recebimento maior que zero.'
  },
  {
    match: (message) => message.includes('recebimento nao encontrado') || message.includes('recebimento não encontrado'),
    text: 'Recebimento não encontrado. Atualize a tela e tente novamente.'
  }
];

export function getFriendlyError(error, fallback = 'Ocorreu um erro inesperado.') {
  const raw = String(error?.message || '').trim();
  if (!raw) return fallback;

  const normalized = raw.toLowerCase();
  const found = knownMessages.find((item) => item.match(normalized));

  if (found) return found.text;
  return raw;
}
