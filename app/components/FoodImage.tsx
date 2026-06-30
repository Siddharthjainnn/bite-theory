'use client';

import { useState } from 'react';
import { imgUrl } from '../lib/bite';

/** Image that gracefully falls back to a food emoji if the src fails. */
export default function FoodImage({
  src,
  alt,
  emoji,
  className,
}: {
  src: string;
  alt: string;
  emoji: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={`food-emoji ${className || ''}`}>{emoji}</span>;
  }
  return (
    <img
      src={imgUrl(src)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
