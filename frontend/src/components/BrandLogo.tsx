interface BrandLogoProps {
  /** "full" = crown + GF, "mark" = GF only (for small spaces) */
  variant?: 'full' | 'mark';
  className?: string;
}

export default function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  return (
    <img
      src={variant === 'full' ? '/logo-gf.png' : '/gf-mark.png'}
      alt="Gorgeous Furniture"
      draggable={false}
      className={className}
    />
  );
}
