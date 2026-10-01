"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

// Select over value/label pairs; the trigger shows the chosen label.
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  className = "h-11",
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(String(next ?? ""))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue>
          {(selected) =>
            options.find((option) => option.value === selected)?.label ?? placeholder
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
