import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getMe,
  login as loginApi,
  register as registerApi,
  type User,
} from "../api/auth.api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;

  login: (
    email: string,
    password: string
  ) => Promise<void>;

  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;

  logout: () => void;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

export const AuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("roadsos_token")
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await getMe(token);

        setUser({
          id: response.user.userId,
          name: "",
          email: "",
          role: response.user.role,
        });
      } catch {
        localStorage.removeItem("roadsos_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [token]);

  const login = async (
    email: string,
    password: string
  ) => {
    const response = await loginApi(
      email,
      password
    );

    localStorage.setItem(
      "roadsos_token",
      response.token
    );

    setToken(response.token);
    setUser(response.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ) => {
    await registerApi(
      name,
      email,
      password
    );

    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("roadsos_token");

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};