# Relatorio da Etapa 4 - Rate Limit e Protecao Contra Abuso

## Implementacoes

- Rate limit persistente usando SQLite.
- Limite de login por IP e por e-mail.
- Bloqueio temporario de conta ao exceder tentativas por e-mail.
- Limite de criacao de contas por IP.
- Limite diario de importacoes por usuario.
- Limite de questoes por arquivo importado, separado por plano.
- Registro persistente de eventos suspeitos em `SecurityEvent`.
- Identificadores de e-mail e sujeitos do rate limit armazenados como SHA-256.
- Limpeza automatica de buckets expirados e eventos com mais de 90 dias.

## Limites do Plano Free

| Recurso | Limite |
| --- | ---: |
| Cadernos totais | 3 |
| Materias totais | 15 |
| Questoes totais | 500 |
| Importacoes por dia | 3 |
| Questoes por arquivo importado | 100 |

Esses valores permitem testar o produto de forma util, criar mais de uma area de estudo e manter
uma rotina real de revisao. Ao mesmo tempo, controlam armazenamento, abuso de importacao e criam
uma diferenca clara para o plano Pro.

## Limites de Seguranca

| Acao | Limite |
| --- | ---: |
| Login por IP | 20 a cada 15 minutos |
| Login por e-mail | 8 a cada 15 minutos |
| Bloqueio temporario | 30 minutos |
| Cadastro por IP | 5 a cada 60 minutos |

## Limitacoes Atuais

- O rate limit persistente em SQLite funciona corretamente para uma unica instancia do backend.
- Para executar varias instancias simultaneas, deve ser migrado para Redis, Upstash ou equivalente.
- Os limites de criacao manual e importacao foram consolidados na Etapa 6.
- A tela administrativa para consultar eventos suspeitos ainda nao existe.
