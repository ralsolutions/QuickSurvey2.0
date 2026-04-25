export function Toast({ msg }) {
  return (
    <div style={{
      position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)',
      background: '#111827', border: '1px solid #1e3a5f', borderRadius: 20,
      padding: '8px 20px', fontSize: 12, color: '#e2e8f0', zIndex: 500,
      pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>{msg}</div>
  );
}
