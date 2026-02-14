import { useState } from "react";
import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

interface SearchLink {
  title: string;
  url: string;
}

interface ParsedSearch {
  query: string;
  links: SearchLink[];
}

function extractJsonArray(str: string, start: number): string | null {
  if (str[start] !== "[") return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "[") depth++;
    else if (str[i] === "]") {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

function parseSearchResult(raw: unknown): ParsedSearch | null {
  if (typeof raw !== "string") return null;
  const queryMatch = raw.match(/^Web search results for query: "(.+?)"\n/);
  if (!queryMatch) return null;
  const linksIdx = raw.indexOf("Links: [");
  if (linksIdx === -1) return null;
  const jsonStr = extractJsonArray(raw, linksIdx + 7);
  if (!jsonStr) return null;
  try {
    const links = JSON.parse(jsonStr) as SearchLink[];
    return { query: queryMatch[1], links };
  } catch {
    return null;
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

function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function WebSearchInputRenderer({ input }: { input: Record<string, unknown> }) {
  const query = typeof input.query === "string" ? input.query : null;
  if (!query) return null;
  return <div className="mt-1.5 text-xs italic text-muted-foreground">&ldquo;{query}&rdquo;</div>;
}

function WebSearchWidget({ result, phase }: WidgetProps<string>) {
  const [expanded, setExpanded] = useState(false);

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Searching the web&hellip;</span>
      </div>
    );
  }

  const parsed = parseSearchResult(result);
  if (!parsed) return null;

  const pills = parsed.links.map((link) => (
    <a
      key={link.url}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.title}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] leading-none whitespace-nowrap max-w-[180px] text-muted-foreground no-underline hover:bg-accent/80 hover:text-primary transition-colors shrink-0"
    >
      <img
        src={faviconUrl(link.url)}
        alt=""
        width={14}
        height={14}
        className="rounded-full shrink-0"
      />
      <span className="truncate">{domain(link.url)}</span>
    </a>
  ));

  if (expanded) {
    return (
      <div className="py-1 space-y-1.5">
        <div className="flex flex-wrap gap-1.5">{pills}</div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Show less
        </button>
      </div>
    );
  }

  return (
    <div className="py-1 space-y-0.5">
      <div className="relative">
        <div className="flex flex-nowrap gap-1.5 overflow-hidden max-h-[22px]">{pills}</div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-accent/50 to-transparent" />
      </div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-0.5"
      >
        Show all {parsed.links.length} sources
      </button>
    </div>
  );
}

registerWidget<string>({
  toolName: "WebSearch",
  label: "Web Search",
  richLabel: (r) => {
    const p = parseSearchResult(r);
    return p ? `"${p.query}" · ${p.links.length} sources` : null;
  },
  inputRenderer: WebSearchInputRenderer,
  component: WebSearchWidget,
});
