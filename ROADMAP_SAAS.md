# Roadmap SaaS BrainSRS

Checklist incremental para transformar o BrainSRS em um SaaS profissional e seguro.

## Etapa 0 - Base Atual

- [x] Separar `frontend/` e `backend/`.
- [x] Fazer frontend e backend funcionarem de forma independente.
- [x] Usar SQLite inicialmente e migrar o backend para PostgreSQL.
- [x] Criar backend Node.js com TypeScript.
- [x] Adicionar Prisma no backend.
- [x] Manter autenticação básica com sessão.
- [x] Criar conta de teste local.
- [x] Validar build do frontend.
- [x] Validar build do backend.

## Etapa 1 - Higiene do Projeto

- [x] Criar `.env.example` completo para frontend.
- [x] Revisar `.gitignore` para ignorar bancos, logs, builds e `.env`.
- [x] Remover qualquer dado sensível versionado.
- [x] Padronizar nomes de scripts em frontend e backend.
- [x] Criar README curto de execução local para cada pasta.
- [x] Garantir que `npm install`, `npm run lint` e `npm run build` funcionem em cada pasta separadamente.

## Etapa 2 - Segurança Básica Obrigatória

- [x] Remover criação automática do usuário de teste em produção.
- [x] Adicionar variável `SEED_TEST_USER=true/false`.
- [x] Adicionar `helmet` no backend.
- [x] Configurar CORS sem fallback inseguro.
- [x] Bloquear backend em produção se `FRONTEND_ORIGIN` não estiver definido.
- [x] Definir limite de payload por endpoint.
- [x] Criar tratamento de erro sem vazar detalhes internos.
- [x] Adicionar logs mínimos de erro no backend.

## Etapa 3 - Autenticação Mais Segura

- [x] Aumentar senha mínima para 8 ou 10 caracteres.
- [x] Bloquear senhas comuns.
- [x] Adicionar troca de senha.
- [x] Adicionar logout de todas as sessões.
- [x] Adicionar listagem de sessões ativas.
- [x] Adicionar expiração configurável de sessão.
- [x] Adicionar rotação de sessão após login.
- [x] Adicionar reset de senha por email.
- [x] Adicionar verificação de email.

## Etapa 4 - Rate Limit e Proteção Contra Abuso

- [x] Substituir rate limit em memória por Redis/Upstash ou equivalente.
- [x] Limitar tentativas de login por IP.
- [x] Limitar tentativas de login por email.
- [x] Limitar cadastro por IP.
- [x] Limitar importações por usuário.
- [x] Limitar tamanho e quantidade de questões importadas por plano.
- [x] Registrar eventos suspeitos de autenticação.
- [x] Bloquear temporariamente conta sob ataque de força bruta.

## Etapa 5 - CSRF e Cookies

- [x] Implementar CSRF para endpoints mutáveis quando usar cookies.
- [x] Revisar `SameSite`, `Secure` e `HttpOnly` em produção.
- [ ] Definir nova estratégia mobile quando o desenvolvimento mobile for retomado.
- [x] Remover integração antiga com Capacitor.
- [x] Implementar refresh token rotativo.
- [x] Adicionar revogação de refresh token.
- [x] Adicionar expiração curta para access token.

## Etapa 6 - Autorização e Planos

- [x] Garantir bloqueio server-side para telas/ações Pro.
- [x] Criar limites reais para plano Free.
- [x] Criar limites reais para plano Pro.
- [x] Impedir criação/importação acima do limite do plano.
- [x] Criar mensagens claras quando limite for atingido.
- [x] Criar endpoint de dados do plano atual.
- [x] Registrar alterações de plano em auditoria.

## Etapa 7 - Banco de Dados Profissional

- [x] Migrar `UserState.stateJson` para tabelas relacionais.
- [x] Criar tabela `Notebook`.
- [x] Criar tabela `Subject`.
- [x] Criar tabela `Question`.
- [x] Criar tabela `Alternative`.
- [x] Criar tabela `Progress`.
- [x] Criar tabela `ReviewLog`.
- [x] Criar tabela `Cooldown`.
- [x] Criar tabela `ReviewSession`.
- [x] Criar tabela `ReviewSessionItem`.
- [x] Adicionar `userId` em todas as entidades do usuário.
- [x] Criar índices por `userId`.
- [x] Criar migração dos dados JSON atuais para tabelas.
- [x] Migrar SQLite para PostgreSQL preservando e validando os dados.
- [x] Criar migration baseline PostgreSQL reproduzível.

## Etapa 8 - Auditoria e Observabilidade

- [x] Adicionar logger estruturado com `pino`.
- [x] Adicionar request id por requisição.
- [x] Criar tabela `AuditLog`.
- [x] Auditar login.
- [x] Auditar logout.
- [x] Auditar importação.
- [x] Auditar exclusão.
- [x] Auditar alteração de senha.
- [x] Auditar alteração de plano.
- [x] Integrar Sentry ou alternativa.
- [x] Criar healthcheck com verificação de banco.

## Etapa 9 - Produto SaaS

- [x] Criar landing page pública.
- [x] Criar página de preços.
- [x] Criar termos de uso.
- [x] Criar política de privacidade.
- [x] Criar onboarding mais completo.
- [x] Criar tela de conta.
- [x] Criar tela de segurança da conta.
- [x] Criar tela de assinatura/plano.
- [x] Criar fluxo de suporte/contato.

## Etapa 10 - Pagamentos

- [ ] Escolher provedor de pagamento.
- [ ] Criar tabela `Subscription`.
- [ ] Criar tabela `PaymentEvent`.
- [ ] Criar checkout.
- [ ] Criar portal de assinatura.
- [ ] Validar webhook assinado.
- [ ] Atualizar plano apenas via webhook confiável.
- [ ] Testar upgrade.
- [ ] Testar downgrade.
- [ ] Testar cancelamento.

## Etapa 11 - Deploy

- [ ] Separar ambientes `development`, `staging` e `production`.
- [ ] Configurar domínio do frontend.
- [ ] Configurar domínio da API.
- [ ] Configurar HTTPS obrigatório.
- [ ] Configurar secrets fora do Git.
- [ ] Criar pipeline de CI.
- [ ] Rodar lint no CI.
- [ ] Rodar build no CI.
- [ ] Rodar testes no CI.
- [ ] Configurar backup automático do banco.
- [ ] Configurar rollback.

## Etapa 12 - Hardening Final

- [ ] Fazer revisão de segurança das rotas.
- [ ] Fazer teste de autorização entre usuários.
- [ ] Fazer teste de abuso de importação.
- [ ] Fazer teste de brute force.
- [ ] Fazer teste de CSRF.
- [ ] Fazer teste de XSS básico.
- [ ] Fazer teste de recuperação de senha.
- [ ] Fazer teste de webhook falso.
- [ ] Revisar dependências com `npm audit`.
- [ ] Revisar logs para garantir que tokens e senhas não aparecem.

## Critério Para Produção Pública

- [ ] HTTPS ativo.
- [ ] Sem usuário seed em produção.
- [ ] CORS restrito.
- [ ] Rate limit persistente.
- [ ] CSRF ou autenticação sem cookie para mutações.
- [ ] Reset de senha funcionando.
- [ ] Email verificado.
- [ ] Backups automáticos.
- [ ] Logs/auditoria ativos.
- [ ] Planos validados no backend.
- [ ] Testes de segurança básicos executados.
