# Roadmap Catalogo de Conteudo BrainSRS

Checklist incremental para adicionar conteudo pronto ao BrainSRS sem substituir ou remover as funcionalidades atuais do aplicativo.

## Status da Implementacao - 11/06/2026

Implementacao tecnica integral entregue. As checklists detalhadas abaixo permanecem como historico de planejamento; esta secao registra o estado real mais recente.

- [x] Catalogo central separado do conteudo pessoal.
- [x] Tres objetivos piloto: Tecnologia, Concursos publicos e Humanidades.
- [x] Tres pacotes piloto instalaveis com questoes iniciais.
- [x] Instalacao atomica com novos IDs pessoais e progresso inicial.
- [x] Validacao dos limites totais do plano antes da instalacao.
- [x] Instalacao oficial sem consumir o limite diario de importacoes.
- [x] Registro de instalacao e auditoria `catalog.pack_installed`.
- [x] Endpoints autenticados para listar e instalar pacotes.
- [x] Catalogo documentado no Swagger.
- [x] Selecao de interesses para novos usuarios antes do tour atual.
- [x] Botao permanente `Catalogo` na Biblioteca.
- [x] Tour, importacao, exportacao e criacao manual mantidos.
- [x] Migration aplicada e instalacao validada com uma conta temporaria.
- [x] Rastreio de origem e versao em cadernos, materias e questoes pessoais.
- [x] Remocao segura restrita ao conteudo originado pela instalacao selecionada.
- [x] Confirmacao explicita antes da remocao e auditoria `catalog.pack_removed`.
- [x] Atualizacao aditiva de pacotes sem sobrescrever questoes ou progresso existentes.
- [x] Deteccao de nova versao e aceite manual da atualizacao.
- [x] Historico editorial com snapshots e rollback administrativo.
- [x] Status editoriais `draft`, `published` e `archived`.
- [x] Importacao administrativa validada, com exatamente uma alternativa correta por questao.
- [x] Motivo obrigatorio e auditoria para publicacao, arquivamento e rollback.
- [x] APIs publicas para objetivos, busca, filtros, previa segura, capacidade, instalacoes, remocao e atualizacao.
- [x] Rate limit para instalacao e remocao.
- [x] Area de Catalogo no painel administrativo e metricas de instalacao.
- [x] Abas de catalogo e pacotes instalados na Biblioteca.
- [x] Busca de pacotes, identificacao de conteudo oficial e filtro de origem na revisao.
- [x] Regras Free/Pro e limite configuravel de pacotes Free.
- [x] Feature flag `CATALOG_ENABLED`.
- [x] Smoke test transacional do catalogo.
- [x] Regras de produto documentadas em `CATALOGO_REGRAS_PRODUTO.md`.
- [x] Botoes da Biblioteca redistribuidos horizontalmente em telas desktop.

Decisao de modelo: `CatalogPack` representa o unico caderno oficial instalavel do pacote. Por isso, uma tabela separada `CatalogNotebook` nao foi criada; a instalacao gera um `Notebook` pessoal com origem rastreavel.

Pendencias nao bloqueantes de operacao continua:

- [ ] Ampliar o acervo piloto e executar revisao editorial recorrente.
- [ ] Medir funil de onboarding e primeira revisao durante liberacao gradual.
- [ ] Validar periodicamente backup e restauracao em ambiente de homologacao.
- [ ] Expandir testes de interface antigos, que atualmente dependem de contas/rate limits compartilhados.

## Objetivo

Permitir que o usuario selecione objetivos, cadernos e materias de interesse durante o onboarding ou posteriormente pelo Catalogo BrainSRS. O sistema adiciona conteudo pronto a biblioteca pessoal e permite iniciar estudos e revisoes sem depender de importacoes frequentes.

## Principio de Compatibilidade

O catalogo sera um novo recurso complementar. As funcionalidades atuais devem continuar disponiveis e funcionando:

- [x] Manter cadastro e login atuais.
- [x] Manter criacao manual de cadernos, materias e questoes.
- [x] Manter importacao e exportacao de conteudo.
- [ ] Manter edicao e exclusao do conteudo pessoal.
- [x] Manter biblioteca e busca atuais.
- [ ] Manter filtros por caderno e materia na revisao.
- [ ] Manter revisao espacada, cooldown, progresso e historico.
- [ ] Manter sessoes de revisao sincronizadas entre dispositivos.
- [ ] Manter simulados, estatisticas e caderno de erros.
- [x] Manter limites e recursos dos planos Free e Pro.
- [x] Manter onboarding atual disponivel como ajuda contextual.

## Decisao Arquitetural Inicial

Abordagem recomendada para a primeira versao:

