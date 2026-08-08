import { Suspense } from "react";
import VerifyEmailClient from "./_client";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailClient />
    </Suspense>
  );
}
