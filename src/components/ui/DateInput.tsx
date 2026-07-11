"use client";

import { useState, useEffect } from "react";

interface DateInputProps {
  id?: string;
  label?: string;
  value: string; // ISO date: YYYY-MM-DD
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  min?: string; // ISO date
  max?: string; // ISO date
  className?: string;
}

/**
 * DateInput — a custom date input that always displays dd.mm.yyyy format
 * regardless of browser locale. Uses a text input with auto-formatting.
 */
export default function DateInput({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
}: DateInputProps) {
  function isoToDisplay(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return "";
    return `${d}.${m}.${y}`;
  }

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

  useEffect(() => {
    if (!focused) {
      setDisplayValue(isoToDisplay(value));
    }
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
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
      const [y, m, d] = iso.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const iso = displayToIso(displayValue);
    if (!iso) {
      setDisplayValue(isoToDisplay(value));
    } else {
      setDisplayValue(isoToDisplay(iso));
    }
  };

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
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
    </div>
  );
}
