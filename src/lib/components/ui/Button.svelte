<script lang="ts">
  import { type Snippet } from 'svelte';
  import { cn } from '../../utils';

  type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  type Size = 'default' | 'sm' | 'lg' | 'icon';

  interface Props {
    variant?: Variant;
    size?: Size;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    class?: string;
    title?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    [key: string]: any;
  }

  let {
    variant = 'default',
    size = 'default',
    type = 'button',
    disabled = false,
    class: className = '',
    title,
    onclick,
    children,
    ...rest
  }: Props = $props();

  const variantStyles: Record<Variant, string> = {
    default: 'bg-emerald-600 text-white hover:bg-emerald-700',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700',
    outline: 'border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100',
    secondary: 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700',
    ghost: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
    link: 'text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400 p-0 h-auto',
    success: 'bg-teal-600 text-white hover:bg-teal-700',
  };

  const sizeStyles: Record<Size, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs rounded-md',
    lg: 'h-12 px-6 text-base rounded-md',
    icon: 'h-10 w-10 p-0 flex items-center justify-center rounded-md',
  };
</script>

<button
  {type}
  {disabled}
  {title}
  {onclick}
  class={cn(
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none',
    variantStyles[variant],
    sizeStyles[size],
    className
  )}
  {...rest}
>
  {@render children?.()}
</button>
