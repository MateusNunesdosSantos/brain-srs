# Relatorio da Etapa 6 - Autorizacao e Planos

## Implementacoes

- Politica central de planos no backend.
- Bloqueio server-side para configuracoes SRS, estatisticas avancadas e vulnerabilidades Pro.
- Limites reais para criacao manual e importacao.
- Endpoint com plano atual, limites, recursos e consumo.
- Auditoria persistente de alteracoes de plano em `PlanAudit`.
- Mensagens claras ao atingir cada limite.

## Limites Free

| Recurso | Limite |
| --- | ---: |
| Cadernos | 3 |
| Materias | 15 |
| Questoes | 500 |
| Importacoes por dia | 3 |
| Questoes por importacao | 100 |
| Configuracao SRS personalizada | Nao |
| Estatisticas avancadas | Nao |
| Vulnerabilidades | Nao |

## Limites Pro

| Recurso | Limite |
| --- | ---: |
| Cadernos | 100 |
| Materias | 1.000 |
| Questoes | 50.000 |
| Importacoes por dia | 30 |
| Questoes por importacao | 5.000 |
| Configuracao SRS personalizada | Sim |
| Estatisticas avancadas | Sim |
| Vulnerabilidades | Sim |

## Endpoints

- `GET /api/plan`
- `GET /api/pro/stats`
- `GET /api/pro/vulnerabilities`

## Auditoria

Toda alteracao feita por `changeUserPlan` registra plano anterior, novo plano, responsavel, motivo e
data na tabela `PlanAudit`. A integracao de pagamento devera obrigatoriamente usar esse servico.
