import { useState } from 'react';

// Manages a DRF-style ordering string ("email" = asc, "-email" = desc) for
// server-side sorting. Clicking a column cycles asc -> desc -> asc; clicking
// a different column resets to ascending on that one instead.
export function useOrdering(initial = null) {
  const [ordering, setOrdering] = useState(initial);

  function toggleSort(key) {
    setOrdering((prev) => (prev === key ? `-${key}` : key));
  }

  return [ordering, toggleSort];
}
