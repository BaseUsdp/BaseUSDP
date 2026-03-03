import { motion } from "framer-motion";

const LogoStrip = () => {
  const technologies = [
    { name: "Base", icon: "base" },
    { name: "ZK Proofs", icon: "shield" },
    { name: "x402", icon: "dollar" },
    { name: "Rust", icon: "code" },
    { name: "TypeScript", icon: "typescript" },
    { name: "React", icon: "react" },
  ];

  return (
    <div className="bg-white border-b border-black/5 py-8">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="text-center mb-6">
          <span className="text-[10px] uppercase text-black/30 tracking-widest font-mono">
            Powered By Leading Technologies
          </span>
        </div>
        <div className="overflow-hidden marquee-container">
          <motion.div 
            className="flex gap-16 items-center py-4 opacity-60 hover:opacity-90 transition-opacity duration-700"
            animate={{ x: [0, -1000] }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            {[...technologies, ...technologies, ...technologies].map((tech, i) => (
              <div key={`tech-${i}`} className="flex items-center gap-2 flex-shrink-0">
                <TechIcon name={tech.icon} />
                <span className="text-xs font-medium text-black/50">{tech.name}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const TechIcon = ({ name }: { name: string }) => {
  const icons: Record<string, JSX.Element> = {
    base: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 17.75c-3.171 0-5.75-2.579-5.75-5.75S8.829 6.25 12 6.25s5.75 2.579 5.75 5.75-2.579 5.75-5.75 5.75z"/>
      </svg>
    ),
    shield: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5zm0 10.99h7c-.5 4-3.3 7.5-7 8.5V12H5V8.3l7-3.9v8.59z"/>
      </svg>
    ),
    dollar: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09v.58c0 .73-.6 1.33-1.33 1.33h-.16c-.73 0-1.33-.6-1.33-1.33v-.6c-1.33-.28-2.51-.89-3.41-1.8l1.47-1.47c.66.62 1.58 1.04 2.6 1.12v-3.37c-2.09-.53-3.67-1.67-3.67-3.72 0-2.23 1.81-3.67 3.67-3.89V4.33c0-.73.6-1.33 1.33-1.33h.16c.73 0 1.33.6 1.33 1.33v.58c1.09.21 2.06.7 2.86 1.42l-1.4 1.53c-.53-.46-1.22-.78-2-.88v3.17c2.15.55 3.8 1.51 3.8 3.79 0 2.34-1.66 3.77-3.92 4.15z"/>
      </svg>
    ),
    code: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.293 6.293L2.586 12l5.707 5.707 1.414-1.414L5.414 12l4.293-4.293-1.414-1.414zm7.414 0l-1.414 1.414L18.586 12l-4.293 4.293 1.414 1.414L21.414 12l-5.707-5.707z"/>
      </svg>
    ),
    typescript: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0H1.125zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
      </svg>
    ),
    react: (
      <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38a2.167 2.167 0 0 0-1.092-.278z"/>
      </svg>
    ),
  };
  return icons[name] || null;
};

export default LogoStrip;
