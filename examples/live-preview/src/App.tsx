import {
  AgentProvider,
  ChatInput,
  MessageList,
  useAgentContext,
  useChatStore,
} from "@neeter/react";
import type { CustomEvent } from "@neeter/types";
import { type RefObject, useCallback, useRef, useState } from "react";

function CostBadge() {
  const cost = useChatStore((s) => s.totalCost);
  if (cost === 0) return null;
  return <span className="text-xs text-muted-foreground tabular-nums">${cost.toFixed(4)}</span>;
}

function CodeDrawer({ sessionId }: { sessionId: string | null }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/preview/index.html`);
      if (res.ok) setCode(await res.text());
    } catch {
      /* ignore */
    }
  }, [sessionId]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide code" : "View code"}
      </button>
      {open && (
        <div className="absolute inset-0 top-[49px] z-10 overflow-auto bg-background">
          <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap">{code}</pre>
        </div>
      )}
    </>
  );
}

function Layout({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const { sessionId, sendMessage, stopSession } = useAgentContext();
  const isStreaming = useChatStore((s) => s.isStreaming);

  const previewSrc = sessionId ? `/api/sessions/${sessionId}/preview/index.html` : "about:blank";

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Chat pane */}
      <div className="flex w-[420px] shrink-0 flex-col border-r">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-lg font-semibold">Live Preview</h1>
          <CostBadge />
        </header>
        <MessageList className="flex-1" />
        <div className="border-t">
          <ChatInput onSend={sendMessage} onStop={stopSession} isStreaming={isStreaming} />
        </div>
      </div>

      {/* Preview pane */}
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-end border-b px-3 py-2">
          <CodeDrawer sessionId={sessionId} />
        </div>
        <iframe
          ref={iframeRef}
          src={previewSrc}
          className="h-full w-full border-0"
          title="Preview"
        />
      </div>
    </div>
  );
}

export function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const onCustomEvent = useCallback((event: CustomEvent) => {
    if (event.name === "preview_reload") {
      iframeRef.current?.contentWindow?.location.reload();
    }
  }, []);

  return (
    <AgentProvider onCustomEvent={onCustomEvent}>
      <Layout iframeRef={iframeRef} />
    </AgentProvider>
  );
}
