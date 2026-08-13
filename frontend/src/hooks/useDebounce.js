import { useState, useEffect } from 'react';

/**
 * Custom Hook: Delay value changes until user stops typing (anti-spam search requests)
 * @param {any} value - The input value to debounce (e.g. search input string)
 * @param {number} delay - Delay duration in milliseconds (default: 400ms)
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
