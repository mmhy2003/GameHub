import { useEffect, useRef } from "react";
/** Calls onChange(next, prev) when value changes after mount (Object.is). Never on the first render. */
export function useOnChange<T>(value: T, onChange: (next: T, prev: T) => void) {
  const prev = useRef(value);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; });
  useEffect(() => {
    if (!Object.is(prev.current, value)) {
      const p = prev.current;
      prev.current = value;
      cb.current(value, p);
    }
  }, [value]);
}
