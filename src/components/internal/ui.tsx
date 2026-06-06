import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export const inputClassName =
  "h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3.5 text-sm text-[color:var(--chocolate)] outline-none transition placeholder:text-zinc-400 focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]";

export const textareaClassName =
  "min-h-24 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3.5 py-2.5 text-sm text-[color:var(--chocolate)] outline-none transition placeholder:text-zinc-400 focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]";

export const fieldLabelClassName =
  "space-y-2 text-xs uppercase tracking-[0.12em] text-zinc-500";

export const controlRowClassName = "flex h-11 items-center";

export const panelClassName =
  "rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 p-3.5 sm:p-4";

export const panelDashedClassName =
  "rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--milk)]/90 p-3.5 sm:p-4";

export const tableShellClassName =
  "hidden overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 md:block";

export const buttonSoftClassName =
  "h-11 rounded-2xl border border-[color:var(--line)] bg-white px-4 text-sm text-zinc-700 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55";

export const buttonGhostClassName =
  "h-11 rounded-2xl border border-transparent px-4 text-sm text-zinc-600 transition hover:border-[color:var(--line)] hover:text-[color:var(--chocolate-deep)]";

type SectionTitleProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: ReactNode;
};

export function SectionTitle({
  title,
  description,
  icon: Icon,
  action,
}: SectionTitleProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">
          <Icon className="h-3.5 w-3.5" />
          Gestión
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[color:var(--chocolate-deep)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClassName: Record<Tone, string> = {
  neutral: "border-[color:var(--line)] bg-[color:var(--surface-soft)] text-[#5e5652]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-[#ddd2c5] bg-[#f5efea] text-[#746760]",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-[#ddd2c5] bg-[#f4efea] text-[#665c57]",
};

type PillProps = {
  children: ReactNode;
  tone?: Tone;
  mini?: boolean;
};

export function Pill({ children, tone = "neutral", mini = false }: PillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${
        mini ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${toneClassName[tone]}`}
    >
      {children}
    </span>
  );
}

type SelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

export function SelectField({
  value,
  onChange,
  children,
  className,
}: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        className={`${inputClassName} appearance-none pr-10 ${className ?? ""}`}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  mini?: boolean;
};

export function Toggle({ checked, onChange, label, mini = false }: ToggleProps) {
  return (
    <button
      aria-pressed={checked}
      className={`inline-flex items-center gap-2 transition ${
        mini ? "text-xs text-zinc-600" : "text-sm text-zinc-700"
      }`}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={`relative inline-flex rounded-full border transition ${
          mini ? "h-5 w-9" : "h-6 w-11"
        } ${
          checked
            ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
            : "border-zinc-300 bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-0.5 rounded-full bg-white shadow-sm transition ${
            mini ? "h-3.5 w-3.5" : "h-4.5 w-4.5"
          } left-0.5`}
          style={{
            transform: checked
              ? `translateX(${mini ? "14px" : "20px"})`
              : "translateX(0px)",
          }}
        />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}

type DisclosureProps = {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "boxed" | "airy" | "dashed";
};

export function Disclosure({
  title,
  description,
  children,
  defaultOpen = false,
  variant = "boxed",
}: DisclosureProps) {
  const boxed = variant === "boxed";
  const dashed = variant === "dashed";
  const airy = variant === "airy";

  return (
    <details
      className={`group h-fit ${
        boxed
          ? "rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 p-3.5 open:border-[color:var(--accent)]"
          : dashed
            ? "rounded-2xl border border-dashed border-[color:var(--line)] bg-[color:var(--milk)]/90 p-3.5 open:border-[color:var(--accent)]"
            : "border-b border-[color:var(--line)] pb-3"
      }`}
      open={defaultOpen}
    >
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-3 marker:content-none ${
          airy ? "py-1" : "rounded-xl px-1 py-1"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
            {title}
          </p>
          {description ? (
            <p className="mt-0.5 text-xs text-zinc-600">{description}</p>
          ) : null}
        </div>
        <ChevronDown className="h-4 w-4 text-zinc-500 transition group-open:rotate-180" />
      </summary>
      <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 ease-out group-open:mt-3 group-open:grid-rows-[1fr] group-open:opacity-100">
        <div className="overflow-hidden">{children}</div>
      </div>
    </details>
  );
}
