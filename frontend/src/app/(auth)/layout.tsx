export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4">
      {children}
    </div>
  );
}
