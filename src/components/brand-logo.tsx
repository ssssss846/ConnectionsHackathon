import Image from "next/image";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/unsw-mates-logo.png"
      alt=""
      width={44}
      height={44}
      priority={priority}
      className={`h-11 w-11 shrink-0 rounded-lg object-contain ${className}`}
    />
  );
}
