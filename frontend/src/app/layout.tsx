import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata: Metadata = {
  title: "HR Contact Intelligence Platform",
  description:
    "Evidence-first discovery of real, verified HR & recruitment contacts. " +
    "No generated emails, no guessed confidence scores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
