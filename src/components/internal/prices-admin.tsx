"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Tags } from "lucide-react";
import { MoneyInput } from "@/components/internal/money-input";
import {
  Pill,
  SectionTitle,
  buttonSoftClassName,
} from "@/components/internal/ui";

type PriceSize = {
  id: string;
  slug: string;
  name: string;
};

type FlavorPrice = {
  sizeId: string;
  sizeSlug: string;
  sizeName: string;
  amountArs: number | null;
  available: boolean;
};

type PriceFlavor = {
  id: string;
  slug: string;
  name: string;
  description: string;
  prices: FlavorPrice[];
};

type PricesPayload = {
  sizes: PriceSize[];
  flavors: PriceFlavor[];
};

type PriceDraft = {
  display: string;
  amount: number;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

function priceKey(flavorId: string, sizeId: string) {
  return `${flavorId}::${sizeId}`;
}

function formatInputAmount(value: number | null) {
  if (!value) return "";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);
}

const priceMoneyInputClassName =
  "!h-11 !rounded-[1.15rem] !border-white/60 !bg-white/90 shadow-[0_8px_20px_rgba(43,26,24,0.08)] ring-1 ring-[#eadfd8]/45 focus:!border-[color:var(--accent-soft)] focus:!ring-[color:var(--accent-soft)]";

export function PricesAdmin() {
  const [sizes, setSizes] = useState<PriceSize[]>([]);
  const [flavors, setFlavors] = useState<PriceFlavor[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/prices", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudieron cargar precios");
      }

      const payload = (await response.json()) as PricesPayload;
      const nextDrafts: Record<string, PriceDraft> = {};
      for (const flavor of payload.flavors) {
        for (const price of flavor.prices) {
          nextDrafts[priceKey(flavor.id, price.sizeId)] = {
            amount: price.amountArs ?? 0,
            display: formatInputAmount(price.amountArs),
          };
        }
      }

      setSizes(payload.sizes);
      setFlavors(payload.flavors);
      setDrafts(nextDrafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const saveFlavor = async (flavor: PriceFlavor) => {
    setSavingKey(flavor.id);
    setError(null);

    try {
      const response = await fetch("/api/prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: flavor.prices
            .filter((price) => price.available)
            .map((price) => ({
              flavorId: flavor.id,
              sizeId: price.sizeId,
              amountArs: drafts[priceKey(flavor.id, price.sizeId)]?.amount || null,
            })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo guardar");
      }

      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSavingKey(null);
    }
  };

  const saveAll = async () => {
    setSavingKey("all");
    setError(null);

    try {
      const response = await fetch("/api/prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prices: flavors.flatMap((flavor) =>
            flavor.prices
              .filter((price) => price.available)
              .map((price) => ({
                flavorId: flavor.id,
                sizeId: price.sizeId,
                amountArs: drafts[priceKey(flavor.id, price.sizeId)]?.amount || null,
              })),
          ),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo guardar");
      }

      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSavingKey(null);
    }
  };

  const summary = useMemo(() => {
    let activePrices = 0;
    let totalAmount = 0;
    for (const flavor of flavors) {
      for (const price of flavor.prices) {
        if (!price.available) continue;
        const draft = drafts[priceKey(flavor.id, price.sizeId)];
        if (!draft?.amount) continue;
        activePrices += 1;
        totalAmount += draft.amount;
      }
    }
    return {
      activePrices,
      average: activePrices ? Math.round(totalAmount / activePrices) : 0,
    };
  }, [drafts, flavors]);

  return (
    <section className="space-y-6">
      <SectionTitle
        action={
          <button
            className={`${buttonSoftClassName} inline-flex items-center gap-2`}
            disabled={savingKey !== null || !flavors.length}
            onClick={() => void saveAll()}
            type="button"
          >
            <Save className="h-4 w-4" />
            {savingKey === "all" ? "Guardando..." : "Guardar todo"}
          </button>
        }
        icon={Tags}
        title="Precios"
      />

      <div className="flex flex-wrap gap-2">
        <Pill>Sabores: {flavors.length}</Pill>
        <Pill>Tamaños: {sizes.length}</Pill>
        <Pill tone="info">Precios activos: {summary.activePrices}</Pill>
        {summary.average ? (
          <Pill tone="success">Promedio: {formatMoney(summary.average)}</Pill>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-600">Cargando precios...</p>
      ) : (
        <div className="space-y-3">
          {flavors.map((flavor) => (
            <article
              className="grid gap-4 rounded-[1.6rem] bg-[color:var(--milk)]/92 p-4 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.72),0_8px_18px_-18px_rgba(82,74,70,0.48)] transition-shadow hover:shadow-[0_20px_44px_-30px_rgba(38,35,33,0.78),0_12px_24px_-18px_rgba(82,74,70,0.52)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)_auto] lg:items-center"
              key={flavor.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--chocolate-deep)]">
                  {flavor.name}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{flavor.description}</p>
              </div>

              <div className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
                {flavor.prices.map((price) => {
                  const key = priceKey(flavor.id, price.sizeId);
                  const draft = drafts[key] ?? { amount: 0, display: "" };

                  return (
                    <label
                      className={`min-w-0 space-y-2 ${price.available ? "" : "opacity-55"}`}
                      key={price.sizeId}
                    >
                      <span className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                          {price.sizeName}
                        </span>
                        {!price.available ? <Pill mini>No disponible</Pill> : null}
                      </span>
                      <MoneyInput
                        className={priceMoneyInputClassName}
                        disabled={!price.available}
                        onChange={(next) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: next,
                          }))
                        }
                        placeholder="Sin precio"
                        value={draft.display}
                      />
                    </label>
                  );
                })}
              </div>

              <button
                className={`${buttonSoftClassName} inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap lg:self-end`}
                disabled={savingKey !== null}
                onClick={() => void saveFlavor(flavor)}
                type="button"
              >
                <Save className="h-4 w-4" />
                {savingKey === flavor.id ? "Guardando..." : "Guardar"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
