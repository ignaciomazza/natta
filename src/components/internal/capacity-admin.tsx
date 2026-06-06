"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import {
  Pill,
  SectionTitle,
  Toggle,
  buttonGhostClassName,
  buttonSoftClassName,
  controlRowClassName,
  fieldLabelClassName,
  inputClassName,
} from "@/components/internal/ui";

type CapacityItem = {
  date: string;
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  bookedUnits: number;
  availableUnits: number;
  source: "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
};

type ExceptionEditor = {
  date: string;
  isClosed: boolean;
  maxUnits: number;
  bookedUnits: number;
  availableUnits: number;
  hasOverride: boolean;
};

const weekdayOptions = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

const weekdayLabel = new Map(weekdayOptions.map((item) => [item.value, item.label]));
const argentinaTimeZone = "America/Argentina/Buenos_Aires";
const shortDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: argentinaTimeZone,
});
const longDateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: argentinaTimeZone,
});

function parseIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function capitalize(text: string) {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

function formatCapacityDate(date: string, detailed = false) {
  const value = detailed
    ? longDateFormatter.format(parseIsoDate(date))
    : shortDateFormatter.format(parseIsoDate(date));
  return capitalize(value);
}

function getOccupancyPercent(booked: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((booked / max) * 100)));
}

export function CapacityAdmin() {
  const [items, setItems] = useState<CapacityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingException, setSavingException] = useState(false);

  const [weekday, setWeekday] = useState(1);
  const [weekdayOpen, setWeekdayOpen] = useState(true);
  const [weekdayMax, setWeekdayMax] = useState(20);
  const [weeklyPanelOpen, setWeeklyPanelOpen] = useState(false);

  const [exceptionEditor, setExceptionEditor] = useState<ExceptionEditor | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/capacity/calendar?days=21", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("No se pudo cargar capacidad");
      }
      const payload = (await response.json()) as { items: CapacityItem[] };
      setItems(payload.items);
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

  useEffect(() => {
    if (!exceptionEditor) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExceptionEditor(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exceptionEditor]);

  const saveWeekday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/capacity/weekday", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekday,
        isOpen: weekdayOpen,
        maxUnits: weekdayMax,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo guardar");
      return;
    }

    await load();
  };

  const openExceptionEditor = (item: CapacityItem) => {
    setExceptionEditor({
      date: item.date,
      isClosed: !item.isOpen,
      maxUnits: item.maxUnits,
      bookedUnits: item.bookedUnits,
      availableUnits: item.availableUnits,
      hasOverride: item.hasOverride,
    });
  };

  const saveException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!exceptionEditor) return;

    setError(null);
    setSavingException(true);

    const response = await fetch("/api/capacity/override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: exceptionEditor.date,
        isClosed: exceptionEditor.isClosed,
        maxUnits: exceptionEditor.isClosed ? 0 : exceptionEditor.maxUnits,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "No se pudo guardar excepción");
      setSavingException(false);
      return;
    }

    await load();
    setSavingException(false);
    setExceptionEditor(null);
  };

  const summary = useMemo(() => {
    const withOverride = items.filter((item) => item.hasOverride).length;
    const closed = items.filter((item) => !item.isOpen).length;
    return {
      total: items.length,
      withOverride,
      closed,
    };
  }, [items]);

  return (
    <section className="space-y-7">
      <SectionTitle
        description="Configurá la regla semanal y tocá una fecha para aplicar una excepción puntual."
        icon={CalendarDays}
        title="Cupos de producción"
      />

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Pill>Total de fechas: {summary.total}</Pill>
        <Pill tone="warning">Días cerrados: {summary.closed}</Pill>
        <Pill tone="info">Con excepción: {summary.withOverride}</Pill>
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--milk)]/90 p-4">
          <button
            aria-controls="regla-semanal-contenido"
            aria-expanded={weeklyPanelOpen}
            className="flex w-full cursor-pointer items-start justify-between gap-3 text-left"
            onClick={() => setWeeklyPanelOpen((prev) => !prev)}
            type="button"
          >
            <div>
              <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                Regla semanal
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Base por día de la semana. Se aplica por defecto si no hay excepción.
              </p>
            </div>
            <ChevronDown
              className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ${
                weeklyPanelOpen ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          <div
            aria-hidden={!weeklyPanelOpen}
            className={`grid transition-all duration-300 ease-out ${
              weeklyPanelOpen
                ? "mt-4 grid-rows-[1fr] opacity-100"
                : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
            id="regla-semanal-contenido"
          >
            <div className={`overflow-hidden ${weeklyPanelOpen ? "" : "pointer-events-none"}`}>
              <form className="space-y-4" onSubmit={saveWeekday}>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <button
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        weekday === option.value
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-strong)] text-white"
                          : "border-[color:var(--line)] bg-[color:var(--milk)] text-zinc-700 hover:border-[color:var(--accent)]"
                      }`}
                      key={option.value}
                      onClick={() => setWeekday(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className={`${fieldLabelClassName} block`}>
                  Cupo máximo
                  <input
                    className={inputClassName}
                    min={0}
                    onChange={(event) => setWeekdayMax(Number(event.target.value))}
                    type="number"
                    value={weekdayMax}
                  />
                </label>

                <div className={controlRowClassName}>
                  <Toggle
                    checked={weekdayOpen}
                    label="Día habilitado"
                    onChange={setWeekdayOpen}
                  />
                </div>

                <button className={`${buttonSoftClassName} block`} type="submit">
                  Guardar regla semanal
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 p-4">
          {loading ? (
            <p className="text-sm text-zinc-600">Cargando calendario...</p>
          ) : (
            <>
              <div className="divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] bg-white/70 px-2 md:hidden">
                {items.map((item) => (
                  <button
                    className="w-full cursor-pointer px-1 py-3 text-left transition hover:bg-[color:var(--surface-soft)]/55"
                    key={item.date}
                    onClick={() => openExceptionEditor(item)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-left text-sm ${
                          item.hasOverride
                            ? "font-semibold text-[color:var(--accent-strong)]"
                            : "font-medium text-[color:var(--chocolate-deep)]"
                        }`}
                      >
                        {formatCapacityDate(item.date, true)}
                      </p>
                      {item.hasOverride ? <Pill mini tone="warning">Excepción</Pill> : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-700">
                      <Pill mini tone={item.isOpen ? "success" : "danger"}>
                        {item.isOpen ? "Abierto" : "Cerrado"}
                      </Pill>
                    </div>

                    <div className="mt-2 space-y-1.5">
                      <p className="text-sm font-medium text-zinc-800">
                        {item.bookedUnits} de {item.maxUnits} reservados · {item.availableUnits}{" "}
                        disponibles
                      </p>
                      <div className="h-1.5 w-full rounded-full bg-zinc-200/80">
                        <div
                          className={`h-1.5 rounded-full ${
                            item.hasOverride ? "bg-[color:var(--accent)]" : "bg-zinc-500/70"
                          }`}
                          style={{
                            width: `${getOccupancyPercent(item.bookedUnits, item.maxUnits)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--line)] text-left text-xs uppercase tracking-[0.12em] text-zinc-500">
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3">Día</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3">Capacidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        className="cursor-pointer border-b border-[#e2ddd9] transition hover:bg-[color:var(--surface-soft)]/75"
                        key={item.date}
                        onClick={() => openExceptionEditor(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openExceptionEditor(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`${
                                item.hasOverride ? "font-semibold" : "font-medium"
                              } text-[color:var(--accent-strong)]`}
                            >
                              {formatCapacityDate(item.date)}
                            </span>
                            {item.hasOverride ? (
                              <Pill mini tone="warning">
                                Excepción
                              </Pill>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">{weekdayLabel.get(item.weekday) ?? "-"}</td>
                        <td className="px-3 py-2">
                          <Pill mini tone={item.isOpen ? "success" : "danger"}>
                            {item.isOpen ? "Abierto" : "Cerrado"}
                          </Pill>
                        </td>
                        <td className="px-3 py-2">
                          <div className="space-y-1.5">
                            <p className="text-sm font-medium text-zinc-800">
                              {item.bookedUnits} de {item.maxUnits} reservados
                            </p>
                            <div className="h-1.5 w-full rounded-full bg-zinc-200/80">
                              <div
                                className={`h-1.5 rounded-full ${
                                  item.hasOverride
                                    ? "bg-[color:var(--accent)]"
                                    : "bg-zinc-500/70"
                                }`}
                                style={{
                                  width: `${getOccupancyPercent(item.bookedUnits, item.maxUnits)}%`,
                                }}
                              />
                            </div>
                            <p className="text-xs text-zinc-600">
                              {item.availableUnits} disponibles
                            </p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {exceptionEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cerrar cartel de excepción"
            className="absolute inset-0 bg-[#262321]/20 backdrop-blur-[1px]"
            onClick={() => setExceptionEditor(null)}
            type="button"
          />

          <section
            aria-labelledby="exception-title"
            aria-modal="true"
            className="relative z-10 w-full max-w-3xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--milk)] p-5 shadow-[0_20px_40px_rgba(38,35,33,0.14)] sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Excepción por fecha
                </p>
                <h3
                  className="mt-1 text-xl font-semibold text-[color:var(--chocolate-deep)]"
                  id="exception-title"
                >
                  {formatCapacityDate(exceptionEditor.date, true)}
                </h3>
                <p className="mt-1 text-xs text-zinc-600">
                  {exceptionEditor.hasOverride
                    ? "Esta fecha ya tiene una excepción cargada."
                    : "Esta fecha usa regla semanal. Al guardar, se creará una excepción."}
                </p>
              </div>

              <button
                aria-label="Cerrar"
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-zinc-600 transition hover:border-[color:var(--accent)]"
                onClick={() => setExceptionEditor(null)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 space-y-5" onSubmit={saveException}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:items-end">
                <label className={`${fieldLabelClassName} block`}>
                  Cupo máximo
                  <input
                    className={inputClassName}
                    disabled={exceptionEditor.isClosed}
                    min={0}
                    onChange={(event) =>
                      setExceptionEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              maxUnits: Number(event.target.value),
                            }
                          : prev,
                      )
                    }
                    type="number"
                    value={exceptionEditor.maxUnits}
                  />
                </label>

                <div className="rounded-2xl border border-dashed border-[color:var(--line)] bg-white/80 px-4 py-3 text-sm text-zinc-700">
                  <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                    Estado actual
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <p className="flex items-center justify-between">
                      <span className="text-zinc-600">Reservado</span>
                      <strong>{exceptionEditor.bookedUnits}</strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span className="text-zinc-600">Disponible</span>
                      <strong>{exceptionEditor.availableUnits}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] pt-4">
                <div className={controlRowClassName}>
                  <Toggle
                    checked={exceptionEditor.isClosed}
                    label="Marcar fecha como cerrada"
                    onChange={(checked) =>
                      setExceptionEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              isClosed: checked,
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className={buttonSoftClassName}
                    disabled={savingException}
                    type="submit"
                  >
                    {savingException ? "Guardando..." : "Guardar excepción"}
                  </button>
                  <button
                    className={buttonGhostClassName}
                    onClick={() => setExceptionEditor(null)}
                    type="button"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
