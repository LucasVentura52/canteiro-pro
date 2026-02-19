# Planilha Google - Modelo Inicial

Arquivos CSV desta pasta (abas):

- usuarios.csv
- clientes.csv
- servicos.csv
- orcamentos.csv
- orcamento_itens.csv

## Como importar no Google Sheets

1. Crie uma planilha Google vazia.
2. Renomeie a primeira aba para `usuarios`.
3. Em `Arquivo > Importar > Upload`, envie `usuarios.csv` e escolha `Substituir dados na aba atual`.
4. Crie novas abas com os nomes:
   - `clientes`
   - `servicos`
   - `orcamentos`
   - `orcamento_itens`
5. Em cada aba, importe o CSV correspondente com `Substituir dados na aba atual`.

## Depois da importacao

- Cole `apps-script/Code.gs` no Apps Script da planilha.
- Execute a funcao `seedAdminUser()` para criar o login inicial:
  - usuario: `sogro`
  - senha: `123456`

Se preferir, em vez de importar CSV, voce pode apenas executar `setupSheets()` no Apps Script para criar todas as abas automaticamente.
