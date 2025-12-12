import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  skipAuth?: boolean;
}

export async function apiRequest(
  url: string,
  method: RequestMethod = "GET",
  data?: any,
  options?: ApiRequestOptions
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  if (!options?.skipAuth) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        headers["Authorization"] = `Bearer ${sessionData.session.access_token}`;
      }
    } catch (error) {
      console.warn("[apiRequest] Failed to get session:", error);
    }
  }

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (data && method !== "GET") {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
