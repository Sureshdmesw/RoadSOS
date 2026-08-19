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
  const [user, setUser] = useState<User | null>(
    null
  );

  const [token, setToken] = useState<string | null>(
    () =>
      localStorage.getItem(
        "roadsos_token"
      )
  );

  const [loading, setLoading] =
    useState(true);

  /*
  |--------------------------------------------------------------------------
  | Restore Existing Session
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response =
          await getMe(token);

        /*
         * Keep the complete user object
         * returned by the backend.
         *
         * Previously this was:
         *
         * {
         *   id: response.user.userId,
         *   name: "",
         *   email: "",
         *   role: response.user.role
         * }
         *
         * which caused the user's name
         * to disappear after refresh.
         */

        setUser(response.user);
      } catch (error) {
        console.error(
          "Unable to restore session:",
          error
        );

        localStorage.removeItem(
          "roadsos_token"
        );

        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [token]);

  /*
  |--------------------------------------------------------------------------
  | Login
  |--------------------------------------------------------------------------
  */

  const login = async (
    email: string,
    password: string
  ) => {
    const response =
      await loginApi(
        email.trim(),
        password
      );

    localStorage.setItem(
      "roadsos_token",
      response.token
    );

    setToken(response.token);

    /*
     * Store the complete user returned
     * by the login API.
     *
     * This should contain:
     * id
     * name
     * email
     * role
     */

    setUser(response.user);
  };

  /*
  |--------------------------------------------------------------------------
  | Register
  |--------------------------------------------------------------------------
  */

  const register = async (
    name: string,
    email: string,
    password: string
  ) => {
    const trimmedName =
      name.trim();

    const trimmedEmail =
      email.trim();

    if (trimmedName.length < 2) {
      throw new Error(
        "Please enter your full name."
      );
    }

    if (trimmedName.length > 100) {
      throw new Error(
        "Full name cannot exceed 100 characters."
      );
    }

    if (!trimmedEmail) {
      throw new Error(
        "Please enter your email address."
      );
    }

    if (password.length < 8) {
      throw new Error(
        "Password must be at least 8 characters."
      );
    }

    /*
     * Send the user's name to the backend.
     */

    await registerApi(
      trimmedName,
      trimmedEmail,
      password
    );

    /*
     * Automatically log the user in
     * after successful registration.
     *
     * The login response should contain
     * the newly registered user's name.
     */

    await login(
      trimmedEmail,
      password
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Logout
  |--------------------------------------------------------------------------
  */

  const logout = () => {
    localStorage.removeItem(
      "roadsos_token"
    );

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
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
};