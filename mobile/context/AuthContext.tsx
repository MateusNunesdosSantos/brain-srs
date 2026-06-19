import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../services/types';
import {
  apiRequest,
  getStoredSession,
  saveAuthTokens,
  clearAuthTokens,
  registerSessionExpiredCallback,
} from '../services/api';

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Carrega a sessão salva ao iniciar o aplicativo
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const stored = await getStoredSession();
        if (stored.user) {
          setUser(stored.user);
        }
      } catch (e) {
        console.warn('Erro ao carregar sessão inicial:', e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Registra callback para limpar sessão caso expire em alguma requisição
    registerSessionExpiredCallback(() => {
      setUser(null);
    });
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auth/token/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // A API retorna { user, accessToken, refreshToken }
      await saveAuthTokens(response.accessToken, response.refreshToken, response.user);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      // 1. Cadastra o usuário no backend (cria registro no banco)
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      
      // 2. Faz login imediatamente para obter os tokens Bearer
      const response = await apiRequest('/api/auth/token/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      await saveAuthTokens(response.accessToken, response.refreshToken, response.user);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const stored = await getStoredSession();
      if (stored.refreshToken) {
        // Revoga o token no backend de forma assíncrona
        await apiRequest('/api/auth/token/revoke', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        }).catch((e) => console.warn('Erro ao revogar token no backend:', e));
      }
    } finally {
      await clearAuthTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
