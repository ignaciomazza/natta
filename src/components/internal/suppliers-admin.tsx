"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Handshake, Search } from "lucide-react";
import {
  Disclosure,
  Pill,
  SectionTitle,
  buttonSoftClassName,
  emptyStateClassName,
  fieldLabelClassName,
  inputClassName,
  listCardClassName,
} from "@/components/internal/ui";
import { SelectField, SelectOption } from "@/components/internal/select-field";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function SuppliersAdmin() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/suppliers", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar proveedores");
    const payload = (await response.json()) as { items: Supplier[] };
    setItems(payload.items);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Error");
    });
  }, []);

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((item) => {
      if (activeFilter === "ACTIVE" && !item.isActive) return false;
      if (activeFilter === "INACTIVE" && item.isActive) return false;
      if (!normalized) return true;

      const haystack = [
        item.name,
        item.contactName,
        item.email,
        item.phone,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [activeFilter, items, query]);

  const totals = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const item of items) {
      if (item.isActive) {
        active += 1;
      } else {
        inactive += 1;
      }
    }
    return { active, inactive, total: items.length };
  }, [items]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo crear proveedor");
      return;
    }

    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    await load();
  };

  const toggleActive = async (item: Supplier) => {
    setError(null);
    setUpdatingId(item.id);
    try {
      const response = await fetch("/api/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          isActive: !item.isActive,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo actualizar proveedor");
      }

      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <SectionTitle
        icon={Handshake}
        title="Proveedores"
      />

      <div className="flex flex-wrap gap-2">
        <Pill>Total: {totals.total}</Pill>
        <Pill tone="success">Activos: {totals.active}</Pill>
        <Pill tone="warning">Inactivos: {totals.inactive}</Pill>
      </div>

      <Disclosure
        title="Filtros de proveedores"
        variant="dashed"
      >
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr] md:items-end">
          <label className={fieldLabelClassName}>
            Buscar
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                className={`${inputClassName} pl-9`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, contacto, email o teléfono"
                value={query}
              />
            </div>
          </label>
          <label className={fieldLabelClassName}>
            Estado
            <SelectField
              onChange={(value) => setActiveFilter(value as ActiveFilter)}
              value={activeFilter}
            >
              <SelectOption value="ALL">Todos</SelectOption>
              <SelectOption value="ACTIVE">Activos</SelectOption>
              <SelectOption value="INACTIVE">Inactivos</SelectOption>
            </SelectField>
          </label>
        </div>
      </Disclosure>

      <Disclosure
        title="Nuevo proveedor"
        variant="dashed"
      >
        <form className="grid gap-3 md:grid-cols-2 md:items-end" onSubmit={onSubmit}>
          <label className={fieldLabelClassName}>
            Nombre
            <input
              className={inputClassName}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre proveedor"
              required
              value={name}
            />
          </label>
          <label className={fieldLabelClassName}>
            Contacto
            <input
              className={inputClassName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Persona de contacto"
              value={contactName}
            />
          </label>
          <label className={fieldLabelClassName}>
            Email
            <input
              className={inputClassName}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email (opcional)"
              type="email"
              value={email}
            />
          </label>
          <label className={fieldLabelClassName}>
            Teléfono
            <input
              className={inputClassName}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Teléfono (opcional)"
              value={phone}
            />
          </label>

          <button className={`${buttonSoftClassName} md:col-span-2`} type="submit">
            Guardar proveedor
          </button>
        </form>
      </Disclosure>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <article
              className={`${listCardClassName} md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] md:items-center`}
              key={item.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--chocolate-deep)]">{item.name}</p>
                <p className="mt-1 truncate text-sm text-zinc-700">{item.email || "Sin email"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Contacto</p>
                <p className="mt-1 text-sm text-zinc-700">{item.contactName || "Sin contacto"}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{item.phone || "Sin teléfono"}</p>
              </div>
              <div className="flex items-center">
                <Pill mini tone={item.isActive ? "success" : "warning"}>
                  {item.isActive ? "Activo" : "Inactivo"}
                </Pill>
              </div>
              <div className="flex md:justify-end">
                <button
                  className={`${buttonSoftClassName} w-full md:w-auto`}
                  disabled={updatingId === item.id}
                  onClick={() => void toggleActive(item)}
                  type="button"
                >
                  {item.isActive ? "Desactivar" : "Activar"}
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className={emptyStateClassName}>No hay proveedores para mostrar.</p>
        )}
      </div>
    </section>
  );
}
