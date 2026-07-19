import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = '/api';

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
}

interface ApiError {
  status: number;
  message: string;
  data?: unknown;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader(): Record<string, string> {
    const token = useAuthStore.getState().token;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookie with refresh token
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newToken = data.accessToken;
      useAuthStore.getState().refreshToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }

  private async handleTokenRefresh(): Promise<string | null> {
    // Prevent multiple simultaneous refresh requests
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.refreshAccessToken().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private handleError(status: number, message: string, data?: unknown): never {
    const error: ApiError = { status, message, data };

    switch (status) {
      case 403:
        // Redirect to login on forbidden
        useAuthStore.getState().logout();
        window.location.href = '/login';
        break;
      case 507:
        // Dispatch disk space event for banner display
        window.dispatchEvent(
          new CustomEvent('api:disk-space-error', { detail: message })
        );
        break;
      case 409:
        // Dispatch conflict event for modal display
        window.dispatchEvent(
          new CustomEvent('api:conflict-error', { detail: data })
        );
        break;
    }

    throw error;
  }

  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { skipAuth = false, headers: customHeaders, ...fetchConfig } = config;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(!skipAuth ? this.getAuthHeader() : {}),
      ...(customHeaders as Record<string, string> || {}),
    };

    // Remove Content-Type for FormData (browser sets it with boundary)
    if (fetchConfig.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const url = `${this.baseUrl}${endpoint}`;

    let response = await fetch(url, {
      ...fetchConfig,
      headers,
      credentials: 'include',
    });

    // On 401, attempt token refresh and retry the original request
    if (response.status === 401 && !skipAuth) {
      const newToken = await this.handleTokenRefresh();

      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        response = await fetch(url, {
          ...fetchConfig,
          headers,
          credentials: 'include',
        });
      } else {
        // Refresh failed, logout
        useAuthStore.getState().logout();
        window.location.href = '/login';
        this.handleError(401, 'Session expired');
      }
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      const message =
        (errorData as { message?: string })?.message ||
        `Request failed with status ${response.status}`;
      this.handleError(response.status, message, errorData);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T>(endpoint: string, body?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * Upload file with progress tracking via XMLHttpRequest.
   */
  upload(
    endpoint: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.baseUrl}${endpoint}`;

      xhr.open('POST', url);

      // Attach auth header
      const token = useAuthStore.getState().token;
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.withCredentials = true;

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(undefined);
          }
        } else {
          reject({ status: xhr.status, message: xhr.statusText });
        }
      });

      xhr.addEventListener('error', () => {
        reject({ status: 0, message: 'Network error' });
      });

      xhr.send(formData);
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
