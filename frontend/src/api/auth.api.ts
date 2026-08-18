import { apiRequest } from "./client";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "USER" | "RESPONDER" | "ADMIN";
}

interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

interface RegisterResponse {
  message: string;
  user: User;
}

interface MeResponse {
  message: string;
  user: {
    userId: number;
    role: "USER" | "RESPONDER" | "ADMIN";
  };
}

export const login = (
  email: string,
  password: string
) => {
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
};

export const register = (
  name: string,
  email: string,
  password: string
) => {
  return apiRequest<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  });
};

export const getMe = (token: string) => {
  return apiRequest<MeResponse>("/auth/me", {
    method: "GET",
    token,
  });
};