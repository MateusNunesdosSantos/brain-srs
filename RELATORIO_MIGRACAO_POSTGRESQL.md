# Relatorio de migracao para PostgreSQL

## Resultado

- Banco de destino: PostgreSQL local, banco `brainsrs`, schema `public`.
- Banco de origem preservado como backup em `backend/prisma/data/`.
- Schema gerenciado pelo Prisma, com migration baseline em
  `backend/prisma/migrations/20260608230000_postgresql_baseline/`.
- Bootstrap SQL exclusivo de SQLite removido do backend.
- Importacao executada em uma transacao para evitar dados parciais.

## Dados migrados

- 7 usuarios
- 14 cadernos
- 13 materias
- 92 questoes
- 368 alternativas
- 92 registros de progresso
- 46 respostas no historico
- sessoes, configuracoes, cooldowns e auditorias

Todas as 26 tabelas apresentaram contagens iguais entre o snapshot SQLite e o PostgreSQL.
No primeiro boot, a rotina de protecao contra abuso removeu 3 buckets de rate limit expirados,
como esperado.

## Otimizacoes aplicadas

- Indices por usuario e por campos usados em filtros de revisao.
- Indices compostos para relatorios por acao/data e materia/data.
- Indices administrativos para plano, bloqueio e revisao manual.
- Chaves estrangeiras com exclusao em cascata ou `SET NULL` nos relacionamentos Prisma.
- Migration baseline reproduzivel para novos ambientes.

## Operacao

```bash
cd backend
npm run prisma:deploy
npm run data:validate
npm run check
```

O arquivo `.env.example` contem apenas uma URL de exemplo. A senha local real permanece somente
no `.env`, que nao deve ser versionado.
