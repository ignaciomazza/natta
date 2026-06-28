"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, LockKeyhole, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "No se pudo iniciar sesión");
        return;
      }

      router.push("/interno/pedidos");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[color:var(--cream)] px-4 py-10">
      <div aria-hidden className="noise absolute inset-0 opacity-70" />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(245,243,241,0.5))]"
      />

      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-md rounded-[2rem] bg-[rgba(255,255,255,0.92)] p-7 shadow-[0_28px_80px_-42px_rgba(38,35,33,0.5),0_16px_36px_-28px_rgba(82,74,70,0.55)] backdrop-blur md:p-8"
      >
        <div className="text-center">
          <Image
            alt="Natta"
            className="mx-auto h-[3.6rem] w-auto object-contain"
            height={76}
            priority
            src="/images/logo/natta-logo-cropped.png"
            width={146}
          />
          <p className="-mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--caramel)]">
            Back Office
          </p>
          <h1 className="mt-6 text-2xl font-semibold text-[color:var(--chocolate-deep)]">
            Iniciar sesión
          </h1>
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-[color:var(--chocolate)]" htmlFor="email">
            Email
          </label>
          <div className="mt-2 flex h-12 items-center gap-2.5 rounded-2xl bg-[rgba(255,255,255,0.98)] px-3.5 text-[color:var(--chocolate)] shadow-[0_16px_34px_-24px_rgba(38,35,33,0.72),0_7px_16px_-14px_rgba(82,74,70,0.62),inset_0_1px_0_rgba(255,255,255,0.95)] transition-shadow focus-within:shadow-[0_20px_40px_-24px_rgba(38,35,33,0.82),0_0_0_3px_rgba(216,209,203,0.72),inset_0_1px_0_rgba(255,255,255,0.96)]">
            <Mail className="h-4 w-4 shrink-0 text-[color:var(--caramel)]" />
            <input
              autoComplete="email"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--caramel)]"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-[color:var(--chocolate)]" htmlFor="password">
            Contraseña
          </label>
          <div className="mt-2 flex h-12 items-center gap-2.5 rounded-2xl bg-[rgba(255,255,255,0.98)] px-3.5 text-[color:var(--chocolate)] shadow-[0_16px_34px_-24px_rgba(38,35,33,0.72),0_7px_16px_-14px_rgba(82,74,70,0.62),inset_0_1px_0_rgba(255,255,255,0.95)] transition-shadow focus-within:shadow-[0_20px_40px_-24px_rgba(38,35,33,0.82),0_0_0_3px_rgba(216,209,203,0.72),inset_0_1px_0_rgba(255,255,255,0.96)]">
            <LockKeyhole className="h-4 w-4 shrink-0 text-[color:var(--caramel)]" />
            <input
              autoComplete="current-password"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--caramel)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresá tu contraseña"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--caramel)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--chocolate-deep)] focus-visible:bg-[color:var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--caramel-soft)]"
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--accent-strong)] text-sm font-semibold text-white shadow-[0_18px_34px_-20px_rgba(82,74,70,0.9)] transition hover:-translate-y-0.5 hover:bg-[color:var(--chocolate-deep)] hover:shadow-[0_22px_42px_-20px_rgba(38,35,33,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--caramel-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--milk)] disabled:translate-y-0 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "ingresando..." : "ingresar"}
        </button>
      </form>
    </main>
  );
}
