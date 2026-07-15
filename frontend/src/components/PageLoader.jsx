/**
 * PageLoader — centered loading spinner for full-page or section loading states.
 *
 * Usage:
 *   <PageLoader />              // default medium size
 *   <PageLoader size="sm" />    // small (inline-ish)
 *   <PageLoader size="lg" />    // large (full page)
 *   <PageLoader label="Carregando dados..." />
 */
export default function PageLoader({ size = 'md', label = 'Carregando...' }) {
  const sizeMap = {
    sm: 18,
    md: 32,
    lg: 48,
  };

  const px = sizeMap[size] ?? sizeMap.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: size === 'lg' ? '64px 16px' : size === 'sm' ? '16px' : '32px 16px',
        width: '100%',
      }}
      aria-label={label}
      role="status"
    >
      <span
        style={{
          display: 'block',
          width: `${px}px`,
          height: `${px}px`,
          borderRadius: '50%',
          border: `${px <= 20 ? 2 : 3}px solid rgba(255,45,85,0.2)`,
          borderTopColor: 'var(--accent, #ff2d55)',
          animation: 'spin 0.9s linear infinite',
        }}
        aria-hidden="true"
      />
      {size !== 'sm' ? (
        <span style={{ fontSize: '0.85rem', opacity: 0.55 }}>{label}</span>
      ) : null}
    </div>
  );
}