- [x] Criar um catalogo central administrado pelo BrainSRS.
- [x] Copiar os conteudos selecionados para a biblioteca pessoal do usuario.
- [x] Gerar IDs pessoais para cadernos, materias, questoes e alternativas copiadas.
- [x] Criar progresso individual inicial para cada questao instalada.
- [x] Registrar a origem e a versao do conteudo copiado.
- [x] Permitir que o usuario edite o conteudo copiado sem alterar o catalogo central.
- [x] Nao usar o limite diario de importacoes para instalacoes oficiais do catalogo.
- [x] Aplicar limites de capacidade do plano antes de instalar um pacote.

Essa abordagem preserva o modelo atual, no qual cada conteudo pertence ao usuario. Uma migracao futura para questoes compartilhadas pode ser considerada somente depois da validacao do produto.

## Terminologia

- **Catalogo:** conjunto central de conteudos oficiais disponiveis.
- **Objetivo:** agrupamento amplo, como Concurso Publico, ENEM ou Tecnologia.
- **Pacote:** conjunto instalavel de cadernos, materias e questoes.
- **Instalacao:** registro de que um usuario adicionou um pacote.
- **Conteudo pessoal:** conteudo criado, importado ou copiado para a conta do usuario.
- **Versao:** identificador da revisao publicada de um pacote.

## Etapa 0 - Descoberta e Regras do Produto

- [ ] Definir os primeiros objetivos de estudo oferecidos.
- [ ] Definir os primeiros pacotes e materias do catalogo.
- [ ] Definir quantidade minima e maxima de questoes por pacote.
- [ ] Definir criterios de qualidade para enunciado, alternativa, resposta e explicacao.
- [ ] Definir politica de revisao editorial antes da publicacao.
- [ ] Definir quais pacotes ficam disponiveis no plano Free.
- [ ] Definir quais pacotes ou recursos ficam disponiveis no plano Pro.
- [ ] Definir comportamento ao atingir limite de cadernos, materias ou questoes.
- [ ] Definir comportamento para remover e reinstalar pacotes.
- [ ] Definir comportamento para atualizacoes de pacotes instalados.

**Criterio de conclusao:** regras documentadas e primeiro conjunto de conteudos aprovado para implementacao.

## Etapa 1 - Modelo de Dados do Catalogo

Criar entidades separadas das tabelas pessoais atuais.

- [x] Criar tabela `CatalogGoal`.
- [x] Criar tabela `CatalogPack`.
- [ ] Criar tabela `CatalogNotebook`.
- [x] Criar tabela `CatalogSubject`.
- [x] Criar tabela `CatalogQuestion`.
- [x] Criar tabela `CatalogAlternative`.
- [x] Criar tabela `UserCatalogInstallation`.
- [ ] Criar tabela opcional `CatalogPackVersion`.
- [ ] Adicionar status `draft`, `published` e `archived`.
- [x] Adicionar ordem de exibicao para objetivos, pacotes e materias.
- [x] Adicionar campos de titulo, descricao, icone, cor e nivel.
- [ ] Adicionar autoria, data de publicacao e versao.
- [x] Adicionar indices para status, objetivo, pacote e busca.
- [ ] Adicionar `sourceCatalogQuestionId` nas questoes pessoais.
- [ ] Adicionar `sourceCatalogPackId` e `sourceCatalogVersion` quando necessario.
- [x] Garantir que a migration nao altere dados pessoais existentes.

**Criterio de conclusao:** banco suporta catalogo e rastreamento de instalacoes sem mudar o comportamento atual.

## Etapa 2 - Servico de Instalacao

- [x] Criar servico transacional para instalar pacote.
- [x] Validar se o pacote esta publicado.
- [x] Validar permissao pelo plano do usuario.
- [x] Validar capacidade restante da conta.
- [x] Impedir instalacao duplicada do mesmo pacote.
- [x] Copiar cadernos, materias, questoes e alternativas com novos IDs.
- [x] Criar progresso inicial no estado `new`.
- [x] Registrar `UserCatalogInstallation`.
- [x] Registrar auditoria `catalog.pack_installed`.
- [x] Garantir rollback completo se qualquer etapa falhar.
- [ ] Criar servico para remover pacote sem afetar conteudo nao relacionado.
- [ ] Solicitar confirmacao antes de remover conteudo com progresso.
- [ ] Registrar auditoria `catalog.pack_removed`.

**Criterio de conclusao:** um pacote pode ser instalado e removido sem corromper biblioteca, progresso ou historico.

## Etapa 3 - APIs Publicas do Catalogo

