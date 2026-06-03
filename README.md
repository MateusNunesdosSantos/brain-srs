# BrainSRS

Aplicação Next.js para estudo com repetição espaçada, autenticação e persistência SQLite local.

## Executar

Requer Node.js 22 ou superior.

```bash
npm install
npm run dev
```

A aplicação inicia em `http://localhost:3000`. O banco é criado automaticamente em
`data/brainsrs.sqlite`. Os dados existentes são vinculados à conta local de teste:

```text
E-mail: mateusnunesmds@gmail.com
Senha: 123
```

Essa senha curta existe apenas para testes locais. Novas contas exigem pelo menos seis caracteres.

## Backend local

O backend usa Route Handlers do Next.js e o módulo nativo `node:sqlite`, sem serviço externo ou
dependência de banco adicional.

- `POST /api/auth/register`: cria uma conta e inicia uma sessão.
- `POST /api/auth/login`: valida as credenciais e inicia uma sessão.
- `POST /api/auth/logout`: encerra a sessão atual.
- `POST /api/auth/onboarding`: marca o tour inicial como concluído.
- `GET /api/state`: retorna o snapshot consolidado do usuário autenticado.
- `POST /api/actions`: executa mutações persistentes do usuário autenticado.

As sessões usam cookies `HttpOnly`, expiram em 30 dias e são armazenadas no SQLite. As senhas são
armazenadas com salt individual e derivação `scrypt`.

## Planos e Primeiro Acesso

Novas contas começam no plano Free e são direcionadas automaticamente para a Biblioteca no primeiro
acesso. Um tour explica como criar cadernos, matérias e questões e pode ser concluído ou pulado.
Essa escolha é persistida na conta.

- Free: biblioteca, revisões, simulados e configurações.
- Pro: inclui Estatísticas e Vulnerabilidades.

As ações disponíveis cobrem importação confirmada, criação de cadernos, matérias e questões,
registro de respostas, sessões persistentes de revisão e configuração do algoritmo. Payloads
recebidos pela API são validados com Zod antes de chegar ao banco.

O cálculo de estabilidade, dificuldade, jitter, cooldown e `next_review` ocorre no servidor. Cada
resposta recebe uma chave idempotente para impedir duplicação em retries HTTP. Uma resposta somente
é aceita quando pertence a uma sessão ativa de revisão criada pelo servidor.

## Schema SQLite

- `notebooks`
- `subjects`
- `questions`
- `alternatives`
- `progress`
- `review_logs`
- `cooldown`
- `completed_dates`
- `srs_settings`
- `users`
- `sessions`
- `review_sessions`
- `review_session_items`
- `database_meta`

O schema usa foreign keys, índices para consultas frequentes e WAL para permitir leituras durante
gravações. Cadernos, matérias, questões, progresso, logs e configurações são isolados por usuário.

O banco mantém `schema_version` em `database_meta`; antes de aplicar uma nova versão de schema, a
aplicação cria um backup em `data/backups`.

## Configurações de Revisão

A rota `http://localhost:3000/configuracoes` permite ajustar os parâmetros usados nas próximas
respostas:

- cooldown mínimo e máximo após erro;
- intervalo após o primeiro acerto;
- multiplicador dos intervalos após os próximos acertos.

Os valores são persistidos na tabela `srs_settings`. Revisões já agendadas não são reescritas
automaticamente.

## Verificar

```bash
npm run lint
npm run build
npm test
npm run test:backend
npm run test:ui
npm run test:library
npm run test:review-filter
npm run test:theme
```

## Próximos Incrementos

Antes de publicar:

1. Migrar o scheduler simplificado para uma implementação FSRS completa e testada.
2. Implementar cron de notificações.
3. Migrar para PostgreSQL se houver múltiplas instâncias ou alta concorrência.
