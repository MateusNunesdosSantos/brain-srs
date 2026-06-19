# Relatório da Etapa 9 - Produto SaaS

## Resultado

A aplicação recebeu a primeira camada de produto SaaS: páginas públicas, conteúdo legal inicial,
área de conta mais completa, segurança da conta, assinatura/plano e fluxo de suporte.

## Páginas públicas

- `/inicio`: landing page pública com proposta de valor, CTA e benefícios;
- `/precos`: página de planos Free e Pro;
- `/termos`: termos de uso iniciais;
- `/privacidade`: política de privacidade inicial;
- `/suporte`: página pública de contato.

As páginas legais são versões iniciais para MVP e devem passar por revisão jurídica antes de
produção pública.

## Configurações do usuário

A tela de configurações agora possui abas internas para:

- revisão;
- conta;
- segurança;
- plano;
- suporte.

## Segurança da conta

Foram conectados os endpoints existentes do backend para:

- trocar senha;
- solicitar verificação de e-mail;
- listar sessões ativas;
- encerrar todas as sessões.

## Assinatura e plano

A aba de plano mostra o plano atual e o consumo de cadernos, matérias e questões em relação aos
limites atuais. Pagamentos, checkout e portal de assinatura continuam reservados para a Etapa 10.

## Onboarding

O tour da Biblioteca foi ampliado para incluir importação de conteúdo, além de criação de caderno,
matéria e questão.

## Suporte

Foi criado um fluxo simples por `mailto`, tanto na página pública quanto dentro da conta. Em produção,
esse fluxo pode evoluir para tickets, formulário com backend e integração com ferramenta de suporte.

## Validações executadas

- lint e build do frontend;
- lint e build do backend;
- build confirmou as novas rotas públicas: `/inicio`, `/precos`, `/termos`, `/privacidade` e `/suporte`.

## Limitações conhecidas

- textos legais precisam de revisão jurídica;
- plano Pro ainda não possui cobrança real;
- suporte ainda não grava chamados no banco;
- edição de nome/e-mail da conta ainda não foi implementada.
