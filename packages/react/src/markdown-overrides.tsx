import type { Components } from "react-markdown";

export const markdownComponents: Partial<Components> = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
};
