# Roadmap Admin BrainSRS

Checklist da area administrativa segura para controle da plataforma SaaS.

Status atual: MVP administrativo funcional concluido. Itens avancados de seguranca e operacao foram movidos para backlog pos-MVP para nao misturar o que ja existe com o que ainda exige novas implementacoes.

## Decisao Arquitetural

Abordagem adotada para o estagio atual:

- [x] Manter no mesmo monorepo.
- [x] Criar area administrativa separada no frontend em `/admin`.
- [x] Proteger tudo no backend com RBAC.
- [x] Separar papeis administrativos dos planos `free/pro`.
- [x] Auditar acoes administrativas sensiveis.
- [x] Preparar o codigo para, no futuro, extrair o admin para uma aplicacao separada se necessario.

Nao foi criada uma aplicacao admin separada agora porque o projeto ainda esta em fase MVP. Separar neste momento aumentaria deploy, autenticacao, CORS, cookies, versionamento e manutencao sem ganho proporcional.

Separar o admin em outra aplicacao passa a fazer sentido quando houver:

- uso diario por equipe interna;
- dominio proprio como `admin.brainsrs.com`;
- exigencia de VPN, rede privada ou IP allowlist;
- deploy independente;
- integracoes internas sensiveis.

## Principios de Seguranca

- [x] Toda rota administrativa valida autorizacao no backend.
- [x] O admin nao depende de `user.plan`.
- [x] Existem papeis separados: usuario comum, `support`, `admin` e `owner`.
- [x] Admin exige e-mail verificado.
- [x] Acoes administrativas sensiveis exigem motivo.
- [x] Acoes destrutivas exigem confirmacao explicita.
- [x] Admin nao recebe senha, hash, salt ou tokens sensiveis nas respostas.
- [x] Dados de usuarios sao minimizados nas listagens.
- [ ] MFA para admins. Backlog pos-MVP.
- [ ] Reautenticacao por senha para acoes de alto risco. Backlog pos-MVP.

## Etapa 0 - Escopo e Modelo de Permissoes

- [x] Definir matriz de permissoes administrativas.
- [x] Separar papeis de admin de planos `free/pro`.
- [x] Definir papeis iniciais: `support`, `admin`, `owner`.
- [x] Definir quais acoes cada papel pode executar.
- [x] Definir politica para primeiro usuario `owner` em ambiente local.
- [x] Definir quais dados sensiveis nunca aparecem no painel.

Status: concluida.

## Etapa 1 - Banco e Backend de Autorizacao

- [x] Adicionar campos `adminRole` e `adminEnabled` no usuario.
- [x] Criar migracao/bootstrap seguro para usuarios existentes.
- [x] Criar helper `requireAdmin`.
- [x] Criar controle de permissao por papel.
- [x] Bloquear admin para usuarios sem e-mail verificado.
- [x] Criar endpoint `GET /api/admin/me`.
- [x] Registrar tentativas negadas em `SecurityEvent`.
- [x] Garantir owner local `mateusnunescontas@gmail.com`.

Status: concluida.

## Etapa 2 - Auditoria Administrativa

- [x] Criar tabela `AdminAuditLog`.
- [x] Registrar `adminUserId`.
- [x] Registrar `targetUserId` quando houver usuario alvo.
- [x] Registrar acao, motivo, IP, user-agent e `requestId`.
- [x] Auditar login em area admin.
- [x] Auditar visualizacao de detalhes de usuario.
- [x] Auditar alteracoes de plano.
- [x] Auditar cancelamento de plano.
- [x] Auditar alteracao de papel administrativo.
- [x] Auditar encerramento de sessoes.
- [x] Auditar reenvio de verificacao de e-mail.
- [x] Auditar exclusao de conta.
- [x] Auditar troca de senha de usuario pelo admin.

Status: concluida.

## Etapa 3 - Rotas Admin no Backend

- [x] Criar namespace `/api/admin`.
- [x] Criar listagem paginada de usuarios.
- [x] Criar busca por nome/e-mail.
- [x] Criar detalhe seguro de usuario.
- [x] Criar listagem de sessoes do usuario alvo.
- [x] Criar listagem de eventos de seguranca.
- [x] Criar listagem de auditorias.
- [x] Criar metricas gerais da plataforma.
- [x] Aplicar rate limit especifico para rotas admin.
- [x] Criar endpoint para alterar plano.
- [x] Criar endpoint para cancelar plano.
- [x] Criar endpoint para alterar papel admin.
- [x] Criar endpoint para encerrar sessoes.
- [x] Criar endpoint para reenviar verificacao.
- [x] Criar endpoint para excluir conta.
- [x] Criar endpoint para trocar senha de usuario.

Status: concluida.

## Etapa 4 - Interface Admin Inicial

- [x] Criar rota `/admin`.
- [x] Criar layout administrativo separado do app do estudante.
- [x] Criar protecao visual para usuarios sem permissao.
- [x] Criar dashboard administrativo.
- [x] Criar tabela de usuarios.
- [x] Destacar conta selecionada na tabela.
- [x] Criar painel de detalhes e acoes do usuario.
- [x] Criar tela para alterar a propria senha admin.
- [x] Criar tela visual de auditoria com resumo e tabela.
- [x] Criar tela visual de eventos de seguranca com resumo e tabela.
- [x] Criar tela visual de relatorios com resumo e metricas.
- [x] Criar estados de loading, erro e vazio nas telas principais.
- [x] Corrigir textos quebrados por encoding na area admin.

