<script lang="ts">
  import { type Snippet } from 'svelte';
  import { cn } from '../../utils';

  type Variant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';

  interface Props {
    variant?: Variant;
    class?: string;
    children?: Snippet;
  }

  let { variant = 'default', class: className = '', children }: Props = $props();

  const variantStyles: Record<Variant, string> = {
    default: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    secondary: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    outline: 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    destructive: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    success: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    variantStyles[variant],
    className
  )}
>
  {@render children?.()}
</span>
