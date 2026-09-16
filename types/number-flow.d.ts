import type { DetailedHTMLProps, HTMLAttributes, Ref } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "number-flow": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        ref?: Ref<HTMLElementTagNameMap["number-flow"] | null>;
      };
    }
  }
}

export {};
