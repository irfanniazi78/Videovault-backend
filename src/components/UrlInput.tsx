"use client";

import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export function UrlInput({ value, onChange, onSubmit, isLoading, error }: UrlInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <Input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste an Internet Archive link… e.g. https://archive.org/details/BigBuckBunny_124"
        aria-label="Video URL"
        autoComplete="url"
        spellCheck={false}
        error={error}
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="submit" loading={isLoading} disabled={isLoading || !value.trim()} fullWidth>
          {isLoading ? "Analyzing…" : "Analyze"}
        </Button>
      </div>
    </form>
  );
}
