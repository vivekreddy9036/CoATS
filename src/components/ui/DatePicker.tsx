"use client";

import { useState, useRef, useEffect } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar } from "@/components/ui/Calendar";

interface DatePickerProps {
  value: string;               // "YYYY-MM-DD" string (form-compatible)
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  required,
  placeholder = "Select date",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the YYYY-MM-DD value into a Date (or undefined)
  const selectedDate = value
    ? parse(value, "yyyy-MM-dd", new Date())
    : undefined;

  const displayValue =
    selectedDate && isValid(selectedDate)
      ? format(selectedDate, "dd MMM yyyy")
      : "";

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && " *"}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-navy focus:border-navy outline-none transition-colors text-left cursor-pointer"
      >
        <span className={displayValue ? "text-gray-900" : "text-gray-400"}>
          {displayValue || placeholder}
        </span>
        <svg
          className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="text"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 animate-in fade-in-0 zoom-in-95">
          <Calendar
            mode="single"
            selected={selectedDate && isValid(selectedDate) ? selectedDate : undefined}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
              } else {
                onChange("");
              }
              setOpen(false);
            }}
            captionLayout="dropdown"
            defaultMonth={selectedDate && isValid(selectedDate) ? selectedDate : new Date()}
            className="[--cell-size:2.75rem]"
          />
          {value && (
            <div className="px-3 pb-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
              >
                Clear date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
