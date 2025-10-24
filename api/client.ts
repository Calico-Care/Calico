import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Supabase client instance
 *
 * To use this client:
 * 1. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in your .env file
 * 2. Import and use in your components or API hooks
 *
 * Note: Uses Supabase's new API keys system with publishable keys (sb_publishable_...)
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    // Auto refresh token
    autoRefreshToken: true,
    // Persist auth session in async storage
    persistSession: true,
    // Detect session from URL (useful for magic links)
    detectSessionInUrl: false,
  },
});

/**
 * API client for custom endpoints (if needed)
 */
export const apiClient = {
  baseURL: env.apiUrl,

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};
