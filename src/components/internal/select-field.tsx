"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { inputClassName } from "@/components/internal/ui";

type SelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

type SelectOptionProps = {
  children: ReactNode;
  disabled?: boolean;
  value: string;
};

type ParsedSelectOption = {
  content: ReactNode;
  disabled: boolean;
  value: string;
};

export function SelectOption(props: SelectOptionProps) {
  void props;
  return null;
}

export function SelectField({
  value,
  onChange,
  children,
  className,
}: SelectFieldProps) {
  const selectId = useId();
  const listboxId = `${selectId}-listbox`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  const options = useMemo(
    () =>
      Children.toArray(children).flatMap((child): ParsedSelectOption[] => {
        if (!isValidElement<SelectOptionProps>(child)) return [];

        return [
          {
            content: child.props.children,
            disabled: Boolean(child.props.disabled),
            value: child.props.value,
          },
        ];
      }),
    [children],
  );

  const selectedOption =
    options.find((option) => option.value === value) ??
    options.find((option) => !option.disabled);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const selectOption = (nextValue: string) => {
    const nextOption = options.find((option) => option.value === nextValue);
    if (!nextOption || nextOption.disabled) return;

    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const focusOption = (direction: 1 | -1) => {
    const enabledOptions = options.filter((option) => !option.disabled);
    if (!enabledOptions.length) return;

    const activeElement = document.activeElement;
    const focusedIndex = enabledOptions.findIndex(
      (option) => optionRefs.current.get(option.value) === activeElement,
    );
    const selectedIndex = enabledOptions.findIndex((option) => option.value === value);
    const currentIndex = focusedIndex === -1 ? selectedIndex : focusedIndex;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;

    optionRefs.current.get(enabledOptions[nextIndex].value)?.focus();
  };

  const focusSelectedOption = () => {
    const targetValue =
      selectedOption?.value ?? options.find((option) => !option.disabled)?.value;

    if (targetValue) {
      optionRefs.current.get(targetValue)?.focus();
    }
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(focusSelectedOption);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusOption(-1));
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: ParsedSelectOption,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(-1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(option.value);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`${inputClassName} flex items-center justify-between gap-3 pr-10 text-left ${className ?? ""}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">
          {selectedOption?.content ?? "Seleccionar"}
        </span>
      </button>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />

      {open ? (
        <div
          className="absolute left-0 right-0 z-50 mt-4 max-h-64 space-y-1 overflow-y-auto rounded-[1.35rem] bg-[color:var(--milk)] p-1.5 shadow-[0_22px_48px_-26px_rgba(38,35,33,0.72),0_12px_24px_-16px_rgba(82,74,70,0.5)]"
          id={listboxId}
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-selected={selected}
                className={`flex w-full items-center justify-between gap-3 rounded-[1rem] px-3 py-2 text-left text-sm transition focus:outline-none ${
                  selected
                    ? "bg-[color:var(--surface-soft)] font-semibold text-[color:var(--chocolate-deep)]"
                    : "text-zinc-700 hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--chocolate-deep)] focus:bg-[color:var(--surface-soft)]"
                } disabled:cursor-not-allowed disabled:opacity-45`}
                disabled={option.disabled}
                key={option.value}
                onClick={() => selectOption(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, option)}
                ref={(node) => {
                  if (node) {
                    optionRefs.current.set(option.value, node);
                  } else {
                    optionRefs.current.delete(option.value);
                  }
                }}
                role="option"
                type="button"
              >
                <span className="min-w-0 truncate">{option.content}</span>
                {selected ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
