import { useId, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

export const inputClassName =
  "h-11 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3.5 text-sm text-[color:var(--chocolate)] outline-none transition placeholder:text-zinc-400 focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]";

export const textareaClassName =
  "min-h-24 w-full rounded-2xl border border-[color:var(--line)] bg-[color:var(--milk)]/90 px-3.5 py-2.5 text-sm text-[color:var(--chocolate)] outline-none transition placeholder:text-zinc-400 focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]";

export const fieldLabelClassName =
  "space-y-2 text-xs uppercase tracking-[0.12em] text-zinc-500";

export const controlRowClassName = "flex h-11 items-center";

export const panelClassName =
  "rounded-[1.6rem] bg-[color:var(--milk)]/92 p-3.5 shadow-[0_18px_40px_-32px_rgba(38,35,33,0.72),0_8px_20px_-18px_rgba(82,74,70,0.5)] sm:p-4";

export const panelDashedClassName =
  "rounded-[1.6rem] bg-[color:var(--milk)]/92 p-3.5 shadow-[0_18px_40px_-32px_rgba(38,35,33,0.72),0_8px_20px_-18px_rgba(82,74,70,0.5)] sm:p-4";

export const tableShellClassName =
  "hidden overflow-x-auto rounded-[1.6rem] bg-[color:var(--milk)]/92 shadow-[0_18px_42px_-32px_rgba(38,35,33,0.72),0_8px_20px_-18px_rgba(82,74,70,0.48)] md:block";

export const listCardClassName =
  "grid gap-4 rounded-[1.6rem] bg-[color:var(--milk)]/92 p-4 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.72),0_8px_18px_-18px_rgba(82,74,70,0.48)] transition-shadow hover:shadow-[0_20px_44px_-30px_rgba(38,35,33,0.78),0_12px_24px_-18px_rgba(82,74,70,0.52)]";

export const emptyStateClassName =
  "rounded-[1.6rem] bg-[color:var(--milk)]/82 px-4 py-6 text-sm text-zinc-600 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.68),0_8px_18px_-18px_rgba(82,74,70,0.42)]";

export const buttonSoftClassName =
  "h-11 rounded-2xl border border-[color:var(--line)] bg-white px-4 text-sm text-zinc-700 transition hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-55";

export const buttonGhostClassName =
  "h-11 rounded-2xl border border-transparent px-4 text-sm text-zinc-600 transition hover:border-[color:var(--line)] hover:text-[color:var(--chocolate-deep)]";

type SectionTitleProps = {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
};

export function SectionTitle({
  title,
  icon: Icon,
  action,
}: SectionTitleProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-[color:var(--chocolate-deep)]">
          <Icon className="h-5 w-5 shrink-0 text-[color:var(--accent)]" />
          {title}
        </h2>
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
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "boxed" | "airy" | "dashed";
};

export function Disclosure({
  title,
  children,
  defaultOpen = false,
  variant = "boxed",
}: DisclosureProps) {
  const disclosureId = useId();
  const contentId = `${disclosureId}-content`;
  const boxed = variant === "boxed";
  const dashed = variant === "dashed";
  const airy = variant === "airy";

  return (
    <section
      className={`relative h-fit ${
        boxed
          ? "rounded-[1.6rem] bg-[color:var(--milk)]/92 p-3.5 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.7),0_8px_18px_-18px_rgba(82,74,70,0.46)]"
          : dashed
            ? "rounded-[1.6rem] bg-[color:var(--milk)]/92 p-3.5 shadow-[0_16px_36px_-30px_rgba(38,35,33,0.7),0_8px_18px_-18px_rgba(82,74,70,0.46)]"
            : "border-b border-[color:var(--line)] pb-3"
      }`}
    >
      <input
        aria-controls={contentId}
        className="peer sr-only"
        defaultChecked={defaultOpen}
        id={disclosureId}
        type="checkbox"
      />
      <label
        className={`flex cursor-pointer list-none items-center justify-between gap-3 pr-7 outline-none transition peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--caramel-soft)] ${
          airy ? "py-1" : "rounded-xl px-1 py-1"
        }`}
        htmlFor={disclosureId}
      >
        <div>
          <p className="text-sm font-semibold text-[color:var(--chocolate-deep)]">
            {title}
          </p>
        </div>
      </label>
      <ChevronDown
        className={`pointer-events-none absolute h-4 w-4 text-zinc-500 transition-transform duration-300 peer-checked:rotate-180 ${
          airy ? "right-0 top-1.5" : "right-4 top-4"
        }`}
      />
      <div
        className="grid grid-rows-[0fr] overflow-hidden opacity-0 transition-all duration-300 ease-out peer-checked:mt-3 peer-checked:grid-rows-[1fr] peer-checked:overflow-visible peer-checked:opacity-100"
        id={contentId}
      >
        <div className="min-h-0 overflow-visible">{children}</div>
      </div>
    </section>
  );
}
