import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, AppAction } from '../services/types';
import { apiRequest } from '../services/api';
import { useAuth } from './AuthContext';

type StateContextType = {
  state: AppState | null;
  isLoading: boolean;
  fetchState: () => Promise<void>;
  dispatchAction: (action: AppAction) => Promise<any>;
};

const StateContext = createContext<StateContextType | undefined>(undefined);

export const StateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<AppState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchState = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/state');
      // A API retorna { user, state }
      setState(response.state);
    } catch (e) {
      console.error('Erro ao buscar estado do backend:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const dispatchAction = async (action: AppAction) => {
    try {
      const response = await apiRequest('/api/actions', {
        method: 'POST',
        body: JSON.stringify(action),
      });
      // Retorno esperado: { state, result, user }
      if (response.state) {
        setState(response.state);
      }
      return response.result ?? {};
    } catch (e) {
      console.error('Erro ao enviar ação para o backend:', e);
      throw e;
    }
  };

  // Carrega ou limpa o estado automaticamente ao mudar a autenticação do usuário
  useEffect(() => {
    if (isAuthenticated) {
      fetchState();
    } else {
      setState(null);
    }
  }, [isAuthenticated]);

  return (
    <StateContext.Provider value={{ state, isLoading, fetchState, dispatchAction }}>
      {children}
    </StateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error('useAppState deve ser usado dentro de um StateProvider');
  }
  return context;
};
