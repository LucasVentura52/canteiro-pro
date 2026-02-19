/**
 * Canteiro Pro - Backend em Google Apps Script
 *
 * Rotas publicas:
 * - GET  ?route=health
 * - POST ?route=health
 * - POST ?route=auth/login
 *
 * Rotas protegidas:
 * - GET|POST  ?route=auth/me
 * - POST      ?route=auth/logout
 * - GET|POST  ?route=clientes/list
 * - POST      ?route=clientes/create
 * - POST      ?route=clientes/update
 * - POST      ?route=clientes/toggle
 * - GET|POST  ?route=servicos/list
 * - POST      ?route=servicos/create
 * - POST      ?route=servicos/update
 * - POST      ?route=servicos/toggle
 * - GET|POST  ?route=orcamentos/list
 * - GET|POST  ?route=orcamentos/detail&id=...
 * - POST      ?route=orcamentos/create
 * - POST      ?route=orcamentos/update-status
 * - GET|POST  ?route=recebimentos/list&orcamento_id=...
 * - POST      ?route=recebimentos/create
 * - POST      ?route=recebimentos/toggle
 * - GET|POST  ?route=relatorios/mensal
 *
 * Auth token pode ser enviado em:
 * - query: auth, token, access_token
 * - body:  auth, token, access_token
 */

const SHEETS = {
  usuarios: 'usuarios',
  clientes: 'clientes',
  servicos: 'servicos',
  orcamentos: 'orcamentos',
  orcamento_itens: 'orcamento_itens',
  recebimentos: 'recebimentos'
};

const SHEET_HEADERS = {
  usuarios: ['id', 'usuario', 'senha_hash', 'nome', 'ativo', 'criado_em'],
  clientes: ['id', 'nome', 'telefone', 'endereco', 'ativo', 'criado_em', 'atualizado_em', 'excluido_em'],
  servicos: ['id', 'nome', 'unidade', 'valor_padrao', 'ativo', 'criado_em', 'atualizado_em', 'excluido_em'],
  orcamentos: ['id', 'cliente_id', 'data', 'status', 'total', 'observacao', 'criado_em', 'atualizado_em'],
  orcamento_itens: ['id', 'orcamento_id', 'servico_id', 'qtd', 'valor_unit', 'subtotal'],
  recebimentos: ['id', 'orcamento_id', 'data', 'valor', 'metodo', 'observacao', 'ativo', 'criado_em', 'atualizado_em', 'excluido_em']
};

const STATUS_VALIDOS = ['rascunho', 'aprovado', 'recusado'];
const TOKEN_PREFIX = 'tok_';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

function doGet(e) {
  return respond_(dispatch_('GET', e));
}

function doPost(e) {
  return respond_(dispatch_('POST', e));
}

