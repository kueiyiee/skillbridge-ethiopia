import React, { Suspense } from 'react';

const CareerParticleLayer = React.lazy(() => import('./CareerParticleLayer'));

export const CareerParticleField: React.FC = () => (
  <Suspense fallback={null}>
    <CareerParticleLayer />
  </Suspense>
);
