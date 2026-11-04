# Bolt's Journal

## 2026-11-04 - Cache Intl.DateTimeFormat in Reactive Iterations
**Learning:** In Svelte 5 `$derived.by` computations mapping over large arrays (such as audit logs or database records), calling `Date.prototype.toLocaleTimeString()` on each record re-instantiates an internal `Intl.DateTimeFormat` instance with full locale resolution on every run. For 1,000 records, this takes ~174ms on every filter keystroke, whereas reusing a module-scoped `Intl.DateTimeFormat` instance takes ~2.6ms (~66x speedup).
**Action:** When formatting dates or numbers inside loops or reactive derivations, always instantiate and cache `Intl.DateTimeFormat` or `Intl.NumberFormat` at the module level.