function dispatch_(method, e) {
  try {
    const body = method === 'POST' ? parseBody_(e) : {};
    const route = getRoute_(e, body);

    if (!route) return fail_('Missing route', 400);
    ensureRequiredSchema_();

    if (route === 'health' && (method === 'GET' || method === 'POST')) {
      return ok_({
        status: 'up',
        now: new Date().toISOString()
      });
    }

    if (route === 'auth/login' && method === 'POST') {
      return handleLogin_(body);
    }

    if (route === 'auth/register' && method === 'POST') {
      return handleRegister_(body);
    }

    const session = requireAuth_(e, body);

    if (route === 'auth/me' && (method === 'GET' || method === 'POST')) {
      const user = getUserById_(session.user_id);
      if (!user) return fail_('User not found', 404);
      return ok_({ user: sanitizeUser_(user) });
    }

    if (route === 'auth/logout' && method === 'POST') {
      revokeToken_(session.token);
      return ok_({ message: 'Logout realizado' });
    }

    if (route === 'clientes/list' && (method === 'GET' || method === 'POST')) {
      const includeInativosRaw = requestParam_(e, body, 'include_inativos') || requestParam_(e, body, 'incluir_inativos');
      return ok_({ data: listClientes_(isTruthy_(includeInativosRaw)) });
    }

    if (route === 'clientes/create' && method === 'POST') {
      return handleClientesCreate_(body, session.user_id);
    }

    if (route === 'clientes/update' && method === 'POST') {
      return handleClientesUpdate_(body, session.user_id);
    }

    if (route === 'clientes/toggle' && method === 'POST') {
      return handleClientesToggle_(body, session.user_id);
    }

    if (route === 'servicos/list' && (method === 'GET' || method === 'POST')) {
      const includeInativosRaw = requestParam_(e, body, 'include_inativos') || requestParam_(e, body, 'incluir_inativos');
      return ok_({ data: listServicos_(isTruthy_(includeInativosRaw)) });
    }

    if (route === 'servicos/create' && method === 'POST') {
      return handleServicosCreate_(body, session.user_id);
    }

    if (route === 'servicos/update' && method === 'POST') {
      return handleServicosUpdate_(body, session.user_id);
    }

    if (route === 'servicos/toggle' && method === 'POST') {
      return handleServicosToggle_(body, session.user_id);
    }

    if (route === 'orcamentos/list' && (method === 'GET' || method === 'POST')) {
      const mes = requestParam_(e, body, 'mes');
      const status = requestParam_(e, body, 'status');
      return ok_({ data: listOrcamentos_(mes, status) });
    }

    if (route === 'orcamentos/detail' && (method === 'GET' || method === 'POST')) {
      const id = requestParam_(e, body, 'id');
      if (!id) return fail_('id e obrigatorio', 400);

      const detail = getOrcamentoDetalhe_(id);
      if (!detail) return fail_('Orcamento nao encontrado', 404);

      return ok_({ data: detail });
    }

    if (route === 'orcamentos/create' && method === 'POST') {
      return handleOrcamentosCreate_(body, session.user_id);
    }

    if (route === 'orcamentos/update-status' && method === 'POST') {
      return handleOrcamentosUpdateStatus_(body, session.user_id);
    }

    if (route === 'recebimentos/list' && (method === 'GET' || method === 'POST')) {
      const orcamentoId = requestParam_(e, body, 'orcamento_id');
      const includeInativosRaw = requestParam_(e, body, 'include_inativos') || requestParam_(e, body, 'incluir_inativos');
      return ok_({ data: listRecebimentos_(orcamentoId, isTruthy_(includeInativosRaw)) });
    }

    if (route === 'recebimentos/create' && method === 'POST') {
      return handleRecebimentosCreate_(body, session.user_id);
    }

    if (route === 'recebimentos/toggle' && method === 'POST') {
      return handleRecebimentosToggle_(body, session.user_id);
    }

    if (route === 'relatorios/mensal' && (method === 'GET' || method === 'POST')) {
      const ano = requestParam_(e, body, 'ano');
      const mes = requestParam_(e, body, 'mes');
      return ok_({ data: buildRelatorioMensal_(ano, mes) });
    }

    return fail_('Route not found', 404);
  } catch (err) {
    const message = String(err && err.message ? err.message : err);

    if (message === 'UNAUTHORIZED') {
      return fail_('Unauthorized', 401);
    }

    return fail_(message, 500);
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    return {};
  }
}

function getRoute_(e, body) {
  if (e && e.parameter && e.parameter.route) return String(e.parameter.route).trim();
  if (body && body.route) return String(body.route).trim();
  return '';
}

function safeParam_(e, name) {
  if (!e || !e.parameter || e.parameter[name] === undefined) return '';
  return String(e.parameter[name] || '').trim();
}

function requestParam_(e, body, name) {
  const queryValue = safeParam_(e, name);
  if (queryValue) return queryValue;

  if (body && body[name] !== undefined && body[name] !== null) {
    return String(body[name]).trim();
  }

  return '';
}

function respond_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok_(payload) {
  return Object.assign({ ok: true, code: 200 }, payload || {});
}

function fail_(error, code) {
  return {
    ok: false,
    code: code || 400,
    error: error || 'Unknown error'
  };
}

function nowIso_() {
  return new Date().toISOString();
}

function newId_() {
  return Utilities.getUuid();
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;

  const normalized = String(value).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  return value;
}

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}

function ensureSheetHeaders_(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }

  const currentLastCol = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0].map((item) => String(item || '').trim());
  let nextCol = currentLastCol;

  requiredHeaders.forEach((header) => {
    if (!currentHeaders.includes(header)) {
      nextCol += 1;
      sheet.getRange(1, nextCol).setValue(header);
      currentHeaders.push(header);
    }
  });
}

function ensureRequiredSchema_() {
  const ss = getSpreadsheet_();

  Object.keys(SHEET_HEADERS).forEach((sheetName) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    ensureSheetHeaders_(sheet, SHEET_HEADERS[sheetName]);
  });
}

function getHeaders_(sheet) {
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) {
    throw new Error('Sheet sem cabecalho: ' + sheet.getName());
  }

  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function withSheetLock_(callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function readAll_(sheetName) {
  const sheet = getSheet_(sheetName);
  const headers = getHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values.map((row) => {
    const item = {};
    headers.forEach((header, idx) => {
      item[header] = normalizeCell_(row[idx]);
    });
    return item;
  });
}

function appendObject_(sheetName, payload) {
  return withSheetLock_(function () {
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);
    const row = headers.map((header) => (payload[header] !== undefined ? payload[header] : ''));
    sheet.appendRow(row);
  });
}