- [ ] Criar `GET /api/catalog/goals`.
- [ ] Criar `GET /api/catalog/packs`.
- [ ] Criar `GET /api/catalog/packs/:id`.
- [ ] Criar filtros por objetivo, materia, nivel e plano.
- [ ] Criar busca por texto.
- [ ] Criar `POST /api/catalog/packs/:id/install`.
- [ ] Criar `DELETE /api/catalog/installations/:id`.
- [ ] Criar `GET /api/catalog/installations`.
- [ ] Criar endpoint para verificar capacidade antes da instalacao.
- [x] Aplicar autenticacao e autorizacao nas mutacoes.
- [ ] Aplicar rate limit nas instalacoes e remocoes.
- [ ] Nao expor respostas corretas em endpoints publicos de visualizacao previa.
- [x] Documentar endpoints no Swagger.

**Criterio de conclusao:** frontend consegue listar, visualizar, instalar e remover pacotes com respostas seguras.

## Etapa 4 - Gestao Administrativa do Catalogo

- [ ] Adicionar area `Catalogo` no painel administrativo.
- [ ] Permitir criar e editar objetivos.
- [ ] Permitir criar e editar pacotes.
- [ ] Permitir criar cadernos e materias do catalogo.
- [ ] Permitir cadastrar e revisar questoes.
- [ ] Validar exatamente uma alternativa correta por questao.
- [ ] Permitir salvar rascunho.
- [ ] Permitir visualizar previa antes de publicar.
- [ ] Permitir publicar nova versao.
- [ ] Permitir arquivar pacote sem apagar instalacoes existentes.
- [ ] Exigir motivo para alteracoes editoriais criticas.
- [ ] Auditar criacao, edicao, publicacao e arquivamento.
- [ ] Criar importacao administrativa em lote para alimentar o catalogo.

**Criterio de conclusao:** equipe administrativa consegue manter o catalogo sem editar banco ou codigo.

## Etapa 5 - Novo Onboarding de Interesses

O cadastro de nome, email e senha permanece simples. A selecao de interesses acontece depois da conta criada.

- [x] Manter formulario de cadastro atual.
- [x] Substituir o primeiro onboarding por uma selecao guiada de interesses.
- [x] Criar etapa para selecionar objetivo de estudo.
- [x] Criar etapa para selecionar pacotes ou materias.
- [x] Mostrar quantidade de cadernos, materias e questoes selecionadas.
- [ ] Mostrar impacto nos limites do plano.
- [ ] Permitir revisar selecao antes de confirmar.
- [x] Instalar os pacotes selecionados em uma unica operacao.
- [x] Mostrar progresso durante a instalacao.
- [ ] Direcionar o usuario para iniciar estudos apos concluir.
- [x] Permitir pular e continuar com biblioteca vazia.
- [x] Manter tour atual acessivel pela Biblioteca ou ajuda.
- [ ] Marcar onboarding como concluido somente apos confirmar ou pular.

**Criterio de conclusao:** novo usuario consegue criar conta e iniciar uma sessao com conteudo pronto sem importar arquivos.

## Etapa 6 - Catalogo na Biblioteca

- [ ] Adicionar abas `Minha biblioteca`, `Catalogo BrainSRS` e `Pacotes instalados`.
- [x] Manter todos os botoes atuais da Biblioteca.
- [x] Exibir cards de objetivos e pacotes.
- [x] Exibir nivel, materias, quantidade de questoes e disponibilidade por plano.
- [ ] Exibir previa do conteudo sem revelar respostas.
- [x] Exibir status instalado, disponivel ou bloqueado pelo plano.
- [x] Permitir instalar pacote pela Biblioteca.
- [ ] Permitir remover pacote instalado.
- [ ] Diferenciar visualmente conteudo oficial e conteudo pessoal.
- [ ] Permitir buscar e filtrar pacotes.
- [ ] Manter busca atual de questoes pessoais.

**Criterio de conclusao:** usuario consegue gerenciar conteudo oficial e pessoal no mesmo fluxo sem perder recursos atuais.

## Etapa 7 - Estudo e Revisao

- [ ] Manter revisao somente de questoes vencidas.
- [ ] Manter opcao `Estudar novas questoes`.
- [ ] Permitir filtrar por conteudo pessoal ou pacote oficial instalado.
- [ ] Permitir selecionar caderno e materia instalados.
- [ ] Exibir origem do pacote quando util.
- [ ] Manter progresso individual mesmo quando o pacote for atualizado.
- [ ] Manter sincronizacao entre dispositivos.
- [ ] Manter cooldown, sons, feedback e sessao ativa.
- [ ] Garantir que nenhuma questao seja respondida duas vezes na mesma sessao.
- [ ] Incluir conteudo instalado em simulados, estatisticas e caderno de erros.

**Criterio de conclusao:** conteudo do catalogo funciona em todos os fluxos atuais de aprendizado.

## Etapa 8 - Versionamento e Atualizacoes

