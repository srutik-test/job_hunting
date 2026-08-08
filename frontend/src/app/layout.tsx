import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";

export const metadata: Metadata = {
  title: "HR & Recruitment Contact Intelligence Platform",
  description:
    "Production-ready platform to extract verified public HR and recruitment contacts from company websites and public LinkedIn profiles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        <Navbar />
        <div className="flex min-h-[calc(100vh-4rem)] max-w-7xl mx-auto w-full">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
