import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";

const EASE_OUT_QUART = "cubic-bezier(0.165, 0.84, 0.44, 1)";

type NumberFlowElement = HTMLElementTagNameMap["number-flow"];

type Props = {
  value: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Vanilla Number Flow wired for React: `import 'number-flow'` + `.update(n)`.
 * @see https://number-flow.barvian.me/vanilla
 */
export function NumberFlowValue({ value, className, style }: Props) {
  const ref = useRef<NumberFlowElement | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    let alive = true;
    void import("number-flow").then((mod) => {
      if (!alive || !ref.current) return;
      const el = ref.current;
      el.transformTiming = {
        duration: 450,
        easing: EASE_OUT_QUART,
      };
      el.spinTiming = {
        duration: 450,
        easing: EASE_OUT_QUART,
      };
      el.opacityTiming = {
        duration: 280,
        easing: "ease-out",
      };
      // First update hydrates; subsequent calls animate.
      el.update(value);
      booted.current = true;
      // Silence unused import warning if tree-shaken oddly
      void mod;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  useLayoutEffect(() => {
    if (!booted.current || !ref.current) return;
    ref.current.update(value);
  }, [value]);

  return (
    <number-flow
      ref={ref}
      className={className}
      data-will-change=""
      style={{
        fontVariantNumeric: "tabular-nums",
        lineHeight: 0.85,
        ...style,
      }}
    />
  );
}