- [ ] Registrar versao instalada de cada pacote.
- [ ] Detectar nova versao disponivel.
- [ ] Classificar mudancas como adicao, correcao ou remocao.
- [ ] Adicionar novas questoes sem apagar progresso existente.
- [ ] Nao substituir silenciosamente questoes ja respondidas.
- [ ] Permitir que usuario aceite atualizacoes.
- [ ] Manter questoes editadas pelo usuario separadas da origem oficial.
- [ ] Criar historico de atualizacoes do pacote.
- [ ] Permitir rollback editorial administrativo.

**Criterio de conclusao:** catalogo pode evoluir sem perder progresso ou sobrescrever alteracoes pessoais.

## Etapa 9 - Planos, Limites e Monetizacao

- [ ] Definir quantidade de pacotes ativos no plano Free.
- [ ] Definir catalogo completo ou recursos exclusivos no plano Pro.
- [ ] Nao contar instalacao como importacao diaria.
- [ ] Contar copias instaladas nos limites totais quando aplicavel.
- [ ] Mostrar bloqueio e motivo antes de iniciar instalacao.
- [ ] Permitir upgrade sem perder selecao de interesse.
- [ ] Evitar remover conteudo automaticamente em downgrade.
- [ ] Definir politica para pacotes Pro apos cancelamento.
- [ ] Auditar instalacoes e bloqueios por plano.

**Criterio de conclusao:** regras comerciais sao aplicadas pelo backend e comunicadas claramente no frontend.

## Etapa 10 - Qualidade, Seguranca e Observabilidade

- [ ] Testar que usuarios nao acessam instalacoes de outras contas.
- [ ] Testar instalacao concorrente do mesmo pacote.
- [ ] Testar rollback de instalacao incompleta.
- [ ] Testar limites Free e Pro.
- [ ] Testar remocao com progresso existente.
- [ ] Testar atualizacao de pacote.
- [ ] Testar onboarding pulado e concluido.
- [ ] Testar compatibilidade com importacao e criacao manual.
- [ ] Testar revisao, simulado, estatisticas e caderno de erros.
- [ ] Registrar metricas de visualizacao e instalacao de pacotes.
- [ ] Registrar erros de instalacao.
- [ ] Criar dashboard administrativo de uso do catalogo.
- [ ] Validar backup e restauracao das tabelas do catalogo.

**Criterio de conclusao:** recurso possui cobertura de regressao e observabilidade antes da liberacao geral.

## Etapa 11 - Liberacao Gradual

- [ ] Criar feature flag para o catalogo.
- [ ] Habilitar primeiro para administradores e contas de teste.
- [ ] Publicar um objetivo e poucos pacotes piloto.
- [ ] Coletar metricas de conclusao do onboarding.
- [ ] Coletar metricas de instalacao e inicio da primeira revisao.
- [ ] Corrigir problemas antes da liberacao geral.
- [ ] Liberar para novos usuarios.
- [ ] Liberar para usuarios existentes pela Biblioteca.
- [ ] Manter importacao e criacao manual visiveis.
- [ ] Documentar o novo recurso na ajuda e suporte.

**Criterio de conclusao:** catalogo liberado gradualmente sem interromper usuarios atuais.

## Fora do Escopo Inicial

- [ ] Marketplace com conteudo criado por usuarios.
- [ ] Compra individual de pacotes.
- [ ] Compartilhamento publico de bibliotecas pessoais.
- [ ] Edicao colaborativa de pacotes.
- [ ] Questao central compartilhada diretamente por todos os usuarios.
- [ ] Atualizacao automatica destrutiva de conteudo instalado.
- [ ] Geracao automatica de questoes por IA sem revisao editorial.

## Ordem Recomendada de Implementacao

1. Etapas 0 e 1: regras e modelo de dados.
2. Etapas 2 e 3: instalacao e APIs.
3. Etapa 4: gestao administrativa.
4. Etapa 5: onboarding de interesses.
5. Etapas 6 e 7: Biblioteca, estudo e revisao.
6. Etapas 8 e 9: versoes, atualizacoes e planos.
7. Etapas 10 e 11: testes e liberacao gradual.

## Criterio de MVP

O MVP do Catalogo BrainSRS esta concluido quando:

- [ ] Um administrador consegue publicar um pacote.
- [ ] Um novo usuario consegue selecionar interesses apos o cadastro.
- [ ] O usuario consegue instalar pelo menos um pacote.
- [ ] O conteudo aparece na Biblioteca pessoal.
- [ ] O usuario consegue estudar e revisar as questoes instaladas.
- [ ] Progresso, cooldown, historico e sincronizacao funcionam normalmente.
- [ ] Importacao, exportacao e criacao manual continuam funcionando.
- [ ] Remocao de pacote exige confirmacao e nao afeta outros conteudos.
- [ ] Limites de plano sao validados no backend.
- [ ] Existe auditoria e teste de regressao dos fluxos existentes.
