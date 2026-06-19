# Relatório da Etapa 8 - Auditoria e Observabilidade

## Resultado

O backend agora possui correlação de requisições, logs estruturados, auditoria persistente dos
eventos críticos, captura local de erros e healthcheck com verificação real do banco.

## Implementações

- logger JSON estruturado com `pino` e redação de campos sensíveis;
- `x-request-id` gerado ou validado em cada requisição;
- contexto assíncrono compartilhado com request ID, IP, rota e usuário;
- tabela `AuditLog` com índices por ação, usuário, request ID e data;
- auditoria de login, logout, logout global, importação, exclusão, alteração e redefinição de senha;
- auditoria de alteração de plano, mantendo também o histórico específico em `PlanAudit`;
- tabela `ErrorEvent` como alternativa local ao Sentry;
- captura de erros HTTP inesperados, falhas de inicialização, rejeições e exceções não tratadas;
- healthcheck do banco em `GET /health`, retornando `503` em falhas.

## Separação dos registros

- `AuditLog`: ações de negócio concluídas por usuários ou pelo sistema;
- `SecurityEvent`: tentativas suspeitas, bloqueios, rate limits e falhas de login;
- `PlanAudit`: histórico detalhado das alterações de plano;
- `ErrorEvent`: erros inesperados para investigação;
- logs do `pino`: telemetria operacional e duração das requisições.

## Segurança

O logger mascara senhas, tokens, cookies e autorização. Auditorias armazenam somente identificadores
e metadados necessários. Não devem ser adicionados dados sensíveis em `detailsJson`.

## Limitações e próximos passos

A alternativa local ao Sentry é adequada para o estágio atual, mas não oferece alertas externos,
agrupamento avançado ou retenção gerenciada. Antes da produção pública, integrar um serviço como
Sentry, configurar alertas e definir políticas automáticas de retenção para auditorias e erros.

Em produção com múltiplas instâncias, os logs do `pino` devem ser enviados para uma plataforma
centralizada, como Grafana Loki, Datadog ou equivalente.

## Validações executadas

- lint e build do backend e frontend;
- teste de integração entre frontend e backend;
- healthcheck com consulta ao banco e propagação de `x-request-id`;
- persistência de auditorias de login, logout, importação e exclusão;
- captura e persistência de erro pela alternativa local ao Sentry;
- auditoria de dependências de produção sem vulnerabilidades conhecidas de severidade alta.
