<script lang="ts">
  import { Calendar } from 'lucide-svelte';

  interface Props {
    value?: string; // Stored ISO format YYYY-MM-DD
    id?: string;
    class?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
  }

  let {
    value = $bindable(''),
    id,
    class: customClass = '',
    required = false,
    disabled = false,
    placeholder = 'dd/mm/yyyy'
  }: Props = $props();

  let nativeDateInput = $state<HTMLInputElement | null>(null);

  // Convert YYYY-MM-DD to DD/MM/YYYY for display
  function toDisplay(isoStr: string): string {
    if (!isoStr) return '';
    const parts = isoStr.split('T')[0].split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoStr;
  }

  // Convert DD/MM/YYYY to YYYY-MM-DD for storage
  function toIso(dmyStr: string): string | null {
    if (!dmyStr) return '';
    const clean = dmyStr.trim();
    const parts = clean.split(/[/-]/);
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      if (y.length === 4) {
        const dayNum = parseInt(d, 10);
        const monthNum = parseInt(m, 10);
        const yearNum = parseInt(y, 10);
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31 && yearNum >= 1900) {
          return `${y}-${m}-${d}`;
        }
      }
    }
    return null;
  }

  let textValue = $state(toDisplay(value));

  // Sync textValue whenever value prop changes externally
  $effect(() => {
    const formatted = toDisplay(value);
    if (formatted !== textValue) {
      textValue = formatted;
    }
  });

  function handleTextInput(e: Event) {
    const target = e.target as HTMLInputElement;
    textValue = target.value;
    const iso = toIso(textValue);
    if (iso) {
      value = iso;
    }
  }

  function handleBlur() {
    const iso = toIso(textValue);
    if (iso) {
      value = iso;
      textValue = toDisplay(iso);
    } else if (!textValue.trim()) {
      value = '';
    } else {
      // Revert back to current value
      textValue = toDisplay(value);
    }
  }

  function openNativePicker() {
    if (disabled) return;
    if (nativeDateInput) {
      if ('showPicker' in HTMLInputElement.prototype) {
        try {
          nativeDateInput.showPicker();
          return;
        } catch {
          // fallback to click
        }
      }
      nativeDateInput.focus();
      nativeDateInput.click();
    }
  }
</script>

<div class="relative flex items-center w-full">
  <!-- Visual Text Input showing dd/mm/yyyy -->
  <input
    {id}
    type="text"
    bind:value={textValue}
    oninput={handleTextInput}
    onblur={handleBlur}
    {placeholder}
    {required}
    {disabled}
    class={`w-full pr-8 text-xs font-mono rounded-lg transition-all ${customClass}`}
  />

  <!-- Hidden native date input for the browser calendar picker -->
  <input
    bind:this={nativeDateInput}
    type="date"
    bind:value
    tabindex="-1"
    aria-hidden="true"
    class="absolute opacity-0 pointer-events-none w-0 h-0 right-0 bottom-0"
  />

  <!-- Calendar Icon Trigger -->
  <button
    type="button"
    tabindex="-1"
    onclick={openNativePicker}
    class="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
    title="Open calendar picker"
  >
    <Calendar class="w-3.5 h-3.5" />
  </button>
</div>
