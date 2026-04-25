import { memo } from 'react';
import { C, SC } from '../lib/constants.js';
import { pCol } from '../lib/helpers.js';

// Pin marker — uses translate3d for GPU compositing.
// memo prevents re-render when nothing visual has changed.

function MarkerInner({ pin, selected, isMoving, isDeleting, onClick, x, y, currentUser }) {
  const isDeclined = pin.approval === 'declined';
  const headColor = isDeclined ? C.declined : pCol(pin, currentUser);
  const stemColor = isDeclined ? C.declined : (SC[pin.status] || '#6b7280');
  const isOther = pin.createdBy && pin.createdBy !== currentUser;
  const sz = (isMoving || selected || isDeleting) ? 28 : 22;

  const handle = e => { e.stopPropagation(); onClick(pin.id); };

  return (
    <div
      onClick={handle}
      onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClick(pin.id); }}
      style={{
        position: 'absolute', left: 0, top: 0,
        // translate3d forces GPU layer
        transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`,
        cursor: isDeleting ? 'not-allowed' : 'pointer',
        zIndex: 10,
        userSelect: 'none',
        touchAction: 'manipulation',
        willChange: 'transform',
      }}
    >
      <div style={{ padding: 12, margin: -12, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{
            background: isDeleting ? '#dc2626' : isMoving ? '#ea580c' : selected ? '#fff' : headColor,
            color: isDeleting || isMoving ? '#fff' : selected ? headColor : '#fff',
            border: '2px solid ' + (isDeleting ? '#dc2626' : isMoving ? '#ea580c' : headColor),
            borderRadius: '50%',
            width: sz, height: sz,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, fontFamily: 'DM Mono',
            boxShadow: selected
              ? '0 0 0 3px ' + headColor + '44,0 2px 10px rgba(0,0,0,0.35)'
              : '0 2px 8px rgba(0,0,0,0.35)',
            transition: 'all 0.15s',
            opacity: isOther && !selected && !isMoving && !isDeleting ? 0.55 : 1,
          }}>{isDeleting ? '✕' : pin.id}</div>
          <div style={{ width: 2, height: 10, background: stemColor, opacity: isOther ? 0.4 : 0.95 }}/>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: stemColor, boxShadow: '0 1px 4px ' + stemColor + '88', opacity: isOther ? 0.4 : 1 }}/>
        </div>
      </div>
    </div>
  );
}

// Strict comparison so we only re-render when something visual actually changed
export const Marker = memo(MarkerInner, (prev, next) => {
  return prev.pin === next.pin
    && prev.selected === next.selected
    && prev.isMoving === next.isMoving
    && prev.isDeleting === next.isDeleting
    && prev.x === next.x
    && prev.y === next.y
    && prev.currentUser === next.currentUser
    && prev.onClick === next.onClick;
});
