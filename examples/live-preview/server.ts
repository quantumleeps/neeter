import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { serve } from "@hono/node-server";
import {
  createAgentRouter,
  createSandboxHook,
  MessageTranslator,
  SessionManager,
} from "@neeter/server";
import { Hono } from "hono";

// The Agent SDK spawns a Claude Code subprocess. If we're running inside
// a Claude Code session, CLAUDECODE causes the subprocess to refuse to start.
delete process.env.CLAUDECODE;

const SANDBOXES_DIR = resolve("sandboxes");

// HTML shell template — app.jsx content is injected at serve time via {{APP_CODE}}.
// The agent only reads/edits app.jsx; this template never touches the sandbox.
const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19",
      "react/": "https://esm.sh/react@19/",
      "react-dom/client": "https://esm.sh/react-dom@19/client",
      "d3": "https://esm.sh/d3@7",
      "chart.js": "https://esm.sh/chart.js@4",
      "chart.js/auto": "https://esm.sh/chart.js@4/auto",
      "react-markdown": "https://esm.sh/react-markdown@10?deps=react@19",
      "recharts": "https://esm.sh/recharts@2?deps=react@19,react-dom@19",
      "three": "https://esm.sh/three@0.170",
      "framer-motion": "https://esm.sh/framer-motion@12?deps=react@19,react-dom@19"
    }
  }
  </script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
{{APP_CODE}}
  </script>
</body>
</html>`;

const SCAFFOLD_APP = `import React from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">Ready</h1>
        <p className="text-slate-500">Send a message to get started.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
`;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".jsx": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

interface SessionContext {
  sandboxDir: string;
}

const sessions = new SessionManager<SessionContext>(() => {
  const sandboxId = crypto.randomUUID();
  const sandboxDir = resolve(SANDBOXES_DIR, sandboxId);
  mkdirSync(sandboxDir, { recursive: true });
  writeFileSync(join(sandboxDir, "app.jsx"), SCAFFOLD_APP);

  return {
    context: { sandboxDir },
    model: "claude-haiku-4-5-20251001",
    cwd: sandboxDir,
    permissionMode: "default",
    tools: ["Read", "Write", "Edit", "Glob", "Grep", "TodoWrite"],
    allowedTools: ["Read", "Glob", "Grep", "Edit", "TodoWrite"],
    disallowedTools: ["WebFetch", "WebSearch", "NotebookEdit"],
    hooks: {
      PreToolUse: createSandboxHook(sandboxDir, resolve),
    },
    systemPrompt: `You are a creative web developer. Your workspace is ${sandboxDir}.

Workflow:
1. Read app.jsx first — it contains the React app code
2. Use the Edit tool to modify app.jsx — never use Write to overwrite the entire file
3. Do NOT read or modify index.html — it is a shell that loads Tailwind, Babel, and the import map. Everything you need is in app.jsx.

Rules:
- Build in app.jsx (unless the user asks for additional files)
- app.jsx is injected into the preview page automatically
- Favor the simplest solution — short, clean code over elaborate implementations
- Tailwind CSS is available via CDN — use utility classes for all styling
- When the user describes a page, build it immediately — don't ask clarifying questions

Available packages (pre-configured in import map):
- react, react-dom/client — already mounted, write JSX directly in app.jsx
- d3 — data visualization
- chart.js, chart.js/auto — charts
- recharts — React chart components
- react-markdown — render markdown
- three — 3D graphics
- framer-motion — animations

Usage: import from bare specifiers (e.g. import * as d3 from "d3").
For packages NOT in the import map, use full URLs: import x from "https://esm.sh/package-name".

You are building a live preview that the user can see updating in real time.`,
  };
});

const translator = new MessageTranslator<SessionContext>({
  onToolResult: (toolName) => {
    if (toolName === "Write" || toolName === "Edit") {
      return [{ name: "preview_reload", value: {} }];
    }
    return [];
  },
});

const agentRouter = createAgentRouter({ sessions, translator });

const app = new Hono();
app.route("/", agentRouter);

// Return raw app.jsx source for the code viewer (separate from preview composition).
app.get("/api/sessions/:id/source", (c) => {
  const session = sessions.get(c.req.param("id"));
  if (!session) return c.json({ error: "Session not found" }, 404);
  try {
    const code = readFileSync(join(session.context.sandboxDir, "app.jsx"), "utf-8");
    return c.body(code, 200, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-cache",
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// Serve sandbox files for the preview iframe.
// index.html is composed on-the-fly by injecting app.jsx into HTML_TEMPLATE
// so the agent only ever reads/edits app.jsx — the HTML shell stays out of context.
app.get("/api/sessions/:id/preview/*", (c) => {
  const session = sessions.get(c.req.param("id"));
  if (!session) return c.json({ error: "Session not found" }, 404);

  const requestedPath = c.req.param("*") || "index.html";

  // Compose index.html dynamically from template + app.jsx
  if (requestedPath === "index.html") {
    try {
      const appCode = readFileSync(join(session.context.sandboxDir, "app.jsx"), "utf-8");
      const html = HTML_TEMPLATE.replace("{{APP_CODE}}", appCode);
      return c.body(html, 200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
      });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  }

  const filePath = normalize(join(session.context.sandboxDir, requestedPath));

  // Prevent path traversal
  if (!filePath.startsWith(session.context.sandboxDir)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const content = readFileSync(filePath);
    const mime = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    return c.body(content, 200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

const port = Number(process.env.PORT ?? 3000);
console.log(`Server listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
