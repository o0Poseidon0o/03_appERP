import React, { createContext, useContext, useState, useEffect } from 'react';

// --- INTERFACE PERMISSION ---
export interface PermissionItem {
  permissionId: string;
  permission?: {
    id: string;
    name: string;
  };
}

// --- CẬP NHẬT INTERFACE USER ---
export interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  roleId: string;
  role: { 
    id: string; 
    name: string; 
    permissions?: PermissionItem[]; 
  };
  department: { id: string; name: string };
  factory?: { id: string; name: string }; // [MỚI] Thêm factory vào interface
  allPermissions?: string[]; 
  phone?: string;
  avatar?: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateLocalUser: (updatedFields: Partial<User>) => void; // [MỚI] Hàm cập nhật UI không cần reload
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedPerms = localStorage.getItem('permissions');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        if (!storedPerms) {
           const perms = parsedUser.allPermissions || [];
           localStorage.setItem('permissions', JSON.stringify(perms));
        }
      } catch (e) {
        console.error("Lỗi phục hồi phiên đăng nhập:", e);
        logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);

    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));

    const permissions = newUser.allPermissions || 
                       newUser.role?.permissions?.map((p: PermissionItem) => p.permissionId) || 
                       [];
    
    localStorage.setItem('permissions', JSON.stringify(permissions));
  };

  // [MỚI] Hàm cập nhật nhanh thông tin User trên UI (dùng cho trang Profile)
  const updateLocalUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    const newUserObj = { ...user, ...updatedFields };
    setUser(newUserObj); // Cập nhật state (Header sẽ đổi tên ngay lập tức)
    localStorage.setItem('user', JSON.stringify(newUserObj)); // Cập nhật localStorage
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.clear(); 
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateLocalUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};