Status: concluida.

## Etapa 5 - Gestao de Usuarios

- [x] Alterar plano de usuario com motivo obrigatorio.
- [x] Cancelar plano Pro e mostrar feedback de plano cancelado.
- [x] Encerrar todas as sessoes de um usuario.
- [x] Reenviar verificacao de e-mail.
- [x] Trocar senha de usuario pelo admin.
- [x] Excluir conta com confirmacao explicita `EXCLUIR`.
- [x] Impedir autoexclusao de conta administrativa.
- [x] Impedir auto-rebaixamento perigoso de owner.
- [x] Confirmar acoes criticas com modal e texto explicito.
- [x] Bloquear conta temporariamente por 30 dias e encerrar sessoes.
- [x] Desbloquear conta.
- [x] Marcar/remover usuario para revisao manual.

Status: MVP concluido. Bloqueio/revisao manual ficam para fase posterior.

## Etapa 6 - Gestao de Conteudo e Suporte

- [x] Visualizar contagem de cadernos, materias e questoes por usuario.
- [x] Ver estatisticas agregadas sem expor conteudo desnecessario.
- [x] Exibir sessoes, eventos e auditorias relacionadas ao usuario no backend.
- [x] Criar notas internas de suporte por usuario.
- [ ] Criar historico de contatos/suporte. Backlog pos-MVP.
- [ ] Permitir exportacao segura de dados do usuario para suporte. Backlog pos-MVP.
- [ ] Criar fluxo formal para solicitacao de exclusao de conta. Backlog pos-MVP.

Status: MVP concluido para suporte basico. Recursos de CRM/suporte ficam para fase posterior.

## Etapa 7 - Seguranca Avancada do Admin

- [x] RBAC aplicado no backend.
- [x] Rate limit especifico em `/api/admin`.
- [x] Registro de tentativas negadas.
- [x] Motivo obrigatorio nas acoes sensiveis.
- [x] Confirmacao textual para exclusao.
- [x] Owner protegido contra autoacoes perigosas.
- [ ] Implementar MFA para admins. Backlog pos-MVP prioritario.
- [ ] Criar sessao administrativa separada ou reautenticacao para acoes criticas. Backlog pos-MVP prioritario.
- [ ] Adicionar allowlist de IP opcional em producao. Backlog pos-MVP.
- [ ] Adicionar timeout menor para sessao admin. Backlog pos-MVP.
- [ ] Exigir confirmacao de senha para acoes de alto risco. Backlog pos-MVP.
- [ ] Adicionar alertas para acoes criticas. Backlog pos-MVP.
- [ ] Criar bloqueio automatico por comportamento suspeito. Backlog pos-MVP.

Status: baseline segura concluida para MVP. Hardening avancado ainda pendente para producao madura.

## Etapa 8 - Observabilidade e Relatorios

- [x] Criar metricas de usuarios.
- [x] Criar metricas Free/Pro.
- [x] Criar metricas de importacoes.
- [x] Criar metricas de erros.
- [x] Criar relatorio visual de seguranca.
- [x] Criar relatorio visual de auditoria.
- [x] Criar relatorio visual de operacao.
- [x] Criar metricas de cadastros do mes.
- [x] Criar exportacao CSV para relatorios administrativos.
- [ ] Criar healthcheck visual dedicado no admin. Backlog pos-MVP.

Status: concluida para MVP.

## Etapa 9 - Testes e Hardening

- [x] Validar build/lint do frontend admin.
- [x] Validar TypeScript do backend durante as etapas anteriores.
- [x] Testar fluxo de troca de senha de usuario em validacao local anterior.
- [x] Conferir que dados sensiveis como senha/hash/salt/tokens nao sao expostos na UI admin.
- [ ] Criar suite automatizada cobrindo usuario comum sem acesso a `/api/admin`.
- [ ] Criar suite automatizada cobrindo Free/Pro sem role admin.
- [ ] Criar suite automatizada de permissoes por papel.
- [ ] Testar CSRF nas mutacoes admin.
- [ ] Testar paginacao e limites.
- [ ] Testar auditoria obrigatoria em acoes criticas.
- [ ] Revisar logs para garantir que tokens/senhas nunca aparecem.

Status: validacao manual/build concluida. Suite automatizada fica como backlog necessario antes de producao real.

## Criterio Atual de MVP Admin

- [x] Rota `/admin` existe.
- [x] Login admin funcional.
- [x] Owner local configurado.
- [x] RBAC aplicado no backend.
- [x] Dashboard admin funcional.
- [x] Gestao basica de usuarios funcional.
- [x] Cancelamento de plano funcional.
- [x] Exclusao de conta com confirmacao funcional.
- [x] Troca de senha propria e de usuarios funcional.
- [x] Auditoria visual funcional.
- [x] Seguranca visual funcional.
- [x] Relatorios visuais funcionais.
- [x] Frontend admin passa em `npm run check`.

Status: MVP admin finalizado.

## Criterio Para Producao Madura

- [ ] MFA ativo para admins.
- [ ] Reautenticacao obrigatoria para acoes criticas.
- [ ] Testes automatizados de autorizacao e permissoes.
- [ ] Alertas configurados para acoes criticas.
- [ ] Backups ativos antes de permitir acoes destrutivas em producao.
- [ ] Politica de retencao de auditoria definida.
- [ ] Owner inicial definido por processo seguro de deploy, nao por bootstrap fixo.
- [ ] Revisao de seguranca externa ou checklist OWASP antes de uso com clientes reais.
