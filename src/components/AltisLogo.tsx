import usdpLogo from "@/assets/usdp-logo.png";

const AltisLogo = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <img
    src={usdpLogo}
    alt="USDP"
    width={size}
    height={size}
    className={className}
    style={{ width: size, height: size, objectFit: 'contain' }}
  />
);

export default AltisLogo;
