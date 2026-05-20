import Image from "next/image";

import { APP_NAME } from "@/lib/constants";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: "header" | "hero" | "auth";
};

const logoSizes = {
  header: { width: 300, height: 72 },
  hero: { width: 760, height: 180 },
  auth: { width: 500, height: 120 },
} as const;

export function BrandLogo({ className = "", priority = false, size = "header" }: BrandLogoProps) {
  const dimensions = logoSizes[size];

  return (
    <Image
      src="/unsw-mates-logo.png"
      alt={APP_NAME}
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      style={{ width: dimensions.width, height: dimensions.height, objectFit: "cover", objectPosition: "center" }}
      className={`max-w-full ${className}`}
    />
  );
}
