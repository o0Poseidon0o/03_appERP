import React, { createContext, useContext, useState, useEffect } from 'react';

// --- CẬP NHẬT INTERFACE USER ---
export interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: { 
    id: string; 
    name: string; 
    permissions?: PermissionItem[]; // THÊM DÒNG NÀY VÀO ĐÂY
  };
  department: { id: string; name: string };
  phone?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}
export interface PermissionItem {
  permission: {
    id: string;
    name: string;
  };
}
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Khi load lại trang, kiểm tra localStorage
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(storedToken);
      try {
          setUser(JSON.parse(storedUser));
      } catch (e) {
          console.error("Lỗi parse user từ storage", e);
          localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};