export type ChatMessage = {
  id: string;
  user: string;
  text: string;
  ts: number;
  self?: boolean;
};

export type WSHandlers = {
  onOpen?: () => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (ev?: Event) => void;
  onMessage?: (msg: ChatMessage) => void;
};

export type WSClient = {
  send: (msg: Omit<ChatMessage, "id" | "ts">) => void;
  close: () => void;
  isConnected: () => boolean;
};

// PUBLIC_INTERFACE
export function createWSClient(wsUrl: string | undefined, handlers: WSHandlers = {}): WSClient | undefined {
  /** Create a basic WebSocket client for chat messages using JSON payloads. */
  if (!wsUrl) {
    console.warn("[WS] VITE_WS_URL is not set. WebSocket disabled.");
    return undefined;
  }

  let socket: WebSocket | undefined;
  try {
    socket = new WebSocket(wsUrl);
  } catch (e) {
    console.error("[WS] Failed to create WebSocket:", e);
    return undefined;
  }

  let connected = false;

  socket.addEventListener("open", () => {
    connected = true;
    console.info("[WS] Connected");
    handlers.onOpen?.();
  });

  socket.addEventListener("close", (ev) => {
    connected = false;
    console.warn("[WS] Closed", ev);
    handlers.onClose?.(ev);
  });

  socket.addEventListener("error", (ev) => {
    console.error("[WS] Error", ev);
    handlers.onError?.(ev);
  });

  socket.addEventListener("message", (ev) => {
    try {
      const data = JSON.parse(String(ev.data));
      // Expecting data in shape: { id, user, text, ts }
      if (data && typeof data.text === "string") {
        // Prefer crypto.randomUUID when available; fall back to Date.now
        const id =
          typeof globalThis.crypto !== "undefined" &&
          typeof (globalThis.crypto as any).randomUUID === "function"
            ? (globalThis.crypto as any).randomUUID()
            : String(Date.now());
        handlers.onMessage?.({
          id: String(data.id ?? id),
          user: String(data.user ?? "unknown"),
          text: String(data.text),
          ts: Number(data.ts ?? Date.now()),
          self: false,
        });
      }
    } catch {
      console.warn("[WS] Non-JSON or invalid message:", ev.data);
    }
  });

  return {
    send: (msg) => {
      if (socket?.readyState === WebSocket.OPEN) {
        const payload = { user: msg.user, text: msg.text };
        socket.send(JSON.stringify(payload));
      } else {
        console.warn("[WS] Cannot send, socket not open");
      }
    },
    close: () => {
      socket && socket.close();
    },
    isConnected: () => connected,
  };
}
