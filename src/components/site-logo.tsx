import Image from "next/image";

const logo = {
  src: "/images/logo/natta-logo-cropped.png",
  width: 1080,
  height: 610,
};

type SiteLogoProps = {
  className?: string;
  priority?: boolean;
};

export function SiteLogo({ className = "", priority = false }: SiteLogoProps) {
  return (
    <Image
      alt="Natta"
      className={className}
      height={logo.height}
      priority={priority}
      src={logo.src}
      width={logo.width}
    />
  );
}