function updateById_(sheetName, id, patch) {
  return withSheetLock_(function () {
    const sheet = getSheet_(sheetName);
    const headers = getHeaders_(sheet);
    const idIndex = headers.indexOf('id');

    if (idIndex < 0) throw new Error('Coluna id nao encontrada em ' + sheetName);

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;

    const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    for (let rowIdx = 0; rowIdx < values.length; rowIdx += 1) {
      if (String(values[rowIdx][idIndex]) === String(id)) {
        headers.forEach((header, colIdx) => {
          if (patch[header] !== undefined) {
            values[rowIdx][colIdx] = patch[header];
          }
        });

        sheet.getRange(2, 1, values.length, headers.length).setValues(values);
        return true;
      }
    }

    return false;
  });
}

function findOne_(sheetName, field, value) {
  return readAll_(sheetName).find((row) => String(row[field]) === String(value)) || null;
}

function isTruthy_(value) {
  const raw = String(value || '').toLowerCase().trim();
  return raw === 'true' || raw === '1' || raw === 'sim' || raw === 'yes';
}

function isActive_(value) {
  if (value === undefined || value === null) return true;
  if (String(value).trim() === '') return true;
  return isTruthy_(value);
}

function sanitizeUser_(user) {
  return {
    id: user.id,
    usuario: user.usuario,
    nome: user.nome,
    ativo: user.ativo
  };
}

function getUserById_(id) {
  return findOne_(SHEETS.usuarios, 'id', id);
}

function sha256_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map((b) => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function makeSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function hashPassword_(plain) {
  const salt = makeSalt_();
  const hash = sha256_(salt + plain);
  return salt + '$' + hash;
}

function verifyPassword_(plain, stored) {
  if (!stored || stored.indexOf('$') === -1) return false;

  const parts = stored.split('$');
  const salt = parts[0];
  const hash = parts[1];

  return sha256_(salt + plain) === hash;
}

function issueToken_(userId) {
  const token = TOKEN_PREFIX + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const payload = {
    user_id: userId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };

  const raw = JSON.stringify(payload);
  CacheService.getScriptCache().put(token, raw, TOKEN_TTL_SECONDS);
  PropertiesService.getScriptProperties().setProperty(token, raw);

  return token;
}

function readTokenPayload_(token) {
  if (!token || token.indexOf(TOKEN_PREFIX) !== 0) return null;

  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();

  let raw = cache.get(token);

  if (!raw) {
    raw = props.getProperty(token);
    if (raw) {
      cache.put(token, raw, 120);
    }
  }

  if (!raw) return null;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    revokeToken_(token);
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    revokeToken_(token);
    return null;
  }

  return payload;
}

function revokeToken_(token) {
  if (!token) return;
  CacheService.getScriptCache().remove(token);
  PropertiesService.getScriptProperties().deleteProperty(token);
}

function requireAuth_(e, body) {
  const tokenFromQuery = requestParam_(e, body, 'auth') || requestParam_(e, body, 'token') || requestParam_(e, body, 'access_token');
  const tokenFromBody = body && (body.auth || body.token || body.access_token) ? (body.auth || body.token || body.access_token) : '';
  const token = String(tokenFromQuery || tokenFromBody || '').trim();

  const payload = readTokenPayload_(token);
  if (!payload) throw new Error('UNAUTHORIZED');

  return {
    token,
    user_id: payload.user_id,
    exp: payload.exp
  };
}

function handleLogin_(body) {
  const usuario = String(body.usuario || '').trim();
  const senha = String(body.senha || '').trim();

  if (!usuario || !senha) {
    return fail_('usuario e senha sao obrigatorios', 400);
  }

  const user = findOne_(SHEETS.usuarios, 'usuario', usuario);

  if (!user || !isTruthy_(user.ativo)) {
    return fail_('Credenciais invalidas', 401);
  }

  if (!verifyPassword_(senha, String(user.senha_hash || ''))) {
    return fail_('Credenciais invalidas', 401);
  }

  const token = issueToken_(user.id);

  return ok_({
    token,
    user: sanitizeUser_(user)
  });
}

