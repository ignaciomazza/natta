"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Clock, Minus, Plus, SquarePen, X } from "lucide-react";
import {
  Pill,
  SectionTitle,
  Toggle,
  buttonGhostClassName,
  buttonSoftClassName,
  fieldLabelClassName,
  inputClassName,
} from "@/components/internal/ui";
import {
  getDefaultPickupWindowForWeekday,
  minutesToTimeInput,
  timeInputToMinutes,
} from "@/lib/pickup-hours";

type FlavorOption = {
  id: string;
  slug: string;
  name: string;
  sizes: SizeOption[];
};

type SizeOption = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

type WeekdayRuleItem = {
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  isAutoCapacity: boolean;
  minLeadTimeDays: number;
  cutoffHour: number;
  pickupStartMinutes: number | null;
  pickupEndMinutes: number | null;
};

type WeekdayFlavorRuleItem = {
  weekday: number;
  flavorId: string;
  maxUnits: number;
};

type WeekdayFlavorSizeRuleItem = {
  weekday: number;
  flavorId: string;
  sizeId: string;
  maxUnits: number;
};

type FlavorSizeCapacityItem = {
  sizeId: string;
  sizeSlug: string;
  sizeName: string;
  isClosed: boolean;
  maxUnits: number | null;
  weekdayMaxUnits: number | null;
  bookedUnits: number;
  availableUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
};

type FlavorCapacityItem = {
  flavorId: string;
  flavorSlug: string;
  flavorName: string;
  isClosed: boolean;
  maxUnits: number | null;
  weekdayMaxUnits: number | null;
  bookedUnits: number;
  availableUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
  sizes: FlavorSizeCapacityItem[];
};

type CapacityItem = {
  date: string;
  weekday: number;
  isOpen: boolean;
  maxUnits: number;
  manualMaxUnits: number;
  isAutoCapacity: boolean;
  minLeadTimeDays: number;
  ignoreLeadTime: boolean;
  pickupStartMinutes: number;
  pickupEndMinutes: number;
  weekdayPickupStartMinutes: number;
  weekdayPickupEndMinutes: number;
  bookedUnits: number;
  availableUnits: number;
  source: "weekday" | "override";
  hasOverride: boolean;
  overrideNote: string | null;
  flavors: FlavorCapacityItem[];
};

type CalendarPayload = {
  items: CapacityItem[];
  flavors: FlavorOption[];
  weekdayRules: WeekdayRuleItem[];
  weekdayFlavorRules: WeekdayFlavorRuleItem[];
  weekdayFlavorSizeRules: WeekdayFlavorSizeRuleItem[];
};

type ExceptionSizeEditor = {
  sizeId: string;
  sizeName: string;
  bookedUnits: number;
  currentMaxUnits: number | null;
  inheritedMaxUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  isClosed: boolean;
  maxInput: string;
};

type ExceptionFlavorEditor = {
  flavorId: string;
  flavorName: string;
  bookedUnits: number;
  currentMaxUnits: number | null;
  inheritedMaxUnits: number | null;
  source: "none" | "weekday" | "override";
  hasOverride: boolean;
  isClosed: boolean;
  maxInput: string;
  sizes: ExceptionSizeEditor[];
};

type ExceptionEditor = {
  date: string;
  isClosed: boolean;
  maxUnits: number;
  isAutoCapacity: boolean;
  ignoreLeadTime: boolean;
  pickupStartInput: string;
  pickupEndInput: string;
  weekdayPickupStartInput: string;
  weekdayPickupEndInput: string;
  bookedUnits: number;
  availableUnits: number;
  hasOverride: boolean;
  flavors: ExceptionFlavorEditor[];
};

type PickupHoursDraft = Record<number, { start: string; end: string }>;

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

