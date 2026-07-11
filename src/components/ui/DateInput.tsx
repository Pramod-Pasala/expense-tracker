"use client";

import { useState, useEffect, useRef } from "react";

interface DateInputProps {
  id?: string;
  label?: string;
  value: string; // ISO date: YYYY-MM-DD
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  lang?: string;
  min?: string; // ISO date
  max?: string; // ISO date
  className?: string;
}

/**
 * DateInput — a custom date input that always displays dd.mm.yyyy format
 * regardless of browser locale. Uses a text input internally and converts
 * to/from ISO date strings (YYYY-MM-DD).
 *
 * On focus, shows a native date picker overlay for convenience.
 */
export default function DateInput({
  id,
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  className,
}: DateInputProps) {
  // Convert ISO (YYYY-MM-DD) to display format (dd.mm.yyyy)
  function isoToDisplay(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}.${m}.${y}`;
  }

  // Convert display (dd.mm.yyyy) to ISO (YYYY-MM-DD)
  function displayToIso(display: string): string {
    const cleaned = display.replace(/[^\d]/g, "");
    if (cleaned.length !== 8) return "";
    const d = cleaned.slice(0, 2);
    const m = cleaned.slice(2, 4);
    const y = cleaned.slice(4, 8);
    return `${y}-${m}-${d}`;
  }

  const [displayValue, setDisplayValue] = useState(isoToDisplay(value));
  const [focused, setFocused] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Sync display when external value changes
  useEffect(() => {
    if (!focused) {
      setDisplayValue(isoToDisplay(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Auto-format: add dots as user types
    const digits = raw.replace(/\D/g, "");
    let formatted = "";
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    } else {
      formatted = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    }
    setDisplayValue(formatted);

    const iso = displayToIso(formatted);
    if (iso) {
      // Validate the date is real
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    setFocused(false);
    // Reset to ISO-derived display if invalid
    const iso = displayToIso(displayValue);
    if (!iso) {
      setDisplayValue(isoToDisplay(value));
    } else {
      setDisplayValue(isoToDisplay(iso));
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="dd.mm.yyyy"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          pattern="\d{2}\.\d{2}\.\d{4}"
          maxLength={10}
          className={className || "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"}
        />
        {/* Native date picker as overlay — invisible but provides calendar on click */}
        <input
          ref={hiddenRef}
          type="date"
          value={value}
          onChange={handleNativeChange}
          disabled={disabled}
          min={min}
          max={max}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