function handleRegister_(body) {
  const usuario = String(body.usuario || '').trim();
  const senha = String(body.senha || '').trim();
  const nome = String(body.nome || '').trim();

  if (!usuario || !senha || !nome) {
    return fail_('usuario, senha e nome sao obrigatorios', 400);
  }

  const exists = findOne_(SHEETS.usuarios, 'usuario', usuario);
  if (exists) {
    return fail_('Usuario ja existe', 409);
  }

  const now = nowIso_();
  const row = {
    id: newId_(),
    usuario: usuario,
    senha_hash: hashPassword_(senha),
    nome: nome,
    ativo: true,
    criado_em: now
  };

  appendObject_(SHEETS.usuarios, row);

  return ok_({ user: sanitizeUser_(row) });
}

function listClientes_(includeInativos) {
  let rows = readAll_(SHEETS.clientes);

  if (!includeInativos) {
    rows = rows.filter((item) => isActive_(item.ativo));
  }

  rows.sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
  return rows;
}

function handleClientesCreate_(body) {
  const nome = String(body.nome || '').trim();
  const telefone = String(body.telefone || '').trim();
  const endereco = String(body.endereco || '').trim();

  if (!nome) {
    return fail_('nome e obrigatorio', 400);
  }

  const row = {
    id: newId_(),
    nome: nome,
    telefone: telefone,
    endereco: endereco,
    ativo: true,
    criado_em: nowIso_(),
    atualizado_em: nowIso_(),
    excluido_em: ''
  };

  appendObject_(SHEETS.clientes, row);

  return ok_({ data: row });
}

function handleClientesUpdate_(body) {
  const id = String(body.id || '').trim();
  const nome = String(body.nome || '').trim();
  const telefone = String(body.telefone || '').trim();
  const endereco = String(body.endereco || '').trim();

  if (!id || !nome) {
    return fail_('id e nome sao obrigatorios', 400);
  }

  const current = findOne_(SHEETS.clientes, 'id', id);
  if (!current) {
    return fail_('Cliente nao encontrado', 404);
  }

  const patch = {
    nome: nome,
    telefone: telefone,
    endereco: endereco,
    atualizado_em: nowIso_()
  };

  const updated = updateById_(SHEETS.clientes, id, patch);
  if (!updated) {
    return fail_('Cliente nao encontrado', 404);
  }

  return ok_({
    data: Object.assign({}, current, patch)
  });
}

function handleClientesToggle_(body) {
  const id = String(body.id || '').trim();

  if (!id) {
    return fail_('id e obrigatorio', 400);
  }

  const cliente = findOne_(SHEETS.clientes, 'id', id);
  if (!cliente) {
    return fail_('Cliente nao encontrado', 404);
  }

  const shouldToggle = body.ativo === undefined || body.ativo === null || body.ativo === '';
  const proximoStatus = shouldToggle ? !isActive_(cliente.ativo) : isTruthy_(body.ativo);
  const now = nowIso_();

  const updated = updateById_(SHEETS.clientes, id, {
    ativo: proximoStatus,
    atualizado_em: now,
    excluido_em: proximoStatus ? '' : now
  });

  if (!updated) {
    return fail_('Cliente nao encontrado', 404);
  }

  return ok_({
    data: Object.assign({}, cliente, {
      ativo: proximoStatus,
      atualizado_em: now,
      excluido_em: proximoStatus ? '' : now
    })
  });
}

function listServicos_(includeInativos) {
  let rows = readAll_(SHEETS.servicos);

  if (!includeInativos) {
    rows = rows.filter((item) => isActive_(item.ativo));
  }

  rows.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  return rows;
}

function handleServicosCreate_(body) {
  const nome = String(body.nome || '').trim();
  const unidade = String(body.unidade || '').trim();
  const valorPadrao = toNumber_(body.valor_padrao);

  if (!nome || !unidade) {
    return fail_('nome e unidade sao obrigatorios', 400);
  }

  const row = {
    id: newId_(),
    nome: nome,
    unidade: unidade,
    valor_padrao: Number(valorPadrao.toFixed(2)),
    ativo: true,
    criado_em: nowIso_(),
    atualizado_em: nowIso_(),
    excluido_em: ''
  };

  appendObject_(SHEETS.servicos, row);

  return ok_({ data: row });
}

function handleServicosUpdate_(body) {
  const id = String(body.id || '').trim();
  const nome = String(body.nome || '').trim();
  const unidade = String(body.unidade || '').trim();
  const valorPadrao = toNumber_(body.valor_padrao);
  const ativoRaw = body.ativo;

  if (!id || !nome || !unidade) {
    return fail_('id, nome e unidade sao obrigatorios', 400);
  }

  if (valorPadrao <= 0) {
    return fail_('valor_padrao deve ser maior que zero', 400);
  }

  const current = findOne_(SHEETS.servicos, 'id', id);
  if (!current) {
    return fail_('Servico nao encontrado', 404);
  }

  const now = nowIso_();

  const patch = {
    nome: nome,
    unidade: unidade,
    valor_padrao: Number(valorPadrao.toFixed(2)),
    ativo: ativoRaw === undefined || ativoRaw === null || ativoRaw === '' ? isActive_(current.ativo) : isTruthy_(ativoRaw),
    atualizado_em: now
  };

  patch.excluido_em = patch.ativo ? '' : now;

  const updated = updateById_(SHEETS.servicos, id, patch);
  if (!updated) {
    return fail_('Servico nao encontrado', 404);
  }

  return ok_({
    data: Object.assign({}, current, patch)
  });
}

