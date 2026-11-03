"use client";

import {
  Content as SelectContent,
  Icon as SelectIcon,
  Item as SelectItem,
  ItemIndicator as SelectItemIndicator,
  ItemText as SelectItemText,
  Portal as SelectPortal,
  Root as SelectRoot,
  ScrollDownButton as SelectScrollDownButton,
  ScrollUpButton as SelectScrollUpButton,
  Trigger as SelectTrigger,
  Value as SelectValue,
  Viewport as SelectViewport,
} from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

export type SelectFieldOption = {
  value: string;
  label: string;
};

export function SelectField({
  id,
  label,
  options,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  options: SelectFieldOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label className="select-field-label" htmlFor={id}>
        <span>{label}</span>
      </label>
      <SelectRoot onValueChange={onValueChange} value={value}>
        <SelectTrigger aria-label={label} className="select-trigger" id={id}>
          <SelectValue />
          <SelectIcon aria-hidden="true"><ChevronDown size={17} /></SelectIcon>
        </SelectTrigger>
        <SelectPortal>
          <SelectContent className="select-content" position="popper" sideOffset={6}>
            <SelectScrollUpButton className="select-scroll-button"><ChevronUp size={16} /></SelectScrollUpButton>
            <SelectViewport className="select-viewport">
              {options.map((option) => (
                <SelectItem className="select-item" key={option.value} value={option.value}>
                  <SelectItemText>{option.label}</SelectItemText>
                  <SelectItemIndicator className="select-item-indicator"><Check aria-hidden="true" size={15} /></SelectItemIndicator>
                </SelectItem>
              ))}
            </SelectViewport>
            <SelectScrollDownButton className="select-scroll-button"><ChevronDown size={16} /></SelectScrollDownButton>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </div>
  );
}
