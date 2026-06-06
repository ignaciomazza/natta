"use client";

import { inputClassName } from "@/components/internal/ui";

type MoneyInputChange = {
  display: string;
  amount: number;
};

type MoneyInputProps = {
  value: string;
  onChange: (next: MoneyInputChange) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
};

function formatThousands(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function normalizeFromRaw(raw: string): MoneyInputChange {
  const sanitized = raw.replace(/[^\d,]/g, "");
  if (!sanitized) {
    return {
      amount: 0,
      display: "",
    };
  }

  const commaIndex = sanitized.indexOf(",");
  const integerRaw =
    commaIndex >= 0 ? sanitized.slice(0, commaIndex) : sanitized;
  const decimalRaw =
    commaIndex >= 0
      ? sanitized.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2)
      : "";

  const normalizedInteger =
    integerRaw.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const integerFormatted = formatThousands(normalizedInteger);

  return {
    amount: Number(normalizedInteger),
    display:
      commaIndex >= 0 ? `${integerFormatted},${decimalRaw}` : integerFormatted,
  };
}

function withPaddedDecimals(display: string) {
  if (!display || !display.includes(",")) return display;
  const [integerPart, decimalPart = ""] = display.split(",");
  return `${integerPart},${decimalPart.padEnd(2, "0").slice(0, 2)}`;
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0",
  required,
  className,
  name,
  id,
}: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
        $
      </span>
      <input
        className={`${inputClassName} pl-8 ${className ?? ""}`}
        id={id}
        inputMode="decimal"
        name={name}
        onBlur={() => {
          const padded = withPaddedDecimals(value);
          if (padded === value) return;
          const normalized = normalizeFromRaw(padded);
          onChange({
            amount: normalized.amount,
            display: padded,
          });
        }}
        onChange={(event) => {
          const next = normalizeFromRaw(event.target.value);
          onChange(next);
        }}
        onKeyDown={(event) => {
          if (event.key !== "," && event.key !== ".") return;
          event.preventDefault();
          if (value.includes(",")) return;

          const base = normalizeFromRaw(value);
          const baseDisplay = base.display || "0";
          onChange({
            amount: base.amount,
            display: `${baseDisplay},00`,
          });
        }}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value}
      />
    </div>
  );
}
