import type { ChatStoreShape } from "@neeter/core";
import { AgentClient, createChatStore } from "@neeter/core";
import type { ChatMessage, PermissionRequest, ToolCallInfo } from "@neeter/types";
import "./app.css";

// --- DOM refs ---

const messagesEl = document.getElementById("messages") as HTMLElement;
const permissionsEl = document.getElementById("permissions") as HTMLElement;
const form = document.getElementById("chat-form") as HTMLFormElement;
const input = document.getElementById("input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLElement;

// --- Store + Client ---

const store = createChatStore();
const client = new AgentClient(store, { endpoint: "/api" });

await client.connect();
client.attachEventSource();

// --- Auto-resize textarea ---

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
});

// --- Send / Stop ---

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.style.height = "auto";
  await client.sendMessage(text);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

stopBtn.addEventListener("click", () => client.stopSession());

// --- Rendering ---

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function toolStatusBadge(status: ToolCallInfo["status"]): string {
  const colors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    streaming_input: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    running: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  return `<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}">${status}</span>`;
}

function renderToolCall(tc: ToolCallInfo): string {
  const inputJson = Object.keys(tc.input).length
    ? `<pre class="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">${escapeHtml(JSON.stringify(tc.input, null, 2))}</pre>`
    : "";
  const result = tc.result
    ? `<pre class="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">${escapeHtml(tc.result)}</pre>`
    : "";
  const error = tc.error
    ? `<pre class="mt-1 max-h-32 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">${escapeHtml(tc.error)}</pre>`
    : "";

  return `
    <details class="rounded-md border p-3 text-sm" ${tc.status === "running" ? "open" : ""}>
      <summary class="flex cursor-pointer items-center gap-2 font-mono text-xs">
        ${toolStatusBadge(tc.status)}
        <span>${escapeHtml(tc.name)}</span>
      </summary>
      ${inputJson}${result}${error}
    </details>`;
}

function renderMessage(msg: ChatMessage): string {
  if (msg.role === "user") {
    return `
      <div class="flex justify-end">
        <div class="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">
          <pre class="whitespace-pre-wrap font-sans text-sm">${escapeHtml(msg.content)}</pre>
        </div>
      </div>`;
  }

  if (msg.role === "system") {
    return `
      <div class="flex justify-center">
        <span class="text-xs text-muted-foreground">${escapeHtml(msg.content)}</span>
      </div>`;
  }

  // assistant
  const thinking = msg.thinking
    ? `<details class="mb-2 text-xs text-muted-foreground">
        <summary class="cursor-pointer">Thinking…</summary>
        <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">${escapeHtml(msg.thinking)}</pre>
      </details>`
    : "";

  const text = msg.content
    ? `<pre class="whitespace-pre-wrap font-sans text-sm">${escapeHtml(msg.content)}</pre>`
    : "";

  const tools = (msg.toolCalls ?? []).map(renderToolCall).join("");

  return `
    <div class="max-w-[80%] space-y-2">
      ${thinking}${text}${tools}
    </div>`;
}

function renderPermission(perm: PermissionRequest): string {
  if (perm.kind === "tool_approval") {
    return `
      <div class="mb-2 flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950" data-request-id="${perm.requestId}">
        <span class="flex-1">Allow <strong class="font-mono">${escapeHtml(perm.toolName)}</strong>?</span>
        <button class="perm-allow rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700">Allow</button>
        <button class="perm-deny rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Deny</button>
      </div>`;
  }

  // user_question
  const questions = perm.questions
    .map(
      (q) => `
      <div class="mb-2" data-question="${escapeHtml(q.question)}">
        <p class="mb-1 font-medium">${escapeHtml(q.question)}</p>
        ${
          q.options
            ? q.options
                .map(
                  (opt) =>
                    `<button class="uq-option mr-1 mb-1 rounded border px-2 py-1 text-xs hover:bg-muted" data-value="${escapeHtml(opt.label)}">${escapeHtml(opt.label)}</button>`,
                )
                .join("")
            : `<input type="text" class="uq-input w-full rounded border px-2 py-1 text-sm" placeholder="Your answer…" />`
        }
      </div>`,
    )
    .join("");

  return `
    <div class="mb-2 rounded-md border p-3 text-sm" data-request-id="${perm.requestId}">
      ${questions}
      <button class="uq-submit mt-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Submit</button>
    </div>`;
}

function render(state: ChatStoreShape): void {
  // Status
  if (state.isThinking) {
    statusEl.textContent = "Thinking…";
  } else if (state.isStreaming) {
    statusEl.textContent = "Streaming…";
  } else {
    statusEl.textContent = "";
  }

  // Buttons
  sendBtn.classList.toggle("hidden", state.isStreaming);
  sendBtn.disabled = state.isStreaming;
  stopBtn.classList.toggle("hidden", !state.isStreaming);
  input.disabled = state.isStreaming;

  // Messages
  let html = state.messages.map(renderMessage).join("");

  // Streaming text (not yet flushed into a message)
  if (state.streamingThinking || state.streamingText) {
    const thinkingHtml = state.streamingThinking
      ? `<details open class="mb-2 text-xs text-muted-foreground">
          <summary class="cursor-pointer">Thinking…</summary>
          <pre class="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">${escapeHtml(state.streamingThinking)}</pre>
        </details>`
      : "";
    const textHtml = state.streamingText
      ? `<pre class="whitespace-pre-wrap font-sans text-sm">${escapeHtml(state.streamingText)}</pre>`
      : "";
    html += `<div class="max-w-[80%] space-y-2">${thinkingHtml}${textHtml}</div>`;
  }

  // Thinking indicator (no content yet)
  if (state.isThinking && !state.streamingThinking && !state.streamingText) {
    html += `
      <div class="max-w-[80%]">
        <span class="inline-block animate-pulse text-sm text-muted-foreground">Thinking…</span>
      </div>`;
  }

  messagesEl.innerHTML = html;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Permissions
  permissionsEl.innerHTML = state.pendingPermissions.map(renderPermission).join("");

  // Wire permission buttons
  for (const perm of state.pendingPermissions) {
    const el = permissionsEl.querySelector(`[data-request-id="${perm.requestId}"]`);
    if (!el) continue;

    if (perm.kind === "tool_approval") {
      el.querySelector(".perm-allow")?.addEventListener("click", () => {
        client.respondToPermission({
          kind: "tool_approval",
          requestId: perm.requestId,
          behavior: "allow",
        });
      });
      el.querySelector(".perm-deny")?.addEventListener("click", () => {
        client.respondToPermission({
          kind: "tool_approval",
          requestId: perm.requestId,
          behavior: "deny",
        });
      });
    } else {
      // user_question: collect answers from option buttons or text inputs
      const answers: Record<string, string> = {};

      el.querySelectorAll<HTMLButtonElement>(".uq-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const question = btn.closest("[data-question]")?.getAttribute("data-question") ?? "";
          answers[question] = btn.dataset.value ?? "";
          btn.classList.add("bg-primary", "text-primary-foreground");
        });
      });

      el.querySelector(".uq-submit")?.addEventListener("click", () => {
        // Also collect text inputs
        el.querySelectorAll<HTMLInputElement>(".uq-input").forEach((inp) => {
          const question = inp.closest("[data-question]")?.getAttribute("data-question") ?? "";
          if (inp.value.trim()) answers[question] = inp.value.trim();
        });
        client.respondToPermission({ kind: "user_question", requestId: perm.requestId, answers });
      });
    }
  }
}

// --- Subscribe ---

store.subscribe(render);

// Initial render
render(store.getState());
