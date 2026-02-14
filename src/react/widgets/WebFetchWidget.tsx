import Markdown from "react-markdown";
import type { WidgetProps } from "../../types.js";
import { markdownComponents } from "../markdown-overrides.js";
import { registerWidget } from "../registry.js";

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  } catch {
    return undefined;
  }
}

function WebFetchInputRenderer({ input }: { input: Record<string, unknown> }) {
  const url = typeof input.url === "string" ? input.url : null;
  const prompt = typeof input.prompt === "string" ? input.prompt : null;
  if (!url) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] leading-none whitespace-nowrap max-w-[280px] text-muted-foreground no-underline hover:bg-accent/80 hover:text-primary transition-colors"
      >
        <img
          src={faviconUrl(url)}
          alt=""
          width={14}
          height={14}
          className="rounded-full shrink-0"
        />
        <span className="truncate">{domain(url)}</span>
      </a>
      {prompt && <div className="text-xs italic text-muted-foreground">&ldquo;{prompt}&rdquo;</div>}
    </div>
  );
}

function WebFetchWidget({ result, input, phase }: WidgetProps<string>) {
  if (phase === "running" || phase === "pending") {
    const url = typeof input.url === "string" ? input.url : null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Fetching {url ? domain(url) : "page"}&hellip;</span>
      </div>
    );
  }

  if (typeof result !== "string" || !result) return null;

  const url = typeof input.url === "string" ? input.url : null;

  return (
    <div className="py-1 space-y-1.5 text-xs">
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] leading-none whitespace-nowrap max-w-[280px] text-muted-foreground no-underline hover:bg-accent/80 hover:text-primary transition-colors"
        >
          <img
            src={faviconUrl(url)}
            alt=""
            width={14}
            height={14}
            className="rounded-full shrink-0"
          />
          <span className="truncate">{domain(url)}</span>
        </a>
      )}
      <div className="text-foreground leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Markdown components={markdownComponents}>{result}</Markdown>
      </div>
    </div>
  );
}

registerWidget<string>({
  toolName: "WebFetch",
  label: "Web Fetch",
  richLabel: (_r, input) => {
    const url = typeof input.url === "string" ? input.url : null;
    return url ? domain(url) : null;
  },
  inputRenderer: WebFetchInputRenderer,
  component: WebFetchWidget,
});
