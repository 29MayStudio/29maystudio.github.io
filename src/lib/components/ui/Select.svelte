<script lang="ts">
  import { type Snippet } from 'svelte';
  import { cn } from '../../utils';

  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    value?: string;
    options?: Option[];
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    id?: string;
    name?: string;
    onchange?: (e: Event & { currentTarget: HTMLSelectElement }) => void;
    children?: Snippet;
  }

  let {
    value = $bindable(''),
    options = [],
    placeholder,
    disabled = false,
    class: className = '',
    id,
    name,
    onchange,
    children,
    ...rest
  }: Props = $props();
</script>

<select
  {id}
  {name}
  {disabled}
  bind:value
  {onchange}
  class={cn(
    'flex h-10 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer',
    className
  )}
  {...rest}
>
  {#if placeholder}
    <option value="" disabled selected={!value}>{placeholder}</option>
  {/if}

  {#if children}
    {@render children()}
  {:else}
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  {/if}
</select>
