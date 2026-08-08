import { Suspense } from "react";
import ResetPasswordClient from "./_client";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  );
}
