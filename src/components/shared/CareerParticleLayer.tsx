import React, { useEffect, useMemo, useState } from 'react';
import { loadSlim } from '@tsparticles/slim';
import { Particles, ParticlesProvider } from '@tsparticles/react';
import type { Engine, ISourceOptions } from '@tsparticles/engine';
import { useTheme } from '@/src/app/providers/ThemeContext';

const initializeParticles = (engine: Engine) => loadSlim(engine);

const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
};

const CareerParticles: React.FC = () => {
  const { isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  );

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setMobile(viewport.matches);
    updateViewport();
    viewport.addEventListener('change', updateViewport);
    return () => viewport.removeEventListener('change', updateViewport);
  }, []);

  const options = useMemo<ISourceOptions>(() => {
    const color = isDark ? '#a5f3fc' : '#0e7490';
    return {
      fullScreen: { enable: false },
      detectRetina: false,
      fpsLimit: 30,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
      particles: {
        color: { value: color },
        links: { enable: true, distance: mobile ? 110 : 130, color, opacity: 0.075, width: 0.6 },
        move: { enable: !reducedMotion, speed: 0.12, outModes: { default: 'out' } },
        number: { value: mobile ? 7 : 15, density: { enable: true, width: 1000, height: 600 } },
        opacity: { value: 0.22 },
        size: { value: { min: 0.6, max: 1.2 } },
      },
    };
  }, [isDark, mobile, reducedMotion]);

  return (
    <ParticlesProvider init={initializeParticles}>
      <Particles
        id="career-particles"
        options={options}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />
    </ParticlesProvider>
  );
};

export default CareerParticles;
