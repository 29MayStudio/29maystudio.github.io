<script lang="ts">
  import { type Snippet } from 'svelte';
  import { cn } from '../../utils';

  interface Props {
    title?: string;
    description?: string;
    class?: string;
    children?: Snippet;
    headerAction?: Snippet;
  }

  let {
    title,
    description,
    class: className = '',
    children,
    headerAction,
  }: Props = $props();
</script>

<div class={cn('rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-black shadow-xs transition-all duration-200 card-hover-lift overflow-hidden text-slate-900 dark:text-slate-100', className)}>
  {#if title || description || headerAction}
    <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div>
        {#if title}
          <h3 class="font-normal text-lg leading-none text-slate-900 dark:text-slate-100">{title}</h3>
        {/if}
        {#if description}
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        {/if}
      </div>
      {#if headerAction}
        <div>
          {@render headerAction()}
        </div>
      {/if}
    </div>
  {/if}

  <div class="p-5">
    {@render children?.()}
  </div>
</div>
