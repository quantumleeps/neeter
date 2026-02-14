import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

function parseTodos(input: Record<string, unknown>): TodoItem[] {
  if (!Array.isArray(input.todos)) return [];
  return input.todos.filter(
    (t): t is TodoItem =>
      t != null &&
      typeof t === "object" &&
      typeof (t as Record<string, unknown>).content === "string" &&
      typeof (t as Record<string, unknown>).status === "string",
  );
}

function TodoList({ todos }: { todos: TodoItem[] }) {
  return (
    <div className="space-y-0.5 text-xs">
      {todos.map((todo, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: todo items lack stable IDs
        <div key={i} className="flex items-start gap-2">
          <span className="shrink-0 w-4 text-center">
            {todo.status === "completed" ? (
              <span className="text-green-600 dark:text-green-400">&#x2713;</span>
            ) : todo.status === "in_progress" ? (
              <span className="text-blue-600 dark:text-blue-400">&#x25CB;</span>
            ) : (
              <span className="text-muted-foreground">&#x25CB;</span>
            )}
          </span>
          <span
            className={
              todo.status === "completed"
                ? "text-muted-foreground line-through"
                : todo.status === "in_progress"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
            }
          >
            {todo.content}
          </span>
        </div>
      ))}
    </div>
  );
}

function TodoWriteWidget({ input, phase }: WidgetProps<string>) {
  const todos = parseTodos(input);

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Updating tasks&hellip;</span>
      </div>
    );
  }

  if (!todos.length) return null;

  return (
    <div className="py-1">
      <TodoList todos={todos} />
    </div>
  );
}

registerWidget<string>({
  toolName: "TodoWrite",
  label: "Todo",
  richLabel: (_r, input) => {
    const todos = parseTodos(input);
    if (!todos.length) return null;
    const done = todos.filter((t) => t.status === "completed").length;
    return `${done}/${todos.length} done`;
  },
  component: TodoWriteWidget,
});