function handleServicosToggle_(body) {
  const id = String(body.id || '').trim();

  if (!id) {
    return fail_('id e obrigatorio', 400);
  }

  const servico = findOne_(SHEETS.servicos, 'id', id);
  if (!servico) {
    return fail_('Servico nao encontrado', 404);
  }

  const shouldToggle = body.ativo === undefined || body.ativo === null || body.ativo === '';
  const proximoStatus = shouldToggle ? !isActive_(servico.ativo) : isTruthy_(body.ativo);
  const now = nowIso_();

  const updated = updateById_(SHEETS.servicos, id, {
    ativo: proximoStatus,
    atualizado_em: now,
    excluido_em: proximoStatus ? '' : now
  });

  if (!updated) {
    return fail_('Servico nao encontrado', 404);
  }

  return ok_({
    data: Object.assign({}, servico, {
      ativo: proximoStatus,
      atualizado_em: now,
      excluido_em: proximoStatus ? '' : now
    })
  });
}

function normalizeDateOnly_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const raw = String(value);
  if (raw.length >= 10) return raw.slice(0, 10);
  return raw;
}

function listOrcamentos_(mes, status) {
  let rows = readAll_(SHEETS.orcamentos).map((item) => {
    item.data = normalizeDateOnly_(item.data);
    return item;
  });

  if (mes) {
    rows = rows.filter((item) => String(item.data || '').slice(0, 7) === mes);
  }

  if (status) {
    rows = rows.filter((item) => String(item.status || '') === status);
  }

  const orcamentoIds = rows.map((item) => String(item.id));
  const resumoFinanceiro = buildRecebimentosResumoMap_(orcamentoIds);

  rows = rows.map((item) => {
    const total = toNumber_(item.total);
    const finance = resumoFinanceiro[String(item.id)] || { total_recebido: 0, saldo: total, pagamento_status: 'pendente' };

    return Object.assign({}, item, {
      total_recebido: Number(toNumber_(finance.total_recebido).toFixed(2)),
      saldo: Number(toNumber_(finance.saldo).toFixed(2)),
      pagamento_status: finance.pagamento_status || 'pendente'
    });
  });

  rows.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return rows;
}

function computePagamentoStatus_(total, totalRecebido) {
  const alvo = toNumber_(total);
  const recebido = toNumber_(totalRecebido);

  if (recebido <= 0) return 'pendente';
  if (recebido + 0.01 < alvo) return 'parcial';
  if (recebido > alvo + 0.01) return 'excedente';
  return 'pago';
}

function buildRecebimentosResumoMap_(orcamentoIds) {
  const ids = Array.isArray(orcamentoIds) ? orcamentoIds : [];
  const idSet = {};
  ids.forEach((id) => {
    idSet[String(id)] = true;
  });

  const orcamentos = readAll_(SHEETS.orcamentos);
  const totalMap = {};

  orcamentos.forEach((orcamento) => {
    const key = String(orcamento.id || '');
    if (!key) return;
    if (ids.length && !idSet[key]) return;
    totalMap[key] = toNumber_(orcamento.total);
  });

  const recebimentos = readAll_(SHEETS.recebimentos)
    .filter((item) => isActive_(item.ativo))
    .filter((item) => {
      const key = String(item.orcamento_id || '');
      if (!key) return false;
      if (ids.length && !idSet[key]) return false;
      return true;
    });

  const recebidoMap = {};

  recebimentos.forEach((item) => {
    const key = String(item.orcamento_id || '');
    if (!recebidoMap[key]) {
      recebidoMap[key] = 0;
    }
    recebidoMap[key] += toNumber_(item.valor);
  });

  const result = {};

  Object.keys(totalMap).forEach((key) => {
    const total = toNumber_(totalMap[key]);
    const totalRecebido = Number((toNumber_(recebidoMap[key] || 0)).toFixed(2));
    const saldo = Number((total - totalRecebido).toFixed(2));

    result[key] = {
      total_orcamento: total,
      total_recebido: totalRecebido,
      saldo: saldo,
      pagamento_status: computePagamentoStatus_(total, totalRecebido)
    };
  });

  return result;
}

