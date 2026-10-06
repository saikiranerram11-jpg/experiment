import { useEffect, useRef } from 'react';
import logo from '../assets/images/logo.png';

export default function PersistentLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let anchorPos: { x: number; y: number } | null = null;
    let lastScrollY = window.scrollY;
    let currentTiltZ = 0;
    let currentTiltX = 0;
    let decayTimerId: number;

    const measureAnchor = () => {
      const anchor = document.getElementById('hero-logo-anchor');
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      // Calculate absolute document position of the anchor center
      const docTop = rect.top + window.scrollY;
      const docLeft = rect.left + window.scrollX;
      anchorPos = {
        x: docLeft + rect.width / 2,
        y: docTop + rect.height / 2,
      };
    };

    const updatePosition = () => {
      if (!containerRef.current) return;

      if (!anchorPos) {
        measureAnchor();
        if (!anchorPos) return;
      }

      const scrollY = window.scrollY;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Scroll velocity for subtle physical inertia tilt
      const deltaY = scrollY - lastScrollY;
      lastScrollY = scrollY;
      const targetTiltZ = Math.max(Math.min(deltaY * 0.04, 3), -3);
      const targetTiltX = Math.max(Math.min(deltaY * 0.03, 2), -2);
      currentTiltZ += (targetTiltZ - currentTiltZ) * 0.35;
      currentTiltX += (targetTiltX - currentTiltX) * 0.35;

      // Target center of viewport
      const targetCenterX = viewportW / 2;
      const targetCenterY = viewportH / 2;

      // Initial anchor position in viewport coordinates
      const startX = anchorPos.x;
      const startY = anchorPos.y;

      // Slow, smooth, cinematic scroll distance required for full centering (900px - 1100px)
      const scrollDistance = Math.max(viewportH * 1.15, 880);
      const rawProgress = Math.min(Math.max(scrollY / scrollDistance, 0), 1);

      // Smoothstep easing (f'(0) = 0, f'(1) = 0) for organic start and finish
      const ease = rawProgress * rawProgress * (3 - 2 * rawProgress);

      // Interpolated viewport position
      const currentX = startX + (targetCenterX - startX) * ease;
      const currentY = startY + (targetCenterY - startY) * ease;

      // Gentle scale enhancement at center (+10% on desktop, controlled for mobile)
      const maxScaleBoost = viewportW < 640 ? 0.05 : 0.12;
      const scale = 1.0 + maxScaleBoost * ease;

      // Apply GPU-accelerated transform with aerodynamic inertia tilt
      containerRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${scale}) rotateZ(${currentTiltZ.toFixed(2)}deg) rotateX(${currentTiltX.toFixed(2)}deg)`;

      // Subtle light & saturation enhancement (Requirement 6)
      const brightness = 1.0 + 0.15 * ease;
      const saturation = 1.35 + 0.20 * ease;
      const dropShadowSpread = 14 + 16 * ease;
      const amberGlowAlpha = 0.25 * ease;

      if (imageRef.current) {
        imageRef.current.style.filter = `saturate(${saturation}) contrast(1.15) brightness(${brightness}) drop-shadow(0 ${dropShadowSpread}px ${dropShadowSpread * 2}px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 ${26 * ease}px rgba(245, 158, 11, ${amberGlowAlpha}))`;
      }

      // Ambient glow expansion
      if (glowRef.current) {
        glowRef.current.style.opacity = `${0.55 + 0.35 * ease}`;
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${0.92 + 0.28 * ease})`;
      }

      // Smoothly level out tilt when scroll pauses
      clearTimeout(decayTimerId);
      decayTimerId = window.setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${scale}) rotateZ(0deg) rotateX(0deg)`;
        }
        currentTiltZ = 0;
        currentTiltX = 0;
      }, 100);
    };

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    const handleResize = () => {
      measureAnchor();
      updatePosition();
    };

    // Initial measurement and positioning
    measureAnchor();
    updatePosition();

    // Re-measure after initial image/layout stabilizes
    const timerId = setTimeout(() => {
      measureAnchor();
      updatePosition();
    }, 100);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('load', handleResize);

    return () => {
      clearTimeout(timerId);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('load', handleResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[5] will-change-transform"
      ref={containerRef}
      style={{
        transform: 'translate3d(75vw, 50vh, 0) translate(-50%, -50%)',
      }}
    >
      <div className="hero-logo-wrapper">
        {/* Ambient 3D glow aura */}
        <div ref={glowRef} className="hero-logo-glow" />

        {/* 3D floating and tilting stage */}
        <div className="hero-logo-stage">
          <img
            ref={imageRef}
            src={logo}
            alt="Alance decentralized protocol 3D visual"
            className="hero-logo"
            loading="eager"
          />
        </div>

        {/* Dynamic 3D contact shadow underneath */}
        <div className="hero-logo-shadow" />
      </div>
    </div>
  );
}
