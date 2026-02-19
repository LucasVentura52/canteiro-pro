# Canteiro Pro (Vue 3 + Vuetify + Google Sheets)

Sistema mobile-first para criar orçamentos, guardar histórico e visualizar relatórios de obras.

## O que este MVP entrega

- Login com usuario/senha (hash + token com expiracao)
- Cadastro de clientes
- Cadastro de servicos
- Edicao de clientes + exclusao segura (soft delete)
- Edicao de servicos + controle de ativo/inativo + exclusao segura
- Criacao de orcamento com itens e calculo automatico
- Historico de orcamentos com filtro por mes/status
- Detalhe de orcamento com itens
- Duplicacao de orcamento para novo rascunho
- Compartilhamento rapido de orcamento por WhatsApp
- Controle de recebimentos por orcamento (registrar, listar, remover/restaurar com soft delete)
- Atualizacao de status (rascunho/aprovado/recusado)
- Relatorio mensal com resumo, faturamento por servico, por cliente e visao de recebimentos
- PWA para usar no celular como app instalado
- Cache local com fallback para leitura em caso de instabilidade de internet
- Rascunho automatico de novo orcamento (restauracao local)

## Arquitetura

- Frontend: Vue 3 + Vuetify + Vite + PWA
- Backend: Google Apps Script (Web App)
- Banco: Google Sheets (abas separadas por entidade)

Fluxo:

`App no celular -> Apps Script (API) -> Google Sheets`

## Estrutura do projeto

- `src/`: app Vue
- `apps-script/Code.gs`: backend da API para colar no Apps Script
- `public/icons`: icones do PWA

## 1) Frontend (Vue)

### Requisitos

- Node 20+
- npm

### Configuracao

1. Instale dependencias:

```bash
npm install
```

2. Crie o `.env` com base no exemplo:

```bash
cp .env.example .env
```

3. Preencha `VITE_SHEETS_API_URL` com a URL do seu Web App do Apps Script.

4. Rode o projeto:

```bash
npm run dev
```

5. Build de producao:

```bash
npm run build
```

## 2) Backend (Google Apps Script + Sheets)

### Passo A - Criar planilha

Crie uma planilha Google vazia (Google Sheets).

### Passo B - Colar o backend

1. Na planilha, abra `Extensoes -> Apps Script`.
2. Substitua o conteudo de `Code.gs` pelo arquivo local `apps-script/Code.gs`.
3. Salve.

### Passo C - Criar abas/cabecalhos automaticamente

No editor do Apps Script, execute a funcao:

- `setupSheets()`

Ela cria (ou ajusta) as abas:

- `usuarios`
- `clientes`
- `servicos`
- `orcamentos`
- `orcamento_itens`
- `recebimentos`

### Passo D - Criar usuario inicial

Execute a funcao:

- `seedAdminUser()`

Credencial padrao criada:

- usuario: `admin`
- senha: `123456`

Troque depois para uma senha forte.

### Passo E - Publicar Web App

1. `Implantar -> Nova implantacao`
2. Tipo: `App da Web`
3. Executar como: `Voce`
4. Quem tem acesso: `Qualquer pessoa com o link`
5. Implantar e copiar URL final `/exec`

Use essa URL no `.env` do frontend.

## Rotas da API

Publicas:

- `GET ?route=health`
- `POST ?route=health`
- `POST ?route=auth/login`
- `POST ?route=auth/register` (opcional)

Protegidas:

- `GET|POST ?route=auth/me`
- `POST ?route=auth/logout`
- `GET|POST ?route=clientes/list`
- `POST ?route=clientes/create`
- `POST ?route=clientes/update`
- `POST ?route=clientes/toggle`
- `GET|POST ?route=servicos/list`
- `POST ?route=servicos/create`
- `POST ?route=servicos/update`
- `POST ?route=servicos/toggle`
- `GET|POST ?route=orcamentos/list&mes=YYYY-MM&status=...`
- `GET|POST ?route=orcamentos/detail&id=...`
- `POST ?route=orcamentos/create`
- `POST ?route=orcamentos/update-status`
- `GET|POST ?route=recebimentos/list&orcamento_id=...`
- `POST ?route=recebimentos/create`
- `POST ?route=recebimentos/toggle`
- `GET|POST ?route=relatorios/mensal&ano=YYYY&mes=MM`

Token pode ser enviado em:

- query: `auth`, `token`, `access_token`
- body JSON: `auth`, `token`, `access_token`

## Observacoes tecnicas

- O frontend usa `POST` com `Content-Type: text/plain` para reduzir problemas de CORS/preflight no Apps Script.
- Para evitar falhas intermitentes de autenticacao em alguns ambientes, as leituras autenticadas do app usam `POST` (token no body) em vez de depender de `GET` com token na URL.
- O cliente HTTP aplica timeout + retry com backoff para erros de rede/transientes.
- Em falta de conexao, o app pode exibir dados de cache local e sinaliza isso na interface.
- Token de sessao expira em 12 horas.
- Senha salva em hash com salt (`SHA-256 + salt`).

## Proximas evolucoes naturais

1. Exportacao de orcamento em PDF com compartilhamento por WhatsApp.
2. Modo offline com rascunho local (IndexedDB) + sincronizacao.
3. Controle de materiais por tipo de servico.
4. Multiusuario (equipe de obra) com permissao por perfil.
