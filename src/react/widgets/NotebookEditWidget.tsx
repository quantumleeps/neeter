import type { WidgetProps } from "../../types.js";
import { registerWidget } from "../registry.js";

function basename(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

const modeLabel: Record<string, string> = {
  replace: "Replace cell",
  insert: "Insert cell",
  delete: "Delete cell",
};

function NotebookEditInputRenderer({ input }: { input: Record<string, unknown> }) {
  const notebookPath = typeof input.notebook_path === "string" ? input.notebook_path : null;
  const editMode = typeof input.edit_mode === "string" ? input.edit_mode : "replace";
  const cellType = typeof input.cell_type === "string" ? input.cell_type : null;
  const cellId = typeof input.cell_id === "string" ? input.cell_id : null;
  const cellNumber = typeof input.cell_number === "number" ? input.cell_number : null;
  const newSource = typeof input.new_source === "string" ? input.new_source : null;
  if (!notebookPath) return null;
  const cellRef = cellId ?? (cellNumber != null ? `cell ${cellNumber}` : null);
  const cellLabel =
    cellRef && editMode === "insert"
      ? `after ${cellRef}`
      : cellRef;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="text-xs text-muted-foreground">
        {modeLabel[editMode] ?? editMode}
        {cellType && <span className="ml-1 opacity-70">[{cellType}]</span>}
        {cellLabel && <span className="ml-1 font-mono opacity-70">{cellLabel}</span>}
        <span className="ml-1.5 font-mono opacity-70">{basename(notebookPath)}</span>
      </div>
      {newSource && editMode !== "delete" && (
        <pre className="text-[11px] leading-snug text-muted-foreground bg-accent rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto">
          <code>{newSource}</code>
        </pre>
      )}
    </div>
  );
}

function NotebookEditWidget({ input, phase }: WidgetProps<string>) {
  const notebookPath = typeof input.notebook_path === "string" ? input.notebook_path : null;
  const editMode = typeof input.edit_mode === "string" ? input.edit_mode : "replace";
  const cellType = typeof input.cell_type === "string" ? input.cell_type : null;
  const newSource = typeof input.new_source === "string" ? input.new_source : null;

  if (phase === "running" || phase === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <span className="animate-pulse">Editing {notebookPath ? basename(notebookPath) : "notebook"}&hellip;</span>
      </div>
    );
  }

  return (
    <div className="py-1 space-y-1.5">
      <div className="text-xs text-muted-foreground">
        {editMode === "insert" ? "Inserted" : editMode === "delete" ? "Deleted" : "Replaced"} cell
        {cellType && <span className="ml-1 opacity-70">[{cellType}]</span>}
      </div>
      {newSource && editMode !== "delete" && (
        <pre className="text-[11px] leading-snug text-foreground bg-accent rounded px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
          <code>{newSource}</code>
        </pre>
      )}
    </div>
  );
}

registerWidget<string>({
  toolName: "NotebookEdit",
  label: "Notebook Edit",
  richLabel: (_r, input) => {
    const notebookPath = typeof input.notebook_path === "string" ? input.notebook_path : null;
    const editMode = typeof input.edit_mode === "string" ? input.edit_mode : null;
    const name = notebookPath ? basename(notebookPath) : null;
    if (!name) return null;
    return editMode && editMode !== "replace" ? `${editMode} ${name}` : name;
  },
  inputRenderer: NotebookEditInputRenderer,
  component: NotebookEditWidget,
});
