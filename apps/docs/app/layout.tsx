import "./global.css";
import type { ReactNode } from "react";
import { Provider } from "@/app/components/provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
