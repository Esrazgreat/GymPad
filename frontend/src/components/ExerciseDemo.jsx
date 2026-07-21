import { Suspense, lazy, useState } from 'react';
import { getDisplay } from '../lib/exercises.js';

/**
 * Exercise demonstration: GIF if one is licensed, procedural 3D otherwise.
 *
 * Demo3D is lazy-loaded so Three.js (~600KB) never enters the initial bundle —
 * it is only fetched when a user actually opens a workout. On a metered mobile
 * connection that difference is the whole first-load experience.
 */

const Demo3D = lazy(() => import('./Demo3D.jsx'));

function Placeholder({ height }) {
  return <div className="gp-skeleton w-full" style={{ height }} aria-hidden="true" />;
}

export default function ExerciseDemo({ exerciseId, height = 280, speed = 1 }) {
  const display = getDisplay(exerciseId);
  const [gifFailed, setGifFailed] = useState(false);

  // A licensed GIF is the cheapest, clearest demo — prefer it when present, and
  // fall through to 3D if the URL 404s so the user is never left with a gap.
  if (display.gifUrl && !gifFailed) {
    return (
      <img
        src={display.gifUrl}
        alt={display.name.en}
        style={{ height }}
        className="w-full object-contain rounded-card"
        loading="lazy"
        onError={() => setGifFailed(true)}
      />
    );
  }

  return (
    <Suspense fallback={<Placeholder height={height} />}>
      <Demo3D animation={display.threeJsAnim} height={height} speed={speed} />
    </Suspense>
  );
}
