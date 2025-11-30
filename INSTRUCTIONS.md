# Instruções de Deploy - Spedito

O worker foi refatorado para o padrão Spedito (pt-BR).

## 1. Instalar Dependências
Na pasta do projeto, execute:
```bash
npm install
```

## 2. Criar KV Namespaces
Você precisa criar dois KV Namespaces no painel da Cloudflare ou via terminal:

```bash
npx wrangler kv:namespace create UsuariosSpedito
npx wrangler kv:namespace create SessoesSpedito
```

**Importante**: Copie os IDs gerados e atualize o arquivo `wrangler.jsonc`:
```jsonc
  "kv_namespaces": [
    {
      "binding": "UsuariosSpedito",
      "id": "SUBSTITUA_PELO_ID_USUARIOS"
    },
    {
      "binding": "SessoesSpedito",
      "id": "SUBSTITUA_PELO_ID_SESSOES"
    }
  ],
```

## 3. Configurar Segredos (AWS SES)
Configure as credenciais da AWS para envio de e-mail:

```bash
npx wrangler secret put AWS_ACCESS_KEY_ID
# Cole sua Access Key

npx wrangler secret put AWS_SECRET_ACCESS_KEY
# Cole sua Secret Key
```

## 4. Criar Usuário de Teste
Após o deploy (ou em dev), você pode criar um usuário inicial acessando a rota `/seed`:
`https://seu-worker.workers.dev/seed?email=seu.email@exemplo.com`

## 5. Rodar Localmente
```bash
npm run dev
```

## 6. Deploy
```bash
npm run deploy
```
