import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

interface ApiRequestOptions {
  headers?: Record<string, string>;
}

export async function apiRequest(
  url: string,
  method: RequestMethod = "GET",
  data?: any,
  options?: ApiRequestOptions
): Promise<any> {
  const requestOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  };

  if (data && method !== "GET") {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
