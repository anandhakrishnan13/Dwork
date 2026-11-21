import axios from "axios";
import { clearToken, getToken } from "./auth-storage";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production"
      ? "/api"
      : "http://localhost:4000"),
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const payload = error.response?.data as
      | { message?: unknown; errors?: Record<string, string[]> }
      | undefined;

    const message =
      typeof payload?.message === "string"
        ? payload.message
        : error.code === "ECONNABORTED"
          ? "The request timed out. Please try again."
          : error.response
            ? "The server could not complete the request."
            : "Cannot reach the API. Make sure the backend is running.";

    // An expired or revoked session sends the user back to the login page.
    const isLoginRequest = error.config?.url?.includes("/auth/login");

    if (error.response?.status === 401 && !isLoginRequest) {
      clearToken();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
    }

    return Promise.reject(
      new ApiError(message, error.response?.status, payload?.errors),
    );
  },
);

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(getErrorMessage(error));
}
