"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@natta.local");
  const [password, setPassword] = useState("");
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

      router.push("/interno");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-[0_24px_70px_-50px_rgba(0,0,0,0.35)]"
      >
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Natta Backend</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Panel interno para pedidos, cupos, clientes, compras, gastos y cobros.
        </p>

        <label className="mt-6 block text-sm text-zinc-700">
          Email
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none transition focus:border-zinc-500"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="mt-4 block text-sm text-zinc-700">
          Contraseña
          <input
            className="mt-2 h-11 w-full rounded-xl border border-zinc-300 px-3 outline-none transition focus:border-zinc-500"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          Usuario inicial sugerido: <strong className="text-zinc-800">admin@natta.local</strong>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          className="mt-6 h-11 w-full rounded-xl bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
