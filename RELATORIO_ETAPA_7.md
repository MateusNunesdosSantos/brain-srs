# Relatório da Etapa 7 - Banco de Dados Profissional

## Resultado

O estado da aplicação deixou de depender do campo JSON monolítico `UserState.stateJson`. O backend
agora lê e grava os dados ativos em tabelas relacionais isoladas por usuário.

## Estrutura criada

- `Notebook`, `Subject`, `Question` e `Alternative`;
- `Progress`, `ReviewLog` e `Cooldown`;
- `ReviewSession` e `ReviewSessionItem`;
- `CompletedDate` e `UserSettings`, necessárias para substituir todo o estado JSON.

As entidades do usuário possuem `userId` e índices apropriados. As exclusões relacionadas ao
usuário usam cascata.

## Migração

O backend executa `migrateLegacyUserStates()` durante a inicialização. Ela migra apenas usuários
que ainda não possuem estado relacional, tornando a operação repetível sem duplicar dados.

Dados migrados e validados:

- 11 estados legados;
- 19 cadernos;
- 13 matérias;
- 92 questões;
- 368 alternativas;
- 92 registros de progresso;
- 37 registros de revisão;
- 1 cooldown;
- 11 configurações de usuário.

A comparação automatizada dos 11 estados não encontrou divergências de quantidade ou configuração.
A tabela `UserState` foi mantida temporariamente como fonte de migração e rollback, mas não participa
mais das leituras e gravações normais.

## Decisão sobre SQLite e PostgreSQL

O SQLite permanece adequado enquanto o backend operar em uma única instância, com carga moderada e
backups controlados. Ele não deve ser a escolha final para produção pública com alta concorrência.

Migrar para PostgreSQL antes de qualquer um destes cenários:

- executar múltiplas instâncias do backend;
- precisar de alta disponibilidade e backups gerenciados;
- observar contenção por escritas concorrentes;
- aumentar significativamente o volume de usuários, revisões ou análises.

## Limitação conhecida

Para preservar compatibilidade com os contratos atuais, cada alteração grava novamente o estado
relacional completo do usuário dentro de uma única transação. Isso mantém consistência, mas deve ser
substituído gradualmente por operações relacionais específicas conforme a carga crescer.

## Validações executadas

- sincronização do schema Prisma com o SQLite;
- geração do Prisma Client;
- lint e build do backend;
- lint e build do frontend;
- comparação entre JSON legado e leitura relacional;
- teste de integração do frontend com o backend.
