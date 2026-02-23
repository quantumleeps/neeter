import type { Components } from "react-markdown";

export const markdownComponents: Partial<Components> = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  table: ({ children }) => (
    <table className="mb-2 w-full border-collapse text-sm last:mb-0">{children}</table>
  ),
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};