function parseOptionalUnits(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function sanitizeUnitInput(value: string) {
  return value.replace(/\D/g, "");
}

function hasSpecificDraft(value: string | undefined) {
  return Boolean(value?.trim());
}

function formatDraftUnits(value: string | undefined) {
  const parsed = parseOptionalUnits(value ?? "");
  return parsed === null ? "Libre" : String(parsed);
}

function calculateAutoCapacity(
  flavors: Array<{
    isClosed: boolean;
    maxUnits: number | null;
    sizes: Array<{ isClosed: boolean; maxUnits: number | null }>;
  }>,
) {
  return flavors.reduce((total, flavor) => {
    if (flavor.isClosed) return total;

    const openSizes = flavor.sizes.filter((size) => !size.isClosed);
    const cappedSizes = openSizes.filter((size) => size.maxUnits !== null);
    const sizeMaxUnits = cappedSizes.reduce(
      (sum, size) => sum + (size.maxUnits ?? 0),
      0,
    );

    if (flavor.maxUnits !== null) {
      return total + (
        openSizes.length > 0 && cappedSizes.length === openSizes.length
          ? Math.min(flavor.maxUnits, sizeMaxUnits)
          : flavor.maxUnits
      );
    }

    return total + sizeMaxUnits;
  }, 0);
}

function calculateWeekdayAutoCapacity(
  flavors: FlavorOption[],
  flavorCaps: Record<string, string>,
  sizeCaps: Record<string, string>,
) {
  return calculateAutoCapacity(
    flavors.map((flavor) => ({
      isClosed: false,
      maxUnits: parseOptionalUnits(flavorCaps[flavor.id] ?? ""),
      sizes: flavor.sizes.map((size) => ({
        isClosed: false,
        maxUnits: parseOptionalUnits(sizeCaps[capacitySizeKey(flavor.id, size.id)] ?? ""),
      })),
    })),
  );
}

function calculateExceptionAutoCapacity(flavors: ExceptionFlavorEditor[]) {
  return calculateAutoCapacity(
    flavors.map((flavor) => ({
      isClosed: flavor.isClosed,
      maxUnits: flavor.isClosed
        ? 0
        : (parseOptionalUnits(flavor.maxInput) ?? flavor.inheritedMaxUnits),
      sizes: flavor.sizes.map((size) => ({
        isClosed: flavor.isClosed || size.isClosed,
        maxUnits:
          flavor.isClosed || size.isClosed
            ? 0
            : (parseOptionalUnits(size.maxInput) ?? size.inheritedMaxUnits),
      })),
    })),
  );
}

function capacitySizeKey(flavorId: string, sizeId: string) {
  return `${flavorId}::${sizeId}`;
}

function countSpecificSizeDrafts(
  flavor: FlavorOption,
  sizeCaps: Record<string, string>,
) {
  return flavor.sizes.filter((size) =>
    hasSpecificDraft(sizeCaps[capacitySizeKey(flavor.id, size.id)]),
  ).length;
}

function getWeekdayDraft(
  selectedWeekday: number,
  rules: WeekdayRuleItem[],
  flavorRules: WeekdayFlavorRuleItem[],
  flavorSizeRules: WeekdayFlavorSizeRuleItem[],
  flavors: FlavorOption[],
) {
  const rule = rules.find((item) => item.weekday === selectedWeekday);
  const flavorCaps = Object.fromEntries(
    flavors.map((flavor) => {
      const flavorRule = flavorRules.find(
        (item) => item.weekday === selectedWeekday && item.flavorId === flavor.id,
      );
      return [flavor.id, flavorRule ? String(flavorRule.maxUnits) : ""];
    }),
  );
  const flavorSizeCaps = Object.fromEntries(
    flavors.flatMap((flavor) =>
      flavor.sizes.map((size) => {
        const sizeRule = flavorSizeRules.find(
          (item) =>
            item.weekday === selectedWeekday &&
            item.flavorId === flavor.id &&
            item.sizeId === size.id,
        );
        return [
          capacitySizeKey(flavor.id, size.id),
          sizeRule ? String(sizeRule.maxUnits) : "",
        ];
      }),
    ),
  );

  return {
    isOpen: rule?.isOpen ?? selectedWeekday !== 0,
    maxUnits: rule?.maxUnits ?? (selectedWeekday === 0 ? 0 : 20),
    isAutoCapacity: rule?.isAutoCapacity ?? false,
    flavorCaps,
    flavorSizeCaps,
  };
}

function buildPickupHoursDraft(rules: WeekdayRuleItem[]): PickupHoursDraft {
  return Object.fromEntries(
    weekdayOptions.map((option) => {
      const rule = rules.find((item) => item.weekday === option.value);
      const fallback = getDefaultPickupWindowForWeekday(option.value);
      const start = rule?.pickupStartMinutes ?? fallback.pickupStartMinutes;
      const end = rule?.pickupEndMinutes ?? fallback.pickupEndMinutes;

      return [
        option.value,
        {
          start: minutesToTimeInput(start),
          end: minutesToTimeInput(end),
        },
      ];
    }),
  ) as PickupHoursDraft;
}

function formatPickupHoursDraft(draft: PickupHoursDraft, weekday: number) {
  const entry = draft[weekday];
  if (!entry) return "-";
  return `${entry.start} a ${entry.end}`;
}

function formatFlavorCapacity(flavor: FlavorCapacityItem) {
  if (flavor.maxUnits === null) {
    return `${flavor.bookedUnits} reservadas`;
  }
  return `${flavor.bookedUnits}/${flavor.maxUnits}`;
}

function getFlavorPillTone(flavor: {
  isClosed: boolean;
  availableUnits: number | null;
  hasOverride: boolean;
  maxUnits: number | null;
}) {
  if (flavor.isClosed || flavor.availableUnits === 0) return "danger" as const;
  if (flavor.hasOverride) return "warning" as const;
  if (flavor.maxUnits !== null) return "info" as const;
  return "neutral" as const;
}

function visibleFlavorCaps(item: CapacityItem) {
  const constrained = item.flavors.filter(
    (flavor) => flavor.maxUnits !== null || flavor.bookedUnits > 0,
  );
  return constrained.slice(0, 5);
}

function visibleFlavorSizeCaps(item: CapacityItem) {
  const constrained = item.flavors.flatMap((flavor) =>
    flavor.sizes
      .filter((size) => size.maxUnits !== null || size.bookedUnits > 0)
      .map((size) => ({
        ...size,
        flavorId: flavor.flavorId,
        flavorName: flavor.flavorName,
      })),
  );
  return constrained.slice(0, 6);
}

function formatExceptionFlavorMeta(flavor: ExceptionFlavorEditor) {
  const sizeDrafts = flavor.sizes.filter(
    (size) => size.isClosed || hasSpecificDraft(size.maxInput),
  ).length;
  if (flavor.isClosed) return `${flavor.bookedUnits} reservadas · desactivado`;
  if (hasSpecificDraft(flavor.maxInput)) {
    return `${flavor.bookedUnits} reservadas · cupo ${formatDraftUnits(flavor.maxInput)}`;
  }
  if (sizeDrafts > 0) {
    return `${flavor.bookedUnits} reservadas · ${sizeDrafts} tamaños`;
  }
  if (flavor.inheritedMaxUnits !== null) {
    return `${flavor.bookedUnits} reservadas · hereda ${flavor.inheritedMaxUnits}`;
  }
  return `${flavor.bookedUnits} reservadas · libre`;
}

function formatExceptionFlavorChip(flavor: ExceptionFlavorEditor) {
  if (flavor.isClosed) return "desactivado";
  if (hasSpecificDraft(flavor.maxInput)) return formatDraftUnits(flavor.maxInput);
  const sizeDrafts = flavor.sizes.filter(
    (size) => size.isClosed || hasSpecificDraft(size.maxInput),
  ).length;
  if (sizeDrafts > 0) return `${sizeDrafts} tamaños`;
  return "Libre";
}

type FlavorPickerOption = {
  id: string;
  name: string;
  meta: string;
  marked?: boolean;
};

type FlavorPickerProps = {
  label: string;
  open: boolean;
  options: FlavorPickerOption[];
  selectedId: string | null;
  selectedName?: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
};

function FlavorPicker({
  label,
  open,
  options,
  selectedId,
  selectedName,
  onOpenChange,
  onSelect,
}: FlavorPickerProps) {
  return (
    <div className="relative min-w-0">
      <p className={fieldLabelClassName}>{label}</p>
      <button
        className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-[1.35rem] border border-[color:var(--line)] bg-white/85 px-3.5 text-left shadow-[0_10px_24px_rgba(43,26,24,0.06)] transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!options.length}
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[color:var(--chocolate-deep)]">
            {selectedName ?? "Sin sabores"}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--milk)] p-1.5 shadow-[0_18px_42px_rgba(43,26,24,0.13)]">
          {options.map((option) => (
            <button
              className={`flex w-full items-center justify-between gap-3 rounded-[1rem] px-3 py-2 text-left transition ${
                selectedId === option.id
                  ? "bg-[color:var(--surface-soft)] text-[color:var(--chocolate-deep)]"
                  : "text-zinc-700 hover:bg-white"
              }`}
              key={option.id}
              onClick={() => {
                onSelect(option.id);
                onOpenChange(false);
              }}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{option.name}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">
                  {option.meta}
                </span>
              </span>
              {option.marked ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type UnitCounterProps = {
  label: string;
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
};

function UnitCounter({
  label,
  value,
  disabled = false,
  placeholder = "Libre",
  onChange,
}: UnitCounterProps) {
  const parsed = parseOptionalUnits(value);
  const isEmpty = !value.trim();
  const canDecrease = !disabled && parsed !== null && parsed > 0;

  const step = (delta: number) => {
    const current = parsed ?? 0;
    onChange(String(Math.max(0, current + delta)));
  };

  return (
    <div className="min-w-0">
      <p className={fieldLabelClassName}>{label}</p>
      <div
        className={`mt-2 grid h-12 w-full min-w-[12rem] max-w-[18rem] grid-cols-[2.65rem_minmax(4.5rem,1fr)_2.65rem_2.65rem] overflow-hidden rounded-[1.35rem] bg-white/85 shadow-[0_10px_24px_rgba(43,26,24,0.07)] ring-1 ring-[rgba(94,83,76,0.13)] ${
          disabled ? "opacity-55" : ""
        }`}
      >
        <button
          aria-label="Restar cupo"
          className="inline-flex items-center justify-center text-zinc-600 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:text-zinc-300"
          disabled={!canDecrease}
          onClick={() => step(-1)}
          type="button"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          className="min-w-0 bg-transparent px-1 text-center text-sm font-semibold text-[color:var(--chocolate-deep)] outline-none placeholder:font-normal placeholder:text-zinc-400 disabled:cursor-not-allowed"
          disabled={disabled}
          inputMode="numeric"
          onChange={(event) => onChange(sanitizeUnitInput(event.target.value))}
          pattern="[0-9]*"
          placeholder={placeholder}
          value={isEmpty ? "" : value}
        />
        <button
          aria-label="Sumar cupo"
          className="inline-flex items-center justify-center text-zinc-600 transition hover:bg-[color:var(--surface-soft)] disabled:cursor-not-allowed disabled:text-zinc-300"
          disabled={disabled}
          onClick={() => step(1)}
          type="button"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          aria-label="Liberar cupo"
          className="inline-flex items-center justify-center border-l border-[color:var(--line)]/75 text-zinc-500 transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--chocolate-deep)] disabled:cursor-not-allowed disabled:text-zinc-300"
          disabled={disabled || isEmpty}
          onClick={() => onChange("")}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CapacityAdmin() {
  const [items, setItems] = useState<CapacityItem[]>([]);
  const [flavors, setFlavors] = useState<FlavorOption[]>([]);
  const [weekdayRules, setWeekdayRules] = useState<WeekdayRuleItem[]>([]);
  const [weekdayFlavorRules, setWeekdayFlavorRules] = useState<
    WeekdayFlavorRuleItem[]
  >([]);
  const [weekdayFlavorSizeRules, setWeekdayFlavorSizeRules] = useState<
    WeekdayFlavorSizeRuleItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingWeekday, setSavingWeekday] = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [savingPickupHours, setSavingPickupHours] = useState(false);
  const [pickupHoursModalOpen, setPickupHoursModalOpen] = useState(false);
  const [pickupHoursDraft, setPickupHoursDraft] = useState<PickupHoursDraft>(() =>
    buildPickupHoursDraft([]),
  );

  const [weekday, setWeekday] = useState(1);
  const [weekdayOpen, setWeekdayOpen] = useState(true);
  const [weekdayMax, setWeekdayMax] = useState(20);
  const [weekdayAutoCapacity, setWeekdayAutoCapacity] = useState(false);
  const [weekdayFlavorCaps, setWeekdayFlavorCaps] = useState<Record<string, string>>({});
  const [weekdayFlavorSizeCaps, setWeekdayFlavorSizeCaps] = useState<
    Record<string, string>
  >({});
  const [weeklyPanelOpen, setWeeklyPanelOpen] = useState(false);
  const [weeklyFlavorPickerOpen, setWeeklyFlavorPickerOpen] = useState(false);
  const [selectedWeeklyFlavorId, setSelectedWeeklyFlavorId] = useState<string | null>(
    null,
  );

  const [exceptionEditor, setExceptionEditor] = useState<ExceptionEditor | null>(
    null,
  );
  const [exceptionFlavorPickerOpen, setExceptionFlavorPickerOpen] = useState(false);
  const [selectedExceptionFlavorId, setSelectedExceptionFlavorId] = useState<
    string | null
  >(null);

  const applyWeekdayDraft = (
    nextWeekday: number,
    nextRules = weekdayRules,
    nextFlavorRules = weekdayFlavorRules,
    nextFlavorSizeRules = weekdayFlavorSizeRules,
    nextFlavors = flavors,
  ) => {
    const draft = getWeekdayDraft(
      nextWeekday,
      nextRules,
      nextFlavorRules,
      nextFlavorSizeRules,
      nextFlavors,
    );
    setWeekdayOpen(draft.isOpen);
    setWeekdayMax(draft.maxUnits);
    setWeekdayAutoCapacity(draft.isAutoCapacity);
    setWeekdayFlavorCaps(draft.flavorCaps);
    setWeekdayFlavorSizeCaps(draft.flavorSizeCaps);
  };

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
      const payload = (await response.json()) as CalendarPayload;
      setItems(payload.items);
      setFlavors(payload.flavors);
      setWeekdayRules(payload.weekdayRules);
      setWeekdayFlavorRules(payload.weekdayFlavorRules);
      setWeekdayFlavorSizeRules(payload.weekdayFlavorSizeRules);
      setPickupHoursDraft(buildPickupHoursDraft(payload.weekdayRules));

      const draft = getWeekdayDraft(
        weekday,
        payload.weekdayRules,
        payload.weekdayFlavorRules,
        payload.weekdayFlavorSizeRules,
        payload.flavors,
      );
      setWeekdayOpen(draft.isOpen);
      setWeekdayMax(draft.maxUnits);
      setWeekdayAutoCapacity(draft.isAutoCapacity);
      setWeekdayFlavorCaps(draft.flavorCaps);
      setWeekdayFlavorSizeCaps(draft.flavorSizeCaps);
      setSelectedWeeklyFlavorId((previous) =>
        payload.flavors.some((flavor) => flavor.id === previous)
          ? previous
          : (payload.flavors[0]?.id ?? null),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exceptionEditor && !pickupHoursModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExceptionEditor(null);
        setExceptionFlavorPickerOpen(false);
        setPickupHoursModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exceptionEditor, pickupHoursModalOpen]);

  const saveWeekday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavingWeekday(true);

    try {
      const autoMaxUnits = calculateWeekdayAutoCapacity(
        flavors,
        weekdayFlavorCaps,
        weekdayFlavorSizeCaps,
      );
      const shouldSaveAutoCapacity =
        weekdayOpen &&
        (weekdayAutoCapacity || (!weekdayMax && autoMaxUnits > 0));
      const response = await fetch("/api/capacity/weekday", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday,
          isOpen: weekdayOpen,
          maxUnits: weekdayOpen
            ? shouldSaveAutoCapacity
              ? autoMaxUnits
              : weekdayMax
            : 0,
          isAutoCapacity: weekdayOpen ? shouldSaveAutoCapacity : false,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo guardar");
      }

      const flavorResponses = await Promise.all(
        flavors.map((flavor) =>
          fetch("/api/capacity/flavor-rule", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weekday,
              flavorId: flavor.id,
              maxUnits: parseOptionalUnits(weekdayFlavorCaps[flavor.id] ?? ""),
            }),
          }),
        ),
      );

      if (flavorResponses.some((item) => !item.ok)) {
        throw new Error("No se pudieron guardar algunos cupos por sabor");
      }

      const sizeResponses = await Promise.all(
        flavors.flatMap((flavor) =>
          flavor.sizes.map((size) =>
            fetch("/api/capacity/flavor-size-rule", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                weekday,
                flavorId: flavor.id,
                sizeId: size.id,
                maxUnits: parseOptionalUnits(
                  weekdayFlavorSizeCaps[capacitySizeKey(flavor.id, size.id)] ?? "",
                ),
              }),
            }),
          ),
        ),
      );

      if (sizeResponses.some((item) => !item.ok)) {
        throw new Error("No se pudieron guardar algunos cupos por tamaño");
      }

      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSavingWeekday(false);
    }
  };

  const openPickupHoursModal = () => {
    setPickupHoursDraft(buildPickupHoursDraft(weekdayRules));
    setPickupHoursModalOpen(true);
  };

  const updatePickupHoursDraft = (
    nextWeekday: number,
    field: "start" | "end",
    value: string,
  ) => {
    setPickupHoursDraft((prev) => ({
      ...prev,
      [nextWeekday]: {
        ...prev[nextWeekday],
        [field]: value,
      },
    }));
  };

  const savePickupHours = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSavingPickupHours(true);

    try {
      const payload = weekdayOptions.map((option) => {
        const entry = pickupHoursDraft[option.value];
        const pickupStartMinutes = timeInputToMinutes(entry?.start ?? "");
        const pickupEndMinutes = timeInputToMinutes(entry?.end ?? "");

        if (
          pickupStartMinutes === null ||
          pickupEndMinutes === null ||
          pickupEndMinutes <= pickupStartMinutes
        ) {
          throw new Error(`Revisá el horario de ${option.label.toLowerCase()}`);
        }

        return {
          weekday: option.value,
          pickupStartMinutes,
          pickupEndMinutes,
        };
      });

      const responses = await Promise.all(
        payload.map((item) =>
          fetch("/api/capacity/weekday", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          }),
        ),
      );

      if (responses.some((item) => !item.ok)) {
        throw new Error("No se pudieron guardar los horarios");
      }

      await load();
      setPickupHoursModalOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudieron guardar los horarios",
      );
    } finally {
      setSavingPickupHours(false);
    }
  };

  const selectWeekday = (nextWeekday: number) => {
    setWeekday(nextWeekday);
    setWeeklyFlavorPickerOpen(false);
    applyWeekdayDraft(nextWeekday);
  };

  const updateWeekdayFlavorCap = (flavorId: string, value: string) => {
    setWeekdayFlavorCaps((prev) => ({
      ...prev,
      [flavorId]: value,
    }));
  };

  const updateWeekdayFlavorSizeCap = (
    flavorId: string,
    sizeId: string,
    value: string,
  ) => {
    setWeekdayFlavorSizeCaps((prev) => ({
      ...prev,
      [capacitySizeKey(flavorId, sizeId)]: value,
    }));
  };

  const updateExceptionFlavor = (
    flavorId: string,
    updater: (flavor: ExceptionFlavorEditor) => ExceptionFlavorEditor,
  ) => {
    setExceptionEditor((prev) =>
      prev
        ? {
            ...prev,
            flavors: prev.flavors.map((flavor) =>
              flavor.flavorId === flavorId ? updater(flavor) : flavor,
            ),
          }
        : prev,
    );
  };

  const updateExceptionSize = (
    flavorId: string,
    sizeId: string,
    updater: (size: ExceptionSizeEditor) => ExceptionSizeEditor,
  ) => {
    updateExceptionFlavor(flavorId, (flavor) => ({
      ...flavor,
      sizes: flavor.sizes.map((size) =>
        size.sizeId === sizeId ? updater(size) : size,
      ),
    }));
  };

  const openExceptionEditor = (item: CapacityItem) => {
    const nextFlavors = item.flavors.map((flavor) => ({
      flavorId: flavor.flavorId,
      flavorName: flavor.flavorName,
      bookedUnits: flavor.bookedUnits,
      currentMaxUnits: flavor.maxUnits,
      inheritedMaxUnits: flavor.weekdayMaxUnits,
      source: flavor.source,
      hasOverride: flavor.hasOverride,
      isClosed: flavor.source === "override" && flavor.isClosed,
      maxInput:
        flavor.source === "override" && !flavor.isClosed && flavor.maxUnits !== null
          ? String(flavor.maxUnits)
          : "",
      sizes: flavor.sizes.map((size) => ({
        sizeId: size.sizeId,
        sizeName: size.sizeName,
        bookedUnits: size.bookedUnits,
        currentMaxUnits: size.maxUnits,
        inheritedMaxUnits: size.weekdayMaxUnits,
        source: size.source,
        hasOverride: size.hasOverride,
        isClosed: size.source === "override" && size.isClosed,
        maxInput:
          size.source === "override" && !size.isClosed && size.maxUnits !== null
            ? String(size.maxUnits)
            : "",
      })),
    }));

    setSelectedExceptionFlavorId(
      nextFlavors.find(
        (flavor) =>
          flavor.isClosed ||
          flavor.hasOverride ||
          hasSpecificDraft(flavor.maxInput) ||
          flavor.sizes.some(
            (size) => size.isClosed || size.hasOverride || hasSpecificDraft(size.maxInput),
          ),
      )?.flavorId ??
        nextFlavors[0]?.flavorId ??
        null,
    );
    setExceptionFlavorPickerOpen(false);
    setExceptionEditor({
      date: item.date,
      isClosed: !item.isOpen,
      maxUnits: item.manualMaxUnits,
      isAutoCapacity: item.isAutoCapacity,
      ignoreLeadTime: item.ignoreLeadTime,
      pickupStartInput: minutesToTimeInput(item.pickupStartMinutes),
      pickupEndInput: minutesToTimeInput(item.pickupEndMinutes),
      weekdayPickupStartInput: minutesToTimeInput(item.weekdayPickupStartMinutes),
      weekdayPickupEndInput: minutesToTimeInput(item.weekdayPickupEndMinutes),
      bookedUnits: item.bookedUnits,
      availableUnits: item.availableUnits,
      hasOverride: item.hasOverride,
      flavors: nextFlavors,
    });
  };

  const saveException = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!exceptionEditor) return;

    setError(null);
    setSavingException(true);

    try {
      const pickupStartMinutes = timeInputToMinutes(exceptionEditor.pickupStartInput);
      const pickupEndMinutes = timeInputToMinutes(exceptionEditor.pickupEndInput);
      const weekdayPickupStartMinutes = timeInputToMinutes(
        exceptionEditor.weekdayPickupStartInput,
      );
      const weekdayPickupEndMinutes = timeInputToMinutes(
        exceptionEditor.weekdayPickupEndInput,
      );

      if (
        pickupStartMinutes === null ||
        pickupEndMinutes === null ||
        pickupEndMinutes <= pickupStartMinutes ||
        weekdayPickupStartMinutes === null ||
        weekdayPickupEndMinutes === null
      ) {
        throw new Error("Revisá los horarios de retiro de la fecha");
      }

      const hasPickupHoursOverride =
        pickupStartMinutes !== weekdayPickupStartMinutes ||
        pickupEndMinutes !== weekdayPickupEndMinutes;
      const autoMaxUnits = calculateExceptionAutoCapacity(exceptionEditor.flavors);
      const shouldSaveAutoCapacity =
        !exceptionEditor.isClosed &&
        (exceptionEditor.isAutoCapacity ||
          (!exceptionEditor.maxUnits && autoMaxUnits > 0));
      const response = await fetch("/api/capacity/override", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: exceptionEditor.date,
          isClosed: exceptionEditor.isClosed,
          maxUnits: exceptionEditor.isClosed
            ? 0
            : shouldSaveAutoCapacity
              ? autoMaxUnits
              : exceptionEditor.maxUnits,
          isAutoCapacity: exceptionEditor.isClosed
            ? false
            : shouldSaveAutoCapacity,
          ignoreLeadTime: exceptionEditor.isClosed
            ? false
            : exceptionEditor.ignoreLeadTime,
          pickupStartMinutes:
            !exceptionEditor.isClosed && hasPickupHoursOverride
              ? pickupStartMinutes
              : null,
          pickupEndMinutes:
            !exceptionEditor.isClosed && hasPickupHoursOverride
              ? pickupEndMinutes
              : null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "No se pudo guardar excepción");
      }

      const flavorResponses = await Promise.all(
        exceptionEditor.flavors.map((flavor) => {
          const maxUnits = parseOptionalUnits(flavor.maxInput);
          const clear = !flavor.isClosed && maxUnits === null;

          return fetch("/api/capacity/flavor-override", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: exceptionEditor.date,
              flavorId: flavor.flavorId,
              clear,
              isClosed: flavor.isClosed,
              maxUnits: flavor.isClosed ? 0 : maxUnits,
            }),
          });
        }),
      );

      if (flavorResponses.some((item) => !item.ok)) {
        throw new Error("No se pudieron guardar algunos cupos por sabor");
      }

      const sizeResponses = await Promise.all(
        exceptionEditor.flavors.flatMap((flavor) =>
          flavor.sizes.map((size) => {
            const maxUnits = parseOptionalUnits(size.maxInput);
            const clear = !size.isClosed && maxUnits === null;

            return fetch("/api/capacity/flavor-size-override", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: exceptionEditor.date,
                flavorId: flavor.flavorId,
                sizeId: size.sizeId,
                clear,
                isClosed: size.isClosed,
                maxUnits: size.isClosed ? 0 : maxUnits,
              }),
            });
          }),
        ),
      );

      if (sizeResponses.some((item) => !item.ok)) {
        throw new Error("No se pudieron guardar algunas excepciones por tamaño");
      }

      await load();
      setExceptionEditor(null);
      setExceptionFlavorPickerOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar excepción",
      );
    } finally {
      setSavingException(false);
    }
  };

  const summary = useMemo(() => {
    const withOverride = items.filter((item) => item.hasOverride).length;
    const closed = items.filter((item) => !item.isOpen).length;
    const flavorLimitedDays = items.filter((item) =>
      item.flavors.some((flavor) => flavor.maxUnits !== null),
    ).length;
    const sizeLimitedDays = items.filter((item) =>
      item.flavors.some((flavor) =>
        flavor.sizes.some((size) => size.maxUnits !== null),
      ),
    ).length;
    return {
      total: items.length,
      withOverride,
      closed,
      flavorLimitedDays,
      sizeLimitedDays,
    };
  }, [items]);

  const selectedWeeklyFlavor =
    flavors.find((flavor) => flavor.id === selectedWeeklyFlavorId) ?? flavors[0] ?? null;
  const selectedWeeklyFlavorValue = selectedWeeklyFlavor
    ? (weekdayFlavorCaps[selectedWeeklyFlavor.id] ?? "")
    : "";
  const weeklyAutoMaxUnits = useMemo(
    () =>
      calculateWeekdayAutoCapacity(
        flavors,
        weekdayFlavorCaps,
        weekdayFlavorSizeCaps,
      ),
    [flavors, weekdayFlavorCaps, weekdayFlavorSizeCaps],
  );
  const weeklySpecificCaps = flavors.filter((flavor) =>
    hasSpecificDraft(weekdayFlavorCaps[flavor.id]),
  );
  const weeklySpecificSizeCaps = flavors.flatMap((flavor) =>
    flavor.sizes
      .filter((size) =>
        hasSpecificDraft(weekdayFlavorSizeCaps[capacitySizeKey(flavor.id, size.id)]),
      )
      .map((size) => ({
        flavorId: flavor.id,
        flavorName: flavor.name,
        sizeId: size.id,
        sizeName: size.name,
        value: weekdayFlavorSizeCaps[capacitySizeKey(flavor.id, size.id)],
      })),
  );
  const selectedExceptionFlavor =
    exceptionEditor?.flavors.find(
      (flavor) => flavor.flavorId === selectedExceptionFlavorId,
    ) ??
    exceptionEditor?.flavors[0] ??
    null;
  const exceptionAutoMaxUnits = exceptionEditor
    ? calculateExceptionAutoCapacity(exceptionEditor.flavors)
    : 0;
  const exceptionSpecificFlavors =
    exceptionEditor?.flavors.filter(
      (flavor) =>
        flavor.isClosed ||
        hasSpecificDraft(flavor.maxInput) ||
        flavor.sizes.some(
          (size) => size.isClosed || hasSpecificDraft(size.maxInput),
        ),
    ) ?? [];

  return (
    <section className="space-y-7">
      <SectionTitle
        action={
          <button
            className={`${buttonSoftClassName} inline-flex items-center gap-2`}
            onClick={openPickupHoursModal}
            type="button"
          >
            <Clock className="h-4 w-4" />
            Horarios
          </button>
        }
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
        <Pill tone="success">Con cupo por sabor: {summary.flavorLimitedDays}</Pill>
        <Pill tone="success">Con cupo por tamaño: {summary.sizeLimitedDays}</Pill>
      </div>

      <div className="space-y-6">
        <section className="rounded-[1.6rem] bg-[color:var(--milk)]/92 p-5 shadow-[0_18px_40px_-32px_rgba(38,35,33,0.72),0_8px_20px_-18px_rgba(82,74,70,0.5)]">
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
              <p className="mt-1 text-xs text-zinc-500">
                Base por día para cupos generales, sabores y tamaños.
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
            <div
              className={
                weeklyPanelOpen
                  ? "overflow-visible"
                  : "pointer-events-none overflow-hidden"
              }
            >
              <form className="space-y-6" onSubmit={saveWeekday}>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <button
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        weekday === option.value
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-strong)] text-white"
                          : "border-[color:var(--line)] bg-[color:var(--milk)] text-zinc-700 hover:border-[color:var(--accent)]"
                      }`}
                      key={option.value}
                      onClick={() => selectWeekday(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(18rem,40rem)_minmax(20rem,1fr)] xl:items-end">
                  <label className={`${fieldLabelClassName} block`}>
                    Cupo máximo general
                    <input
                      className={inputClassName}
                      disabled={!weekdayOpen || weekdayAutoCapacity}
                      min={0}
                      onChange={(event) => setWeekdayMax(Number(event.target.value))}
                      type="number"
                      value={weekdayAutoCapacity ? weeklyAutoMaxUnits : weekdayMax}
                    />
                  </label>

                  <div className="flex min-h-12 flex-wrap items-center gap-4">
                    <Toggle
                      checked={weekdayAutoCapacity}
                      label="Cupo auto"
                      onChange={setWeekdayAutoCapacity}
                    />
                    <Toggle
                      checked={weekdayOpen}
                      label="Día habilitado"
                      onChange={setWeekdayOpen}
                    />
                    {weekdayAutoCapacity ? (
                      <Pill mini tone="info">
                        Auto: {weeklyAutoMaxUnits}
                      </Pill>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-[color:var(--line)] pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                        Cupos por sabor
                      </p>
                    </div>
                    {weeklySpecificCaps.length || weeklySpecificSizeCaps.length ? (
                      <Pill mini tone="success">
                        {weeklySpecificCaps.length + weeklySpecificSizeCaps.length} configurados
                      </Pill>
                    ) : null}
                  </div>

                  {selectedWeeklyFlavor ? (
                    <>
                      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_minmax(12rem,18rem)] xl:items-end">
                        <FlavorPicker
                          label="Sabor"
                          onOpenChange={setWeeklyFlavorPickerOpen}
                          onSelect={setSelectedWeeklyFlavorId}
                          open={weeklyFlavorPickerOpen}
                          options={flavors.map((flavor) => ({
                            id: flavor.id,
                            name: flavor.name,
                            meta: hasSpecificDraft(weekdayFlavorCaps[flavor.id])
                              ? `Cupo ${formatDraftUnits(weekdayFlavorCaps[flavor.id])}`
                              : countSpecificSizeDrafts(flavor, weekdayFlavorSizeCaps) > 0
                                ? `${countSpecificSizeDrafts(flavor, weekdayFlavorSizeCaps)} tamaños configurados`
                                : "Hereda cupo general",
                            marked:
                              hasSpecificDraft(weekdayFlavorCaps[flavor.id]) ||
                              countSpecificSizeDrafts(flavor, weekdayFlavorSizeCaps) > 0,
                          }))}
                          selectedId={selectedWeeklyFlavor.id}
                          selectedName={selectedWeeklyFlavor.name}
                        />

                        <UnitCounter
                          disabled={!weekdayOpen}
                          label="Cantidad"
                          onChange={(value) =>
                            updateWeekdayFlavorCap(selectedWeeklyFlavor.id, value)
                          }
                          value={selectedWeeklyFlavorValue}
                        />
                      </div>

                      {selectedWeeklyFlavor.sizes.length ? (
                        <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                              Cupos por tamaño
                            </p>
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {selectedWeeklyFlavor.sizes.map((size) => (
                              <UnitCounter
                                disabled={!weekdayOpen}
                                key={size.id}
                                label={size.name}
                                onChange={(value) =>
                                  updateWeekdayFlavorSizeCap(
                                    selectedWeeklyFlavor.id,
                                    size.id,
                                    value,
                                  )
                                }
                                value={
                                  weekdayFlavorSizeCaps[
                                    capacitySizeKey(selectedWeeklyFlavor.id, size.id)
                                  ] ?? ""
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {weeklySpecificCaps.length || weeklySpecificSizeCaps.length ? (
                          <>
                            {weeklySpecificCaps.map((flavor) => (
                              <button
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                  selectedWeeklyFlavor.id === flavor.id
                                    ? "border-[color:var(--accent)] bg-[color:var(--surface-soft)] text-[color:var(--chocolate-deep)]"
                                    : "border-[#ddd2c5] bg-[#f4efea] text-[#665c57] hover:border-[color:var(--accent)]"
                                }`}
                                key={flavor.id}
                                onClick={() => setSelectedWeeklyFlavorId(flavor.id)}
                                type="button"
                              >
                                {flavor.name}:{" "}
                                {formatDraftUnits(weekdayFlavorCaps[flavor.id])}
                              </button>
                            ))}
                            {weeklySpecificSizeCaps.map((item) => (
                              <button
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                  selectedWeeklyFlavor.id === item.flavorId
                                    ? "border-[color:var(--accent)] bg-[color:var(--surface-soft)] text-[color:var(--chocolate-deep)]"
                                    : "border-[#ddd2c5] bg-[#f4efea] text-[#665c57] hover:border-[color:var(--accent)]"
                                }`}
                                key={`${item.flavorId}-${item.sizeId}`}
                                onClick={() => setSelectedWeeklyFlavorId(item.flavorId)}
                                type="button"
                              >
                                {item.flavorName} {item.sizeName}:{" "}
                                {formatDraftUnits(item.value)}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">No hay sabores cargados.</p>
                  )}
                </div>

                <button
                  className={`${buttonSoftClassName} block`}
                  disabled={savingWeekday}
                  type="submit"
                >
                  {savingWeekday ? "Guardando..." : "Guardar regla semanal"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <p className="text-sm text-zinc-600">Cargando calendario...</p>
          ) : (
            items.map((item) => {
              const flavorCaps = visibleFlavorCaps(item);
              const sizeCaps = visibleFlavorSizeCaps(item);

              return (
                <article
                  className="grid gap-4 rounded-[1.6rem] bg-[color:var(--milk)]/92 p-4 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.72),0_8px_18px_-18px_rgba(82,74,70,0.48)] transition-shadow hover:shadow-[0_20px_44px_-30px_rgba(38,35,33,0.78),0_12px_24px_-18px_rgba(82,74,70,0.52)] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center"
                  key={item.date}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm ${
                          item.hasOverride
                            ? "font-semibold text-[color:var(--accent-strong)]"
                            : "font-semibold text-[color:var(--chocolate-deep)]"
                        }`}
                      >
                        {formatCapacityDate(item.date, true)}
                      </p>
                      {item.hasOverride ? <Pill mini tone="warning">Excepción</Pill> : null}
                      {item.ignoreLeadTime ? (
                        <Pill mini tone="info">48 h habilitadas</Pill>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {weekdayLabel.get(item.weekday) ?? "-"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill mini tone={item.isOpen ? "success" : "danger"}>
                        {item.isOpen ? "Abierto" : "Cerrado"}
                      </Pill>
                      {item.isAutoCapacity ? (
                        <Pill mini tone="info">
                          Auto
                        </Pill>
                      ) : null}
                      <span className="text-xs text-zinc-500">
                        {item.availableUnits} disponibles
                      </span>
                    </div>
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
                    <p className="text-sm font-medium text-zinc-800">
                      {item.bookedUnits} de {item.maxUnits} reservados
                    </p>
                  </div>

                  <div className="min-w-0">
                    {flavorCaps.length || sizeCaps.length ? (
                      <div className="flex flex-wrap gap-2">
                        {flavorCaps.map((flavor) => (
                          <Pill
                            key={flavor.flavorId}
                            mini
                            tone={getFlavorPillTone(flavor)}
                          >
                            {flavor.flavorName}: {formatFlavorCapacity(flavor)}
                          </Pill>
                        ))}
                        {sizeCaps.map((size) => (
                          <Pill
                            key={`${size.flavorId}-${size.sizeId}`}
                            mini
                            tone={getFlavorPillTone(size)}
                          >
                            {size.flavorName} {size.sizeName}:{" "}
                            {size.maxUnits === null
                              ? `${size.bookedUnits} reservadas`
                              : `${size.bookedUnits}/${size.maxUnits}`}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className={`${buttonSoftClassName} inline-flex items-center gap-2 whitespace-nowrap`}
                    onClick={() => openExceptionEditor(item)}
                    type="button"
                  >
                    <SquarePen className="h-4 w-4" />
                    Editar
                  </button>
                </article>
              );
            })
          )}
        </section>
      </div>

      {pickupHoursModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cerrar horarios"
            className="absolute inset-0 bg-[#262321]/20 backdrop-blur-[1px]"
            onClick={() => setPickupHoursModalOpen(false)}
            type="button"
          />

          <section
            aria-labelledby="pickup-hours-title"
            aria-modal="true"
            className="relative z-10 max-h-[min(92vh,44rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-[color:var(--milk)] p-5 shadow-[0_28px_70px_-36px_rgba(38,35,33,0.72),0_16px_34px_-22px_rgba(82,74,70,0.48)] sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Web
                </p>
                <h3
                  className="mt-1 text-xl font-semibold text-[color:var(--chocolate-deep)]"
                  id="pickup-hours-title"
                >
                  Horarios de retiro
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Se muestran en disponibilidad, resumen, estado y comprobantes.
                </p>
              </div>

              <button
                aria-label="Cerrar"
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-zinc-600 transition hover:border-[color:var(--accent)]"
                onClick={() => setPickupHoursModalOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 space-y-5" onSubmit={savePickupHours}>
              <div className="grid gap-3">
                {weekdayOptions.map((option) => {
                  const rule = weekdayRules.find(
                    (item) => item.weekday === option.value,
                  );
                  const isOpen = rule ? rule.isOpen : option.value !== 0;

                  return (
                    <div
                      className="grid gap-3 rounded-[1.25rem] border border-[color:var(--line)] bg-white/55 p-3 sm:grid-cols-[minmax(7rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] sm:items-end"
                      key={option.value}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                          {option.label}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Pill mini tone={isOpen ? "success" : "danger"}>
                            {isOpen ? "Habilitado" : "Cerrado"}
                          </Pill>
                          <span className="text-xs text-zinc-500">
                            {formatPickupHoursDraft(pickupHoursDraft, option.value)}
                          </span>
                        </div>
                      </div>

                      <label className={`${fieldLabelClassName} block`}>
                        Desde
                        <input
                          className={inputClassName}
                          onChange={(event) =>
                            updatePickupHoursDraft(
                              option.value,
                              "start",
                              event.target.value,
                            )
                          }
                          step={900}
                          type="time"
                          value={pickupHoursDraft[option.value]?.start ?? ""}
                        />
                      </label>

                      <label className={`${fieldLabelClassName} block`}>
                        Hasta
                        <input
                          className={inputClassName}
                          onChange={(event) =>
                            updatePickupHoursDraft(
                              option.value,
                              "end",
                              event.target.value,
                            )
                          }
                          step={900}
                          type="time"
                          value={pickupHoursDraft[option.value]?.end ?? ""}
                        />
                      </label>

                      <Clock className="hidden h-4 w-4 justify-self-end text-zinc-400 sm:block" />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--line)] pt-5">
                <button
                  className={buttonSoftClassName}
                  disabled={savingPickupHours}
                  type="submit"
                >
                  {savingPickupHours ? "Guardando..." : "Guardar horarios"}
                </button>
                <button
                  className={buttonGhostClassName}
                  onClick={() => setPickupHoursModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {exceptionEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cerrar cartel de excepción"
            className="absolute inset-0 bg-[#262321]/20 backdrop-blur-[1px]"
            onClick={() => {
              setExceptionEditor(null);
              setExceptionFlavorPickerOpen(false);
            }}
            type="button"
          />

          <section
            aria-labelledby="exception-title"
            aria-modal="true"
            className="relative z-10 max-h-[min(92vh,58rem)] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-[color:var(--milk)] p-5 shadow-[0_28px_70px_-36px_rgba(38,35,33,0.72),0_16px_34px_-22px_rgba(82,74,70,0.48)] sm:p-6"
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
              </div>

              <button
                aria-label="Cerrar"
                className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] text-zinc-600 transition hover:border-[color:var(--accent)]"
                onClick={() => {
                  setExceptionEditor(null);
                  setExceptionFlavorPickerOpen(false);
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-5 space-y-6" onSubmit={saveException}>
              <div className="flex justify-end">
                <Toggle
                  checked={exceptionEditor.isClosed}
                  label="Cerrar fecha"
                  onChange={(checked) =>
                    setExceptionEditor((prev) =>
                      prev
                        ? {
                            ...prev,
                            isClosed: checked,
                            ignoreLeadTime: checked ? false : prev.ignoreLeadTime,
                          }
                        : prev,
                    )
                  }
                />
              </div>

              <div className="rounded-[1.3rem] border border-[color:var(--line)] bg-white/55 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                      Cupo general
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(12rem,18rem)_minmax(14rem,22rem)] lg:items-end">
                  <div>
                    <p className={fieldLabelClassName}>Modo</p>
                    <div className="mt-2 grid h-11 grid-cols-2 overflow-hidden rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 p-1">
                      {[
                        { label: "Manual", value: false },
                        { label: "Automático", value: true },
                      ].map((option) => (
                        <button
                          className={`rounded-xl px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            exceptionEditor.isAutoCapacity === option.value
                              ? "bg-[color:var(--chocolate-deep)] text-white shadow-[0_8px_18px_rgba(43,26,24,0.14)]"
                              : "text-zinc-600 hover:bg-white"
                          }`}
                          disabled={exceptionEditor.isClosed}
                          key={option.label}
                          onClick={() =>
                            setExceptionEditor((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    isAutoCapacity: option.value,
                                  }
                                : prev,
                            )
                          }
                          type="button"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className={`${fieldLabelClassName} block`}>
                    Cupo máximo general
                    <input
                      className={inputClassName}
                      disabled={exceptionEditor.isClosed || exceptionEditor.isAutoCapacity}
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
                      value={
                        exceptionEditor.isAutoCapacity
                          ? exceptionAutoMaxUnits
                          : exceptionEditor.maxUnits
                      }
                    />
                  </label>

                </div>
              </div>

              <div className="rounded-[1.3rem] border border-[color:var(--line)] bg-white/55 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                      Preparación de 48 h
                    </p>
                  </div>
                  <Toggle
                    checked={!exceptionEditor.isClosed && exceptionEditor.ignoreLeadTime}
                    label="Habilitar dentro de las 48 h"
                    onChange={(checked) =>
                      setExceptionEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              ignoreLeadTime: prev.isClosed ? false : checked,
                            }
                          : prev,
                      )
                    }
                  />
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-[color:var(--line)] bg-white/55 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
                      Horarios de retiro
                    </p>
                  </div>
                  <button
                    className={`${buttonGhostClassName} h-9 px-3 text-xs`}
                    disabled={exceptionEditor.isClosed}
                    onClick={() =>
                      setExceptionEditor((prev) =>
                        prev
                          ? {
                              ...prev,
                              pickupStartInput: prev.weekdayPickupStartInput,
                              pickupEndInput: prev.weekdayPickupEndInput,
                            }
                          : prev,
                      )
                    }
                    type="button"
                  >
                    Usar regla semanal
                  </button>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={`${fieldLabelClassName} block`}>
                    Desde
                    <input
                      className={inputClassName}
                      disabled={exceptionEditor.isClosed}
                      onChange={(event) =>
                        setExceptionEditor((prev) =>
                          prev
                            ? {
                                ...prev,
                                pickupStartInput: event.target.value,
                              }
                            : prev,
                        )
                      }
                      step={900}
                      type="time"
                      value={exceptionEditor.pickupStartInput}
                    />
                  </label>

                  <label className={`${fieldLabelClassName} block`}>
                    Hasta
                    <input
                      className={inputClassName}
                      disabled={exceptionEditor.isClosed}
                      onChange={(event) =>
                        setExceptionEditor((prev) =>
                          prev
                            ? {
                                ...prev,
                                pickupEndInput: event.target.value,
                              }
                            : prev,
                        )
                      }
                      step={900}
                      type="time"
                      value={exceptionEditor.pickupEndInput}
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-[color:var(--line)] pt-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)] lg:items-center">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                      Cupos por sabor de esta fecha
                    </p>
                  </div>
                </div>

                {selectedExceptionFlavor ? (
                  <>
                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_minmax(12rem,18rem)_minmax(14rem,0.8fr)] xl:items-end">
                      <FlavorPicker
                        label="Sabor"
                        onOpenChange={setExceptionFlavorPickerOpen}
                        onSelect={setSelectedExceptionFlavorId}
                        open={exceptionFlavorPickerOpen}
                        options={exceptionEditor.flavors.map((flavor) => ({
                          id: flavor.flavorId,
                          name: flavor.flavorName,
                          meta: formatExceptionFlavorMeta(flavor),
                          marked:
                            flavor.isClosed ||
                            hasSpecificDraft(flavor.maxInput) ||
                            flavor.sizes.some(
                              (size) =>
                                size.isClosed || hasSpecificDraft(size.maxInput),
                            ),
                        }))}
                        selectedId={selectedExceptionFlavor.flavorId}
                        selectedName={selectedExceptionFlavor.flavorName}
                      />

                      <UnitCounter
                        disabled={exceptionEditor.isClosed || selectedExceptionFlavor.isClosed}
                        label="Cantidad"
                        onChange={(value) =>
                          updateExceptionFlavor(selectedExceptionFlavor.flavorId, (flavor) => ({
                            ...flavor,
                            maxInput: value,
                          }))
                        }
                        placeholder={
                          selectedExceptionFlavor.inheritedMaxUnits === null
                            ? "Libre"
                            : String(selectedExceptionFlavor.inheritedMaxUnits)
                        }
                        value={selectedExceptionFlavor.maxInput}
                      />

                      <div className="pb-1 xl:pl-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Toggle
                            checked={selectedExceptionFlavor.isClosed}
                            label="Desactivar sabor"
                            onChange={(checked) =>
                              updateExceptionFlavor(
                                selectedExceptionFlavor.flavorId,
                                (flavor) => ({
                                  ...flavor,
                                  isClosed: checked,
                                  maxInput: checked ? "" : flavor.maxInput,
                                }),
                              )
                            }
                          />
                          {selectedExceptionFlavor.hasOverride ? (
                            <Pill mini tone="warning">
                              Fecha
                            </Pill>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                          {selectedExceptionFlavor.bookedUnits} reservadas
                          {selectedExceptionFlavor.currentMaxUnits !== null
                            ? ` · cupo actual ${selectedExceptionFlavor.currentMaxUnits}`
                            : " · sin cupo específico"}
                        </p>
                      </div>
                    </div>

                    {selectedExceptionFlavor.sizes.length ? (
                      <div className="mt-5 border-t border-[color:var(--line)] pt-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                            Cupos por tamaño de este sabor
                          </p>
                        </div>
                        <div className="mt-4 grid gap-x-8 gap-y-5 xl:grid-cols-2">
                          {selectedExceptionFlavor.sizes.map((size) => (
                            <div
                              className="grid gap-3 sm:grid-cols-[minmax(12rem,18rem)_minmax(12rem,1fr)] sm:items-end"
                              key={size.sizeId}
                            >
                              <UnitCounter
                                disabled={
                                  exceptionEditor.isClosed ||
                                  selectedExceptionFlavor.isClosed ||
                                  size.isClosed
                                }
                                label={size.sizeName}
                                onChange={(value) =>
                                  updateExceptionSize(
                                    selectedExceptionFlavor.flavorId,
                                    size.sizeId,
                                    (current) => ({
                                      ...current,
                                      maxInput: value,
                                    }),
                                  )
                                }
                                placeholder={
                                  size.inheritedMaxUnits === null
                                    ? "Libre"
                                    : String(size.inheritedMaxUnits)
                                }
                                value={size.maxInput}
                              />

                              <div className="pb-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Toggle
                                    checked={size.isClosed}
                                    label="Desactivar tamaño"
                                    onChange={(checked) =>
                                      updateExceptionSize(
                                        selectedExceptionFlavor.flavorId,
                                        size.sizeId,
                                        (current) => ({
                                          ...current,
                                          isClosed: checked,
                                          maxInput: checked ? "" : current.maxInput,
                                        }),
                                      )
                                    }
                                  />
                                  {size.hasOverride ? (
                                    <Pill mini tone="warning">
                                      Fecha
                                    </Pill>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-xs text-zinc-500">
                                  {size.bookedUnits} reservadas
                                  {size.currentMaxUnits !== null
                                    ? ` · cupo actual ${size.currentMaxUnits}`
                                    : " · sin cupo específico"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {exceptionSpecificFlavors.length ? (
                        exceptionSpecificFlavors.map((flavor) => (
                          <button
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                              selectedExceptionFlavor.flavorId === flavor.flavorId
                                ? "border-[color:var(--accent)] bg-[color:var(--surface-soft)] text-[color:var(--chocolate-deep)]"
                                : "border-[#ddd2c5] bg-[#f4efea] text-[#665c57] hover:border-[color:var(--accent)]"
                            }`}
                            key={flavor.flavorId}
                            onClick={() => setSelectedExceptionFlavorId(flavor.flavorId)}
                            type="button"
                          >
                            {flavor.flavorName}:{" "}
                            {formatExceptionFlavorChip(flavor)}
                          </button>
                        ))
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No hay sabores cargados.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[color:var(--line)] pt-5">
                <button
                  className={buttonSoftClassName}
                  disabled={savingException}
                  type="submit"
                >
                  {savingException ? "Guardando..." : "Guardar excepción"}
                </button>
                <button
                  className={buttonGhostClassName}
                  onClick={() => {
                    setExceptionEditor(null);
                    setExceptionFlavorPickerOpen(false);
                  }}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
