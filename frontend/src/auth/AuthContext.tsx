import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { graphqlRequest } from '../api/client';
import type { AuthPayload, User, UserRole } from '../api/types';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id name email role createdAt }
    }
  }
`;

const REGISTER_MUTATION = `
  mutation Register($name: String!, $email: String!, $password: String!, $role: UserRole!) {
    register(name: $name, email: $email, password: $password, role: $role) {
      token
      user { id name email role createdAt }
    }
  }
`;

function loadStoredUser(): User | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser);

  const persistAuth = useCallback((payload: AuthPayload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem('user', JSON.stringify(payload.user));
    setUser(payload.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await graphqlRequest<{ login: AuthPayload }>(LOGIN_MUTATION, {
        email,
        password,
      });
      persistAuth(data.login);
    },
    [persistAuth]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: UserRole) => {
      const data = await graphqlRequest<{ register: AuthPayload }>(REGISTER_MUTATION, {
        name,
        email,
        password,
        role,
      });
      persistAuth(data.register);
    },
    [persistAuth]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}