<script lang="ts">
  import { cn } from '../../utils';

  interface Props {
    value?: string | number;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    required?: boolean;
    class?: string;
    id?: string;
    name?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onchange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    disabled = false,
    required = false,
    class: className = '',
    id,
    name,
    min,
    max,
    step,
    oninput,
    onchange,
    onkeydown,
    ...rest
  }: Props = $props();
</script>

<input
  {id}
  {name}
  {type}
  {placeholder}
  {disabled}
  {required}
  {min}
  {max}
  {step}
  bind:value
  {oninput}
  {onchange}
  {onkeydown}
  class={cn(
    'flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all',
    className
  )}
  {...rest}
/>
