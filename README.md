# BrainSRS

Projeto separado em dois diretórios independentes: frontend Next.js e backend Node.js/TypeScript.

## Estrutura

```text
frontend/  Next.js, React, Tailwind e aplicacao web responsiva
backend/   Express, Prisma, PostgreSQL e API HTTP
```

O frontend não acessa o banco diretamente. Ele consome o backend por HTTP usando
`NEXT_PUBLIC_API_BASE_URL`.

## Executar Localmente

Requer Node.js 22 ou superior.

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

URLs padrão:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:3001
Health:   http://localhost:3001/health
```

Conta local de teste:

```text
E-mail: mateusnunesmds@gmail.com
Senha: 123
```

Essa senha curta existe apenas para teste local.

## Backend

O backend fica em `backend/` e usa:

- Node.js + TypeScript
- Express
- Prisma
- PostgreSQL
- Zod para validação
- Sessões persistidas no banco
- Cookies `HttpOnly` para web
- `Authorization: Bearer` para clientes externos ou futuros clientes de API

Endpoints principais:

```text
GET  /health
GET  /api/state
POST /api/actions
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/onboarding
```

Configuração local do backend:

```text
backend/.env
```

Exemplo:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/brainsrs?schema=public"
BACKEND_PORT="3001"
FRONTEND_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
SESSION_COOKIE_SECURE="false"
```

O PostgreSQL local usa o banco `brainsrs`. O backup do SQLite anterior permanece em
`backend/prisma/data/` apenas para recuperação e auditoria da migração.

## Prisma

O schema está em:

```text
backend/prisma/schema.prisma
```

Comandos:

```bash
cd backend
npm run prisma:generate
npm run prisma:deploy
```

O schema é criado e atualizado pelas migrations do Prisma.

## Frontend

O frontend fica em `frontend/`.

Comandos:

```bash
cd frontend
npm run dev
npm run build
```

Em desenvolvimento, o frontend usa `http://localhost:3001` como backend padrão. Para outro backend:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="https://api.seudominio.com"
npm run dev
```

## Mobile

Nao existe modulo mobile nativo ativo neste repositorio. A antiga integracao com
Capacitor e a pasta `mobile/` foram removidas; o produto atual deve ser tratado
como aplicacao web responsiva/PWA.

## Segurança Atual

Já existe:

- isolamento por usuário no backend;
- validação Zod em todas as ações principais;
- senha com salt individual e `scrypt`;
- sessão armazenada no PostgreSQL;
- cookie `HttpOnly` na web;
- token Bearer para clientes de API;
- CORS configurável por `FRONTEND_ORIGIN`;
- rate limit simples para login/cadastro.

Antes de produção pública, ainda precisa:

- HTTPS obrigatório;
- rate limit robusto com Redis ou serviço externo;
- refresh token rotativo para futuros clientes externos;
- proteção CSRF se cookies forem usados em produção;
- headers de segurança;
- reset de senha por email;
- verificação de email;
- logs/auditoria;
- backups automáticos;
- backup automatizado, monitoramento e alta disponibilidade do PostgreSQL.

## Verificar

```bash
cd backend
npm run lint
npm run build

cd ../frontend
npm run lint
npm run build
npm run test:backend
```

Para testes de UI, suba frontend e backend antes:

```bash
cd backend
npm run dev

cd ../frontend
npm run dev
npm run test:ui
npm run test:library
npm run test:review-filter
npm run test:theme
```
