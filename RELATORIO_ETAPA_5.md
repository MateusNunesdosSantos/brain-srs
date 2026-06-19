# Relatorio da Etapa 5 - CSRF, Cookies e Tokens

## Implementacoes

- CSRF Double Submit Cookie para mutacoes autenticadas por cookie.
- Cookie de sessao `HttpOnly`, `SameSite=Strict` e `Secure` em producao.
- Remocao do token de sessao do `localStorage` do navegador.
- Access token opaco com expiracao curta de 15 minutos.
- Refresh token opaco com expiracao de 30 dias.
- Rotacao obrigatoria de refresh token.
- Revogacao de toda a familia ao detectar reutilizacao de refresh token.
- Endpoint explicito para revogar refresh tokens.
- Revogacao de access/refresh tokens ao trocar senha, redefinir senha ou sair de todas as sessoes.
- Limpeza automatica de tokens expirados.

## Estrategia Atual

- Web: cookie `HttpOnly` + CSRF.
- Clientes externos futuros: access token + refresh token rotativo.
- Mobile: estrategia adiada e ainda nao definida.

## Endpoints

| Metodo | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Obter token CSRF para o navegador |
| POST | `/api/auth/token/login` | Emitir access e refresh token |
| POST | `/api/auth/token/refresh` | Rotacionar refresh token |
| POST | `/api/auth/token/revoke` | Revogar familia de refresh tokens |

## Validacoes Executadas

- Mutacao por cookie sem CSRF bloqueada com `403`.
- Mutacao por cookie com CSRF aceita.
- Access token autenticou corretamente.
- Refresh token foi rotacionado.
- Reutilizacao do refresh token antigo bloqueada com `401`.
- Familia do refresh token reutilizado foi revogada.
