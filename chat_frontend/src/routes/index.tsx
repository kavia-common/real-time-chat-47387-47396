import {
  component$,
  useSignal,
  $,
  useVisibleTask$,
  useStyles$,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { getAppConfig } from "~/utils/config";
import { createWSClient, type ChatMessage } from "~/utils/ws";
import styles from "./chat.css?inline";

type Room = {
  id: string;
  name: string;
};

const MOCK_ROOMS: Room[] = [
  { id: "general", name: "General" },
  { id: "random", name: "Random" },
  { id: "dev", name: "Developers" },
];

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// PUBLIC_INTERFACE
export default component$(() => {
  useStyles$(styles);

  const cfg = getAppConfig();

  const selectedRoom = useSignal<Room>(MOCK_ROOMS[0]);
  const messages = useSignal<ChatMessage[]>([
    { id: "1", user: "Alice", text: "Welcome to the chat!", ts: Date.now() - 1000 * 60 * 5 },
    { id: "2", user: "You", text: "Hi everyone 👋", ts: Date.now() - 1000 * 60 * 4, self: true },
    { id: "3", user: "Bob", text: "Hello!", ts: Date.now() - 1000 * 60 * 3 },
  ]);
  const input = useSignal("");
  const error = useSignal<string | null>(null);
  const wsStatus = useSignal<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const canSend = useSignal(false); // track connection state for send availability

  // The end-of-messages marker. Use a DOM element in a signal.
  const messagesEndRef = useSignal<Element | null>(null);

  // Auto scroll on new message (client-only after mount).
  useVisibleTask$(({ track }) => {
    // Track message length so this re-runs on append.
    track(() => messages.value.length);

    // Defer to microtask to ensure DOM updated.
    queueMicrotask(() => {
      const el = messagesEndRef.value;
      if (el && typeof (el as any).scrollIntoView === "function") {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "end" });
      }
    });
  });

  // Connect WebSocket on mount. Keep ws client inside this task's lexical scope.
  useVisibleTask$(() => {
    if (!cfg.wsUrl) {
      wsStatus.value = "disconnected";
      canSend.value = false;
      return;
    }
    wsStatus.value = "connecting";

    const client = createWSClient(cfg.wsUrl, {
      onOpen: () => {
        wsStatus.value = "connected";
        canSend.value = true;
      },
      onClose: () => {
        wsStatus.value = "disconnected";
        canSend.value = false;
      },
      onError: () => {
        wsStatus.value = "error";
        canSend.value = false;
        error.value = "WebSocket connection error.";
      },
      onMessage: (msg) => {
        messages.value = [...messages.value, msg];
      },
    });

    // Listen for send events from UI (avoids passing fn through signals)
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ user: string; text: string }>;
      if (client) {
        client.send({ user: ce.detail.user, text: ce.detail.text });
      }
    };
    window.addEventListener("ocean-chat:send", handler as EventListener);

    return () => {
      window.removeEventListener("ocean-chat:send", handler as EventListener);
      client?.close();
    };
  });

  const handleSend = $(() => {
    const text = input.value.trim();
    if (!text) return;

    const myMsg: ChatMessage = {
      id: (globalThis.crypto?.randomUUID?.() as string) || String(Date.now()),
      user: "You",
      text,
      ts: Date.now(),
      self: true,
    };

    // optimistic append
    messages.value = [...messages.value, myMsg];

    // Fire a custom event that visible task listens to for actual WS send
    if (canSend.value) {
      const evt = new CustomEvent("ocean-chat:send", {
        detail: { user: "You", text },
      });
      window.dispatchEvent(evt);
    }

    input.value = "";
  });

  const handleKeyDown = $((ev: KeyboardEvent) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      handleSend();
    }
  });

  const statusLabel =
    wsStatus.value === "connected"
      ? "Connected"
      : wsStatus.value === "connecting"
      ? "Connecting..."
      : wsStatus.value === "error"
      ? "Error"
      : "Offline";

  return (
    <div class="page">
      <aside class="surface sidebar" aria-label="Rooms and users">
        <div class="sidebar-header">
          <div class="brand" aria-label="App brand">
            <div class="brand-logo" aria-hidden="true" />
            <div class="brand-title">Ocean Chat</div>
          </div>
        </div>
        <ul class="sidebar-list" role="listbox" aria-label="Rooms">
          {MOCK_ROOMS.map((room) => (
            <li
              key={room.id}
              role="option"
              aria-selected={selectedRoom.value.id === room.id}
              class={{
                "sidebar-item": true,
                active: selectedRoom.value.id === room.id,
              }}
              tabIndex={0}
              onClick$={() => (selectedRoom.value = room)}
              onKeyDown$={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  selectedRoom.value = room;
                }
              }}
            >
              <span class="avatar" aria-hidden="true">
                {room.name.slice(0, 1).toUpperCase()}
              </span>
              <span>{room.name}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section class="surface main" aria-label="Chat area">
        <header class="main-header">
          <div class="room-title" aria-live="polite">
            #{selectedRoom.value.name}
          </div>
          <div
            class={{
              "status-pill": true,
              error: wsStatus.value === "error",
            }}
            aria-label={`WebSocket status: ${statusLabel}`}
          >
            {statusLabel}
          </div>
        </header>

        {error.value && (
          <div role="alert" class="toast">
            {error.value}
          </div>
        )}

        <div class="messages" aria-label="Messages" role="log">
          {messages.value.length === 0 && (
            <div class="empty">No messages yet. Say hello!</div>
          )}
          {messages.value.map((m) => (
            <div
              key={m.id}
              class={{
                message: true,
                self: !!m.self,
              }}
              aria-label={`${m.user} at ${formatTs(m.ts)}`}
            >
              <div class="bubble">{m.text}</div>
              <div class="meta">
                {m.user} • {formatTs(m.ts)}
              </div>
            </div>
          ))}
          <div ref={(el) => (messagesEndRef.value = el)} />
        </div>

        <div class="input-bar">
          <div class="input-wrap">
            <input
              class="input"
              type="text"
              aria-label="Type a message"
              placeholder="Message #general"
              value={input.value}
              onInput$={(_, el) => (input.value = el.value)}
              onKeyDown$={handleKeyDown}
            />
            <button
              class="btn"
              aria-label="Send message"
              title="Send"
              onClick$={handleSend}
              disabled={!input.value.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Ocean Chat",
  meta: [
    {
      name: "description",
      content:
        "A modern Qwik real-time chat UI with Ocean Professional theme.",
    },
  ],
};