function listRecebimentos_(orcamentoId, includeInativos) {
  let rows = readAll_(SHEETS.recebimentos).map((item) => {
    item.data = normalizeDateOnly_(item.data);
    item.valor = Number(toNumber_(item.valor).toFixed(2));
    return item;
  });

  if (!includeInativos) {
    rows = rows.filter((item) => isActive_(item.ativo));
  }

  if (orcamentoId) {
    rows = rows.filter((item) => String(item.orcamento_id) === String(orcamentoId));
  }

  rows.sort((a, b) => {
    const dataCmp = String(b.data || '').localeCompare(String(a.data || ''));
    if (dataCmp !== 0) return dataCmp;
    return String(b.criado_em || '').localeCompare(String(a.criado_em || ''));
  });

  return rows;
}

function handleRecebimentosCreate_(body) {
  const orcamentoId = String(body.orcamento_id || '').trim();
  const data = normalizeDateOnly_(body.data || new Date());
  const valor = toNumber_(body.valor);
  const metodo = String(body.metodo || '').trim();
  const observacao = String(body.observacao || '').trim();

  if (!orcamentoId) {
    return fail_('orcamento_id e obrigatorio', 400);
  }

  if (valor <= 0) {
    return fail_('valor deve ser maior que zero', 400);
  }

  const orcamento = findOne_(SHEETS.orcamentos, 'id', orcamentoId);
  if (!orcamento) {
    return fail_('Orcamento nao encontrado', 404);
  }

  const now = nowIso_();
  const row = {
    id: newId_(),
    orcamento_id: orcamentoId,
    data: data,
    valor: Number(valor.toFixed(2)),
    metodo: metodo,
    observacao: observacao,
    ativo: true,
    criado_em: now,
    atualizado_em: now,
    excluido_em: ''
  };

  appendObject_(SHEETS.recebimentos, row);

  return ok_({
    data: row,
    financeiro: buildRecebimentosResumoMap_([orcamentoId])[String(orcamentoId)] || null
  });
}

function handleRecebimentosToggle_(body) {
  const id = String(body.id || '').trim();

  if (!id) {
    return fail_('id e obrigatorio', 400);
  }

  const recebimento = findOne_(SHEETS.recebimentos, 'id', id);
  if (!recebimento) {
    return fail_('Recebimento nao encontrado', 404);
  }

  const shouldToggle = body.ativo === undefined || body.ativo === null || body.ativo === '';
  const proximoStatus = shouldToggle ? !isActive_(recebimento.ativo) : isTruthy_(body.ativo);
  const now = nowIso_();

  const updated = updateById_(SHEETS.recebimentos, id, {
    ativo: proximoStatus,
    atualizado_em: now,
    excluido_em: proximoStatus ? '' : now
  });

  if (!updated) {
    return fail_('Recebimento nao encontrado', 404);
  }

  return ok_({
    data: Object.assign({}, recebimento, {
      ativo: proximoStatus,
      atualizado_em: now,
      excluido_em: proximoStatus ? '' : now
    }),
    financeiro: buildRecebimentosResumoMap_([String(recebimento.orcamento_id)])[String(recebimento.orcamento_id)] || null
  });
}

function getOrcamentoDetalhe_(id) {
  const orcamento = findOne_(SHEETS.orcamentos, 'id', id);
  if (!orcamento) return null;

  orcamento.data = normalizeDateOnly_(orcamento.data);

  const cliente = findOne_(SHEETS.clientes, 'id', orcamento.cliente_id);
  const servicos = readAll_(SHEETS.servicos);
  const mapaServicos = {};

  servicos.forEach((servico) => {
    mapaServicos[String(servico.id)] = servico;
  });

  const itens = readAll_(SHEETS.orcamento_itens)
    .filter((item) => String(item.orcamento_id) === String(id))
    .map((item) => {
      const servico = mapaServicos[String(item.servico_id)] || {};

      return {
        id: item.id,
        orcamento_id: item.orcamento_id,
        servico_id: item.servico_id,
        servico_nome: String(servico.nome || 'Servico removido'),
        unidade: String(servico.unidade || 'un'),
        qtd: toNumber_(item.qtd),
        valor_unit: toNumber_(item.valor_unit),
        subtotal: toNumber_(item.subtotal)
      };
    });

  const recebimentos = listRecebimentos_(id, true);
  const financeiroMap = buildRecebimentosResumoMap_([id]);

  return Object.assign({}, orcamento, {
    cliente: cliente
      ? {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        ativo: isActive_(cliente.ativo)
      }
      : null,
    itens: itens,
    recebimentos: recebimentos,
    financeiro: financeiroMap[String(id)] || {
      total_orcamento: toNumber_(orcamento.total),
      total_recebido: 0,
      saldo: toNumber_(orcamento.total),
      pagamento_status: 'pendente'
    }
  });
}

