<script lang="ts">
  import { type Snippet } from 'svelte';
  import { cn } from '../../utils';
  import { X } from 'lucide-svelte';

  interface Props {
    open: boolean;
    title?: string;
    description?: string;
    onclose: () => void;
    children?: Snippet;
    footer?: Snippet;
    maxWidth?: string;
  }

  let {
    open = $bindable(false),
    title,
    description,
    onclose,
    children,
    footer,
    maxWidth = 'max-w-lg',
  }: Props = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in-0 flex items-center justify-center p-4 overflow-y-auto"
    onclick={onclose}
    role="presentation"
  >
    <!-- Modal content -->
    <div
      class={cn(
        'relative w-full max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl transition-all my-auto text-slate-900 dark:text-slate-100',
        maxWidth
      )}
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onclick={onclose}
        class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
        aria-label="Close"
      >
        <X class="h-4 w-4" />
      </button>

      {#if title || description}
        <div class="mb-4 pr-6">
          {#if title}
            <h2 class="text-xl font-semibold tracking-tight leading-none">{title}</h2>
          {/if}
          {#if description}
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          {/if}
        </div>
      {/if}

      <div class="my-2 max-h-[75vh] overflow-y-auto">
        {@render children?.()}
      </div>

      {#if footer}
        <div class="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
