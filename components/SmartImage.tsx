import Image, { type ImageProps } from "next/image";

/** next/image + fallback placeholder. SVG tidak dioptimasi (sudah ringan). */
export function SmartImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src?: string | null }) {
  const url = src || "/placeholders/kitchen-1.svg";
  const isSvg = url.endsWith(".svg");
  return <Image src={url} alt={alt} unoptimized={isSvg || props.unoptimized} {...props} />;
}
