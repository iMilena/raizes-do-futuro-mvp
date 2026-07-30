/*
  Ícones em SVG puro, como componentes React.
  Nenhuma biblioteca externa é usada (mantendo o projeto sem dependências
  além de React + Vite) e nenhum emoji é usado no lugar de ícone.

  Todos os ícones aceitam `size` e `color` (ou herdam a cor do texto via
  `currentColor` quando `color` não é informado).
*/

const baseProps = (size, color, strokeWidth) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color || 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export function LeafIcon({ size = 20, color, strokeWidth = 2.2, className, filled = false }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color || 'currentColor'}
        className={className}
      >
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 22 2c0 5-2.5 6.5-4.9 12-3 3-3.9 3.7-6.1 6z" />
      </svg>
    );
  }
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 22 2c0 5-2.5 6.5-4.9 12-3 3-3.9 3.7-6.1 6z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

export function PhoneIcon({ size = 16, color, strokeWidth = 2.2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function ClockIcon({ size = 16, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function ZapIcon({ size = 16, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function ArchiveIcon({ size = 16, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
    </svg>
  );
}

export function LayersIcon({ size = 18, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M15 3H5a2 2 0 0 0-2 2v10" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 14, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function InstagramIcon({ size = 14, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

export function TwitterIcon({ size = 14, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
    </svg>
  );
}

export function LinkedinIcon({ size = 14, color, strokeWidth = 2, className }) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
      <path d="M10 9v12M10 13a4 4 0 0 1 8 0v8" />
    </svg>
  );
}
