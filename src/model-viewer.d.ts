import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  alt?: string;
  poster?: string;
  loading?: "auto" | "eager" | "lazy";
  reveal?: "auto" | "interaction" | "manual";
  "camera-controls"?: boolean;
  "auto-rotate"?: boolean;
  "rotation-per-second"?: string;
  "shadow-intensity"?: string | number;
  exposure?: string | number;
  "environment-image"?: string;
  "interaction-prompt"?: "auto" | "none" | "when-focused";
  "tone-mapping"?: string;
  style?: CSSProperties;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
