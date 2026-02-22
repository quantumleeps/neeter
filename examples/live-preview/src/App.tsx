import {
  AgentProvider,
  ChatInput,
  MessageList,
  useAgentContext,
  useChatStore,
} from "@neeter/react";
import type { CustomEvent } from "@neeter/types";
import { Highlight, themes } from "prism-react-renderer";
import { type RefObject, useCallback, useRef, useState } from "react";

function CostBadge() {
  const cost = useChatStore((s) => s.totalCost);
  if (cost === 0) return null;
  return <span className="text-xs text-muted-foreground tabular-nums">${cost.toFixed(4)}</span>;
}

function Layout({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const { sessionId, sendMessage, stopSession } = useAgentContext();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");

  const refreshCode = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/source`);
      if (res.ok) setCode(await res.text());
    } catch {
      /* ignore */
    }
  }, [sessionId]);

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
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end border-b px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setCodeOpen((v) => !v);
              if (!codeOpen) refreshCode();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {codeOpen ? "Hide code" : "View code"}
          </button>
        </div>
        <div className="relative flex-1">
          {codeOpen && (
            <div className="absolute inset-0 z-10 overflow-auto bg-zinc-900/95 backdrop-blur-sm">
              <Highlight code={code.trimEnd()} language="jsx" theme={themes.nightOwl}>
                {({ tokens, getLineProps, getTokenProps }) => (
                  <pre className="p-4 text-xs leading-relaxed !bg-transparent">
                    {tokens.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: tokens lack stable IDs
                      <div key={i} {...getLineProps({ line })}>
                        <span className="inline-block w-8 text-right mr-4 text-zinc-600 select-none">
                          {i + 1}
                        </span>
                        {line.map((token, key) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: tokens lack stable IDs
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={previewSrc}
            className="h-full w-full border-0"
            title="Preview"
          />
        </div>
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