function handleOrcamentosCreate_(body) {
  const clienteId = String(body.cliente_id || '').trim();
  const data = normalizeDateOnly_(body.data || new Date());
  const status = String(body.status || 'rascunho').trim().toLowerCase();
  const observacao = String(body.observacao || '').trim();
  const itens = Array.isArray(body.itens) ? body.itens : [];

  if (!clienteId) {
    return fail_('cliente_id e obrigatorio', 400);
  }

  if (!STATUS_VALIDOS.includes(status)) {
    return fail_('status invalido', 400);
  }

  const cliente = findOne_(SHEETS.clientes, 'id', clienteId);
  if (!cliente) {
    return fail_('Cliente nao encontrado', 404);
  }
  if (!isActive_(cliente.ativo)) {
    return fail_('Cliente inativo', 400);
  }

  if (!itens.length) {
    return fail_('itens e obrigatorio', 400);
  }

  const servicos = readAll_(SHEETS.servicos);

  const normalizados = itens
    .map((item) => {
      const servicoId = String(item.servico_id || '').trim();
      const qtd = toNumber_(item.qtd);
      const valorUnit = toNumber_(item.valor_unit);

      if (!servicoId || qtd <= 0 || valorUnit < 0) {
        return null;
      }

      const servico = servicos.find((s) => String(s.id) === servicoId);
      if (!servico) {
        return null;
      }
      if (!isActive_(servico.ativo)) {
        return null;
      }

      const subtotal = Number((qtd * valorUnit).toFixed(2));

      return {
        id: newId_(),
        orcamento_id: '',
        servico_id: servicoId,
        qtd: Number(qtd.toFixed(2)),
        valor_unit: Number(valorUnit.toFixed(2)),
        subtotal: subtotal
      };
    })
    .filter(Boolean);

  if (!normalizados.length) {
    return fail_('Nenhum item valido para salvar', 400);
  }

  const total = Number(normalizados.reduce((acc, item) => acc + toNumber_(item.subtotal), 0).toFixed(2));
  const orcamentoId = newId_();
  const now = nowIso_();

  const orcamento = {
    id: orcamentoId,
    cliente_id: clienteId,
    data: data,
    status: status,
    total: total,
    observacao: observacao,
    criado_em: now,
    atualizado_em: now
  };

  appendObject_(SHEETS.orcamentos, orcamento);

  normalizados.forEach((item) => {
    item.orcamento_id = orcamentoId;
    appendObject_(SHEETS.orcamento_itens, item);
  });

  return ok_({ data: orcamento });
}

function handleOrcamentosUpdateStatus_(body) {
  const id = String(body.id || '').trim();
  const status = String(body.status || '').trim().toLowerCase();

  if (!id || !status) {
    return fail_('id e status sao obrigatorios', 400);
  }

  if (!STATUS_VALIDOS.includes(status)) {
    return fail_('status invalido', 400);
  }

  const updated = updateById_(SHEETS.orcamentos, id, {
    status: status,
    atualizado_em: nowIso_()
  });

  if (!updated) {
    return fail_('Orcamento nao encontrado', 404);
  }

  return ok_({ message: 'Status atualizado' });
}

