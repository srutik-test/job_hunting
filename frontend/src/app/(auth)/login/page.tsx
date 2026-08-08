import { Suspense } from "react";
import LoginClient from "./_client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
