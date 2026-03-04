import logoSrc from "@/assets/usdp-logo.png";

const AltisLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <img
    src={logoSrc}
    width={size}
    height={size}
    alt="USDP"
    className={className}
    style={{ objectFit: "contain" }}
  />
);

export default AltisLogo;