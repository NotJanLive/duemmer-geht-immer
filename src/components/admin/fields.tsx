import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border border-line bg-zinc-950/60 px-3 outline-none transition-colors placeholder:text-faint focus:border-accent";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="label block">{label}</span>
      {children}
      {hint && <span className="block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, "h-11", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-32 py-2.5 font-mono text-sm", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, "h-11", className)} {...props} />;
}

export function PointsPill({ value }: { value: number }) {
  return (
    <span className="inline-flex rounded-full border border-accent/50 bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent-light">
      {value} {value === 1 ? "Punkt" : "Punkte"}
    </span>
  );
}
