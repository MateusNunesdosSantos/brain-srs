import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const ACCESS_TOKEN_KEY = 'brainsrs_access_token';
const REFRESH_TOKEN_KEY = 'brainsrs_refresh_token';
const USER_KEY = 'brainsrs_user';

// Retorna a URL base de desenvolvimento de acordo com o IP local do Metro Bundler
export const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // No emulador ou dispositivo físico rodando Expo Go,
  // precisamos usar o IP local do Metro Bundler apontando para a porta 3001
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3001`;
  }
  return 'http://localhost:3001';
};

let sessionExpiredCallback: (() => void) | null = null;

export const registerSessionExpiredCallback = (cb: () => void) => {
  sessionExpiredCallback = cb;
};

// Limpa todos os tokens do armazenamento seguro
export const clearAuthTokens = async () => {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
};

// Armazena tokens de acesso e refresh
export const saveAuthTokens = async (accessToken: string, refreshToken: string, user: any) => {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
};

// Recupera informações de tokens salvos
export const getStoredSession = async () => {
  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    const user = userJson ? JSON.parse(userJson) : null;
    return { accessToken, refreshToken, user };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
};

// Wrapper para fetch com limite de tempo (timeout) de 10 segundos
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Conexão expirou (${timeoutMs}ms) ao conectar ao servidor em: ${url}. Verifique se o backend está rodando.`);
    }
    // Melhorar erro de rede genérico
    if (err.message && err.message.toLowerCase().includes('network request failed')) {
      throw new Error(`Falha de conexão com o servidor em: ${url}. Verifique o IP/porta ou rede Wi-Fi.`);
    }
    throw err;
  }
};

// Lógica de renovação de token no backend
const refreshTokens = async (refreshToken: string): Promise<string> => {
  const url = `${getBaseUrl()}/api/auth/token/refresh`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Refresh token invalid');
  }

  const data = await response.json();
  // Resposta esperada: { accessToken, refreshToken, expiresAt }
  // Mantemos o usuário salvo atual
  const stored = await getStoredSession();
  await saveAuthTokens(data.accessToken, data.refreshToken, stored.user);
  return data.accessToken;
};

// Função genérica de chamada à API
export const apiRequest = async (path: string, options: RequestInit = {}): Promise<any> => {
  const url = `${getBaseUrl()}${path}`;
  const stored = await getStoredSession();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (stored.accessToken) {
    headers['Authorization'] = `Bearer ${stored.accessToken}`;
  }

  let response;
  try {
    response = await fetchWithTimeout(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.warn(`Request to ${url} failed:`, error);
    throw error;
  }

  if (response.status === 401) {
    // Tenta renovar o token
    if (stored.refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newAccessToken = await refreshTokens(stored.refreshToken);
          isRefreshing = false;
          onRefreshed(newAccessToken);

          // Tenta repetir a requisição original imediatamente com o novo token
          headers['Authorization'] = `Bearer ${newAccessToken}`;
          const retryResponse = await fetchWithTimeout(url, { ...options, headers });
          const data = await retryResponse.json();
          if (!retryResponse.ok) {
            throw data;
          }
          return data;
        } catch (error) {
          isRefreshing = false;
          refreshSubscribers = [];
          await clearAuthTokens();
          if (sessionExpiredCallback) {
            sessionExpiredCallback();
          }
          throw error;
        }
      }

      // Aguarda a finalização do refresh para outras requisições concorrentes e repete
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (newToken) => {
          try {
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetchWithTimeout(url, { ...options, headers });
            const data = await retryResponse.json();
            if (!retryResponse.ok) {
              reject(data);
            } else {
              resolve(data);
            }
          } catch (err) {
            reject(err);
          }
        });
      });
    } else {
      await clearAuthTokens();
      if (sessionExpiredCallback) {
        sessionExpiredCallback();
      }
      throw new Error('Unauthorized');
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw data;
  }
  return data;
};
