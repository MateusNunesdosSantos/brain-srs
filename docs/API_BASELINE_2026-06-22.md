# Baseline local da API - 2026-06-22

Ambiente:

- Backend local: `http://localhost:3001`
- Banco: configuracao local do `backend/.env`
- Usuario temporario criado via `POST /api/auth/register`
- Medicao feita com PowerShell `Invoke-WebRequest`

Resultados:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/auth/register` | 200 | 1519 ms | 661 bytes |
| `GET /api/state` | 200 | 236 ms | 582 bytes |
| `GET /api/plan` | 200 | 381 ms | 257 bytes |
| `GET /api/catalog` | 200 | 444 ms | 6312 bytes |
| `POST /api/actions` (`addNotebook`) | 200 | 1106 ms | 691 bytes |

Notas:

- Esta medicao usa conta nova com estado pequeno; usuarios reais com muitas questoes devem ser medidos separadamente.
- `GET /api/catalog` ainda e o maior payload nesta amostra.
- `POST /api/actions` retorna estado atualizado; usuarios com bibliotecas grandes devem ter payload maior.

## Conta sintetica com 100 questoes

Antes da escrita pontual para caderno/materia:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q` | 200 | 1096 ms | 64652 bytes |
| `GET /api/state 100q` | 200 | 258 ms | 73352 bytes |
| `POST /api/actions updateNotebook 100q` | 200 | 1455 ms | 73372 bytes |

Depois da escrita pontual para `add/update notebook` e `add/update subject`:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q` | 200 | 1599 ms | 64654 bytes |
| `GET /api/state 100q` | 200 | 332 ms | 73354 bytes |
| `POST /api/actions updateNotebook 100q targeted` | 200 | 503 ms | 73374 bytes |

Resultado observado:

- A edicao simples de caderno caiu de 1455 ms para 503 ms na medicao local.
- O payload continua praticamente igual, porque a API ainda retorna `state` completo para compatibilidade.
- O proximo ganho maior depende de reduzir resposta de `POST /api/actions` para patch/retorno parcial com compatibilidade planejada.

## Escrita pontual para questoes

Depois de adicionar escrita pontual para `addQuestion` e `updateQuestion`:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q` | 200 | 1985 ms | 87050 bytes |
| `GET /api/state 100q` | 200 | 463 ms | 95750 bytes |
| `POST /api/actions updateQuestion 100q targeted` | 200 | 848 ms | 95770 bytes |

Nota:

- A resposta ainda inclui `state` completo, entao o tamanho continua dominante.
- A escrita no banco deixou de regravar toda a biblioteca para edicoes simples de pergunta.

## Resposta parcial opt-in para `POST /api/actions`

Depois de adicionar `X-BrainSRS-State-Mode: patch` no frontend:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q full` | 200 | 1827 ms | 64644 bytes |
| `GET /api/state 100q` | 200 | 379 ms | 73344 bytes |
| `POST /api/actions updateNotebook 100q patch` | 200 | 543 ms | 491 bytes |
| `POST /api/actions updateQuestion 100q patch` | 200 | 661 ms | 828 bytes |

Resultado observado:

- `updateNotebook` caiu de ~73 KB para 491 bytes de resposta.
- `updateQuestion` caiu de ~95 KB para 828 bytes de resposta.
- Clientes antigos continuam recebendo `state` completo quando nao enviam o header de patch.

## Patches parciais para sessao de revisao

Depois de habilitar resposta parcial para `startReview`, `completeReview` e `abandonReview`:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q full` | 200 | 1884 ms | 64658 bytes |
| `GET /api/state 100q` | 200 | 362 ms | 73358 bytes |
| `POST /api/actions startReview 20q patch` | 200 | 788 ms | 2119 bytes |
| `POST /api/actions abandonReview patch` | 200 | 507 ms | 405 bytes |
| `POST /api/actions answer patch` | 200 | 925 ms | 1936 bytes |

Nota:

- `startReview` retorna `activeReviewSession` parcial em vez do estado completo.
- `abandonReview` retorna apenas o estado parcial necessario para limpar a sessao ativa.
- `answer` retorna patches de progresso, logs, cooldown e sessao ativa.

## Escrita pontual para delecoes

Depois de adicionar escrita pontual e patch para delecoes:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions import 100q full` | 200 | 1740 ms | 57552 bytes |
| `GET /api/state 100q` | 200 | 397 ms | 66252 bytes |
| `POST /api/actions deleteQuestion patch` | 200 | 824 ms | 653 bytes |

Nota:

- `deleteQuestion`, `deleteSubject` e `deleteNotebook` nao regravam mais estado inteiro no DB.
- Patch remove conteudo dependente no cliente: questions/progress/logs/cooldown e filhos de subject/notebook.

## Escrita pontual para `importQuestions`

Depois de adicionar escrita pontual e patch para `importQuestions`:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `POST /api/actions importQuestions 50q patch` | 200 | 896 ms | 24659 bytes |

Nota:

- `importQuestions` cria só novas questions/alternatives/progress no DB.
- Patch retorna somente novas questoes e progress, nao estado completo.

## Baseline de catálogo, desafios e admin

Coletado em 2026-06-23 com o script de medição automatizada:

| Rota | Status | Duracao | Tamanho |
| --- | ---: | ---: | ---: |
| `GET /api/catalog` | 200 | 275 ms | 6312 bytes |
| `GET /api/challenges` | 200 | 206 ms | 17 bytes |
| `GET /api/admin/overview` | 200 | 376 ms | 175 bytes |
| `GET /api/admin/security-events` | 200 | 936 ms | 8689 bytes |
| `GET /api/admin/audit-logs` | 200 | 475 ms | 29679 bytes |

Nota:
- Os endpoints de admin `/security-events` e `/audit-logs` já utilizam a paginação com limite de registros configurado (Páginas de 40 e 30 itens, respectivamente).
