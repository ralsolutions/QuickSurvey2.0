import { useState, useEffect, memo } from 'react';
import { getPhotoUrl } from '../lib/db.js';

// Async-loading photo component. Pass either a photoId (preferred) or a direct src.
// Loads the blob URL from IndexedDB on mount, shows a placeholder while loading.

function PhotoImgInner({ photoId, src, alt, style, onClick }) {
  const [url, setUrl] = useState(src || null);
  const [loading, setLoading] = useState(!src);

  useEffect(() => {
    let cancelled = false;
    if (src) { setUrl(src); setLoading(false); return; }
    if (!photoId) { setUrl(null); setLoading(false); return; }
    setLoading(true);
    getPhotoUrl(photoId).then(u => {
      if (!cancelled) { setUrl(u); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [photoId, src]);

  if (loading || !url) {
    return (
      <div style={{
        width: '100%', height: '100%', background: '#e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: '#9ca3af', fontFamily: 'DM Mono',
        ...style,
      }} onClick={onClick}>
        {loading ? '⋯' : '?'}
      </div>
    );
  }

  return <img src={url} style={style} alt={alt || ''} onClick={onClick} loading="lazy" decoding="async" draggable={false}/>;
}

export const PhotoImg = memo(PhotoImgInner);
