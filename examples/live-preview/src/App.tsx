import {
  AgentProvider,
  ChatInput,
  MessageList,
  useAgentContext,
  useChatStore,
} from "@neeter/react";
import type { CustomEvent } from "@neeter/types";
import { ArrowRight, Check, Copy, History, Plus, RotateCcw } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { type RefObject, useCallback, useRef, useState } from "react";

function CostBadge() {
  const cost = useChatStore((s) => s.totalCost);
  if (cost === 0) return null;
  return <span className="text-xs text-muted-foreground tabular-nums">${cost.toFixed(4)}</span>;
}

function Layout({ iframeRef }: { iframeRef: RefObject<HTMLIFrameElement | null> }) {
  const { sessionId, sdkSessionId, sendMessage, stopSession, resumeSession, newSession } =
    useAgentContext();
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [previousSdkSessionId, setPreviousSdkSessionId] = useState<string | null>(null);
  const [resumeInput, setResumeInput] = useState("");
  const [showResumePanel, setShowResumePanel] = useState(false);

  // Track the "active" sdkSessionId locally so it survives store.reset() during resume
  const [displaySdkSessionId, setDisplaySdkSessionId] = useState<string | null>(null);
  if (sdkSessionId && sdkSessionId !== displaySdkSessionId) {
    setDisplaySdkSessionId(sdkSessionId);
  }

  const handleNewSession = useCallback(async () => {
    if (displaySdkSessionId) setPreviousSdkSessionId(displaySdkSessionId);
    setDisplaySdkSessionId(null);
    await newSession();
  }, [displaySdkSessionId, newSession]);

  const handleResume = useCallback(
    async (targetId: string) => {
      setDisplaySdkSessionId(targetId);
      await resumeSession({ sdkSessionId: targetId });
      setResumeInput("");
      setShowResumePanel(false);
    },
    [resumeSession],
  );

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
        <header className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Live Preview</h1>
            <div className="flex items-center gap-3">
              {displaySdkSessionId && (
                <button
                  type="button"
                  className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  title="Copy session ID"
                  onClick={(e) => {
                    navigator.clipboard.writeText(displaySdkSessionId);
                    const btn = e.currentTarget;
                    btn.dataset.copied = "true";
                    setTimeout(() => delete btn.dataset.copied, 1500);
                  }}
                >
                  sdk:{displaySdkSessionId.slice(0, 8)}
                  <Copy className="size-2.5 [[data-copied]_&]:hidden" />
                  <Check className="hidden size-2.5 [[data-copied]_&]:block" />
                </button>
              )}
              <CostBadge />
              <button
                type="button"
                onClick={() => setShowResumePanel((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                title="Resume session"
              >
                <History className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNewSession}
                disabled={!displaySdkSessionId || isStreaming}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="New session"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
          {showResumePanel && (
            <div className="mt-2 flex flex-col gap-1.5 text-xs">
              {previousSdkSessionId && (
                <button
                  type="button"
                  onClick={() => handleResume(previousSdkSessionId)}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  <span className="font-mono">{previousSdkSessionId.slice(0, 8)}</span>
                </button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (resumeInput.trim()) handleResume(resumeInput.trim());
                }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  value={resumeInput}
                  onChange={(e) => setResumeInput(e.target.value)}
                  placeholder="Session ID..."
                  className="flex-1 rounded border border-muted bg-transparent px-2 py-1 font-mono text-xs"
                />
                <button
                  type="submit"
                  disabled={!resumeInput.trim()}
                  className="rounded border border-muted p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-3" />
                </button>
              </form>
            </div>
          )}
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
