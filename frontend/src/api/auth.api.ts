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
  user: User;
}

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export const login = (
  email: string,
  password: string
) => {
  return apiRequest<LoginResponse>(
    "/auth/login",
    {
      method: "POST",

      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    }
  );
};

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/

export const register = (
  name: string,
  email: string,
  password: string
) => {
  return apiRequest<RegisterResponse>(
    "/auth/register",
    {
      method: "POST",

      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    }
  );
};

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
|
| The backend /auth/me endpoint must return:
|
| {
|   user: {
|     id: number,
|     name: string,
|     email: string,
|     role: "USER" | "RESPONDER" | "ADMIN"
|   }
| }
|
*/

export const getMe = (
  token: string
) => {
  return apiRequest<MeResponse>(
    "/auth/me",
    {
      method: "GET",
      token,
    }
  );
};