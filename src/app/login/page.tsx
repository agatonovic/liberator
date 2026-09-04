"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isCloudMode } from "@/lib/session";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const cloud = isCloudMode();
  const [email, setEmail] = useState("demo@labelator.local");
  const [password, setPassword] = useState("demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cloud) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">Local demo</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This install signs you in as Demo Admin in the Stellantis Kragujevac workspace. No password is required.
          Switch to Demo Operator from Settings → Members when you need to check the operator path.
        </p>
        <Button onClick={() => router.push("/templates")}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <form
        className="w-full max-w-sm space-y-3 rounded-xl border border-[#d0d7de] bg-white p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/cloud/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const json = (await res.json()) as { error?: string };
            if (!res.ok) {
              setError(json.error || "Could not sign in.");
              return;
            }
            router.push("/templates");
          } catch {
            setError("Network or server failure.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Pilot cloud login for your organization.</p>
        <label className="block text-sm">
          Email
          <Input className="mt-1" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-sm">
          Password
          <Input
            className="mt-1"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-[#c5221f]">{error}</p> : null}
        <Button className="w-full" disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