function buildRelatorioMensal_(ano, mes) {
  const anoNum = toNumber_(ano);
  const mesNum = toNumber_(mes);

  if (!anoNum || !mesNum) {
    throw new Error('ano e mes sao obrigatorios');
  }

  const mesPad = String(mesNum).padStart(2, '0');
  const periodo = `${anoNum}-${mesPad}`;

  const orcamentos = readAll_(SHEETS.orcamentos)
    .map((row) => {
      row.data = normalizeDateOnly_(row.data);
      return row;
    })
    .filter((row) => String(row.data || '').slice(0, 7) === periodo);

  const resumo = {
    periodo: periodo,
    total_orcamentos: orcamentos.length,
    total_aprovados: 0,
    total_recusados: 0,
    total_rascunho: 0,
    faturamento_total: 0,
    ticket_medio: 0,
    total_recebido: 0,
    total_a_receber: 0
  };

  orcamentos.forEach((orc) => {
    const total = toNumber_(orc.total);
    resumo.faturamento_total += total;

    if (orc.status === 'aprovado') resumo.total_aprovados += 1;
    if (orc.status === 'recusado') resumo.total_recusados += 1;
    if (orc.status === 'rascunho') resumo.total_rascunho += 1;
  });

  resumo.faturamento_total = Number(resumo.faturamento_total.toFixed(2));
  resumo.ticket_medio = resumo.total_orcamentos
    ? Number((resumo.faturamento_total / resumo.total_orcamentos).toFixed(2))
    : 0;

  const orcamentoIds = {};
  orcamentos.forEach((orc) => {
    orcamentoIds[String(orc.id)] = true;
  });
  const resumoFinanceiro = buildRecebimentosResumoMap_(Object.keys(orcamentoIds));

  resumo.total_recebido = Number(Object.keys(resumoFinanceiro)
    .reduce((acc, key) => acc + toNumber_(resumoFinanceiro[key].total_recebido), 0)
    .toFixed(2));
  resumo.total_a_receber = Number((resumo.faturamento_total - resumo.total_recebido).toFixed(2));

  const itens = readAll_(SHEETS.orcamento_itens)
    .filter((item) => Boolean(orcamentoIds[String(item.orcamento_id)]));

  const servicos = readAll_(SHEETS.servicos);
  const servicoNomes = {};
  const clientes = readAll_(SHEETS.clientes);
  const clienteNomes = {};

  servicos.forEach((servico) => {
    servicoNomes[String(servico.id)] = String(servico.nome || 'Servico removido');
  });

  clientes.forEach((cliente) => {
    clienteNomes[String(cliente.id)] = String(cliente.nome || 'Cliente removido');
  });

  const mapPorServico = {};

  itens.forEach((item) => {
    const key = String(item.servico_id || '');
    if (!key) return;

    if (!mapPorServico[key]) {
      mapPorServico[key] = {
        servico_id: key,
        servico_nome: servicoNomes[key] || 'Servico removido',
        quantidade_total: 0,
        valor_total: 0
      };
    }

    mapPorServico[key].quantidade_total += toNumber_(item.qtd);
    mapPorServico[key].valor_total += toNumber_(item.subtotal);
  });

  const porServico = Object.keys(mapPorServico)
    .map((key) => ({
      servico_id: mapPorServico[key].servico_id,
      servico_nome: mapPorServico[key].servico_nome,
      quantidade_total: Number(mapPorServico[key].quantidade_total.toFixed(2)),
      valor_total: Number(mapPorServico[key].valor_total.toFixed(2))
    }))
    .sort((a, b) => b.valor_total - a.valor_total);

  const mapPorCliente = {};

  orcamentos.forEach((orcamento) => {
    const clienteId = String(orcamento.cliente_id || '');
    const key = clienteId || 'sem_cliente';

    if (!mapPorCliente[key]) {
      mapPorCliente[key] = {
        cliente_id: clienteId,
        cliente_nome: clienteNomes[clienteId] || 'Cliente removido',
        total_orcamentos: 0,
        valor_total: 0,
        valor_recebido: 0
      };
    }

    mapPorCliente[key].total_orcamentos += 1;
    mapPorCliente[key].valor_total += toNumber_(orcamento.total);
    mapPorCliente[key].valor_recebido += toNumber_((resumoFinanceiro[String(orcamento.id)] || {}).total_recebido);
  });

  const porCliente = Object.keys(mapPorCliente)
    .map((key) => ({
      cliente_id: mapPorCliente[key].cliente_id,
      cliente_nome: mapPorCliente[key].cliente_nome,
      total_orcamentos: mapPorCliente[key].total_orcamentos,
      valor_total: Number(mapPorCliente[key].valor_total.toFixed(2)),
      valor_recebido: Number(mapPorCliente[key].valor_recebido.toFixed(2)),
      ticket_medio: mapPorCliente[key].total_orcamentos
        ? Number((mapPorCliente[key].valor_total / mapPorCliente[key].total_orcamentos).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.valor_total - a.valor_total);

  return {
    resumo: resumo,
    por_servico: porServico,
    por_cliente: porCliente
  };
}

/**
 * Utilitarios de setup
 */

function setupSheets() {
  ensureRequiredSchema_();

  return 'Sheets configuradas com sucesso';
}

function seedAdminUser() {
  ensureRequiredSchema_();

  const usuario = 'admin';
  const senha = '123456';
  const nome = 'Administrador';

  const exists = findOne_(SHEETS.usuarios, 'usuario', usuario);
  if (exists) {
    return 'Usuario admin ja existe';
  }

  const row = {
    id: newId_(),
    usuario: usuario,
    senha_hash: hashPassword_(senha),
    nome: nome,
    ativo: true,
    criado_em: nowIso_()
  };

  appendObject_(SHEETS.usuarios, row);

  return 'Usuario inicial criado: admin / 123456';
}
