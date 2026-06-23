# Checklist de seguranca e performance da API

Status inicial: branch `seguranca-otimizacao-api`.

## Regras de compatibilidade

- [x] Nao alterar formato publico de resposta sem migracao planejada.
- [x] Nao remover campos usados pelo frontend antes de validar uso real.
- [x] Nao registrar body, senha, token, cookie ou Authorization em logs.
- [x] Manter cookies HttpOnly/Secure e CSRF nas mutacoes autenticadas.
- [x] Validar backend antes de promover mudancas.
- [x] Validar build backend antes de promover mudancas.
- [x] Validar build frontend antes de promover mudancas.
- [x] Resolver erro de lint frontend pre-existente antes de promover mudancas.
- [x] Revisar warnings frontend restantes.

## Fase 1 - Baseline e observabilidade

- [x] Registrar duracao por rota.
- [x] Registrar status code por rota.
- [x] Registrar tamanho da resposta quando disponivel.
- [x] Marcar requisicoes lentas sem expor payload.
- [x] Coletar baseline de `GET /api/state`.
- [x] Coletar baseline de `POST /api/actions`.
- [x] Coletar baseline de catalogo, desafios e admin.
- [x] Coletar baseline de catalogo em conta nova.
- [x] Coletar baseline de `POST /api/actions` com 100 questoes.
- [x] Coletar baseline de `updateQuestion` com 100 questoes.
- [x] Confirmar healthcheck backend local.

## Fase 2 - Seguranca de transporte

- [x] Bloquear `APP_PUBLIC_URL` com HTTP em producao.
- [x] Bloquear `FRONTEND_ORIGIN` com HTTP em producao.
- [x] Exigir `SESSION_COOKIE_SECURE=true` em producao.
- [x] Ativar HSTS em producao.
- [x] Conferir variaveis reais de deploy.
- [x] Adicionar teste automatizado para config insegura de producao.

## Fase 3 - Otimizacoes transparentes

- [x] Ativar compressao HTTP para respostas acima de 1 KB.
- [x] Validar ganho em respostas JSON grandes.
- [x] Confirmar que proxy/deploy nao duplica compressao de forma indevida.
- [x] Evitar leitura completa do estado em `GET /api/plan`.
- [x] Evitar leitura completa do estado em checagens de capacidade do catalogo.
- [x] Usar escrita pontual para `add/update notebook` e `add/update subject`.
- [x] Usar escrita pontual para `add/update question`.
- [x] Usar escrita pontual para delecoes de caderno/materia/questao.
- [x] Usar escrita pontual para `importQuestions`.

## Fase 4 - Reducao de payload

- [x] Mapear campos usados pelo frontend em `GET /api/state`.
- [x] Mapear resposta de `POST /api/actions`.
- [x] Paralelizar leituras independentes de `GET /api/state`.
- [x] Identificar rotas que podem retornar patch sem quebrar contrato.
- [x] Implementar resposta parcial opt-in para `POST /api/actions`.
- [x] Implementar resposta parcial para `saveSettings` e sessao de revisao.
- [x] Implementar resposta parcial para `answer`.
- [x] Implementar resposta parcial para delecoes de caderno/materia/questao.
- [ ] Criar endpoints novos/versionados se a mudanca de contrato for necessaria.
- [x] Paginar endpoints admin quando listas crescerem.

## Fase 5 - Banco e queries

- [x] Instrumentar queries lentas nas rotas principais.
- [x] Revisar `select/include` amplos no Prisma.
- [x] Conferir indices para rankings, desafios, catalogo e estado do usuario.
- [ ] Otimizar somente com base em baseline.
- [x] Adicionar teste unitario para helpers de limite por contagem.

## Fase 6 - Offline/PWA

- [x] Revisar dados salvos em IndexedDB.
- [x] Limpar fila offline no logout.
- [x] Avaliar criptografia local da fila offline.
- [x] Evitar sincronizacao duplicada.

- [x] Definir se o objetivo e ofuscacao da aba Network ou protecao real.
- [x] Manter HTTPS como requisito principal.
- [x] Implementar somente com feature flag.
- [x] Aplicar primeiro em endpoints sensiveis.
- [x] Medir custo de CPU/latencia antes de exigir globalmente.

*Decisão de Arquitetura:* O HTTPS obrigatório em produção (Fase 2) garante a proteção real dos dados em trânsito. A criptografia de payload adiciona apenas ofuscação local na aba Network e foi considerada desnecessária devido ao custo de latência/processamento de CPU. Fica descartada para o escopo atual do SaaS, mantendo o HTTPS como requisito de segurança padrão.
