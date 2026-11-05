import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary: "bg-white text-black hover:bg-zinc-200 hover:glow disabled:bg-raised disabled:text-faint disabled:shadow-none",
  secondary: "border border-line-strong bg-surface text-white hover:border-white disabled:text-faint",
  ghost: "text-muted hover:text-white",
  good: "bg-green-600 text-white hover:bg-green-500",
  bad: "bg-red-600 text-white hover:bg-red-500",
};

const buttonSizes = {
  sm: "h-9 px-3 text-xs gap-1.5 tracking-wider",
  md: "h-11 px-5 text-sm gap-2 tracking-[0.15em]",
  lg: "h-14 px-7 text-base gap-2.5 tracking-[0.15em]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-bold uppercase transition-all select-none disabled:cursor-not-allowed [&_svg]:size-4.5",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card rounded-2xl", className)} {...props} />;
}

export function PanelTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("label", className)} {...props} />;
}

const pillTones = {
  neutral: "border-line text-muted",
  accent: "border-accent/50 bg-accent-soft text-accent-light",
  good: "border-good/50 text-good",
  bad: "border-bad/50 text-bad",
};

export function Pill({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof pillTones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-wider", pillTones[tone], className)}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-5 animate-spin rounded-full border-2 border-line-strong border-t-accent", className)} />;
}
