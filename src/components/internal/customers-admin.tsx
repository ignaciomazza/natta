"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";
import {
  Disclosure,
  Pill,
  SectionTitle,
  buttonSoftClassName,
  controlRowClassName,
  fieldLabelClassName,
  inputClassName,
  tableShellClassName,
} from "@/components/internal/ui";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
};

export function CustomersAdmin() {
  const [items, setItems] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());

    const response = await fetch(`/api/customers?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("No se pudieron cargar clientes");
    const payload = (await response.json()) as { items: Customer[] };
    setItems(payload.items);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo crear cliente");
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    await load();
  };

  const totals = useMemo(() => ({ total: items.length }), [items]);

  return (
    <section className="space-y-6">
      <SectionTitle
        description="Alta y búsqueda de clientes."
        icon={UsersRound}
        title="Clientes"
      />

      <div className="flex flex-wrap gap-2">
        <Pill>Total: {totals.total}</Pill>
      </div>

      <Disclosure
        description="Buscá clientes por nombre, teléfono o email."
        title="Filtros de clientes"
        variant="dashed"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className={fieldLabelClassName}>
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                className={`${inputClassName} pl-9`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, teléfono o email"
                value={query}
              />
            </div>
          </label>
          <div className={controlRowClassName}>
            <button className={`${buttonSoftClassName} w-full`} onClick={() => void load()} type="button">
              Aplicar
            </button>
          </div>
        </div>
      </Disclosure>

      <Disclosure
        description="Carga rápida para cliente nuevo."
        title="Nuevo cliente"
        variant="dashed"
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <input
            className={inputClassName}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre"
            required
            value={name}
          />
          <input
            className={inputClassName}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Teléfono"
            required
            value={phone}
          />
          <input
            className={inputClassName}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email (opcional)"
            type="email"
            value={email}
          />
          <input
            className={inputClassName}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Dirección (opcional)"
            value={address}
          />
          <button className={`${buttonSoftClassName} md:col-span-2`} type="submit">
            Guardar cliente
          </button>
        </form>
      </Disclosure>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3 md:hidden">
        {items.map((item) => (
          <article className="py-3" key={item.id}>
            <div>
              <p className="font-semibold text-[color:var(--chocolate-deep)]">{item.name}</p>
              <p className="text-xs text-zinc-500">{item.phone}</p>
            </div>
            <p className="mt-2 text-sm text-zinc-700">{item.email || "Sin email"}</p>
            <p className="text-sm text-zinc-700">{item.address || "Sin dirección"}</p>
          </article>
        ))}
      </div>

      <div className={tableShellClassName}>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[color:var(--line)] text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Contacto</th>
              <th className="px-3 py-3">Dirección</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-b border-[#e2ddd9] transition" key={item.id}>
                <td className="px-3 py-3">
                  <p className="font-medium text-zinc-900">{item.name}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{item.phone}</p>
                  <p className="text-xs text-zinc-500">{item.email || "Sin email"}</p>
                </td>
                <td className="px-3 py-3">{item.address || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
