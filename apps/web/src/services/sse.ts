import { useAuthStore } from '@/stores/authStore';

type SSEMessageHandler = (data: unknown) => void;

class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 3000;
  private maxReconnectDelay = 30000;
  private handlers: Map<string, SSEMessageHandler[]> = new Map();
  private connected = false;

  /**
   * Connect to SSE endpoint for prescription notifications.
   * Only connects when user role is 'assistant'.
   */
  connect(): void {
    const user = useAuthStore.getState().user;
    const token = useAuthStore.getState().token;

    // Only assistant role receives SSE notifications
    if (!user || user.role !== 'assistant') {
      return;
    }

    if (this.eventSource) {
      this.disconnect();
    }

    const url = `/api/prescriptions/events?token=${encodeURIComponent(token || '')}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 3000; // Reset delay on successful connection
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('prescription', data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.eventSource.addEventListener('new-prescription', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        this.emit('new-prescription', data);
      } catch {
        // Ignore malformed messages
      }
    });

    this.eventSource.onerror = () => {
      this.connected = false;
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };
  }

  /**
   * Disconnect from SSE and cancel any pending reconnect.
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connected = false;
  }

  /**
   * Register a handler for a specific event type.
   */
  on(event: string, handler: SSEMessageHandler): void {
    const existing = this.handlers.get(event) || [];
    existing.push(handler);
    this.handlers.set(event, existing);
  }

  /**
   * Remove a handler for a specific event type.
   */
  off(event: string, handler: SSEMessageHandler): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(
      event,
      existing.filter((h) => h !== handler)
    );
  }

  /**
   * Check if currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff capped at maxReconnectDelay
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay
    );
  }
}

export const sseClient = new SSEClient();
