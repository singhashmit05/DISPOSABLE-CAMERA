import React from 'react';

export default function GrainOverlay() {
  return (
    <>
      <style>{`
        @keyframes grain-move {
          0%, 100% { transform: translate(0, 0) scale(1); }
          10% { transform: translate(-1%, -1%) scale(1.02); }
          20% { transform: translate(-2%, 1%) scale(0.98); }
          30% { transform: translate(1%, -2%) scale(1.01); }
          40% { transform: translate(-1%, 3%) scale(0.99); }
          50% { transform: translate(-2%, 1%) scale(1.02); }
          60% { transform: translate(1%, 2%) scale(0.98); }
          70% { transform: translate(3%, -1%) scale(1.01); }
          80% { transform: translate(2%, 1%) scale(1.03); }
          90% { transform: translate(-3%, -2%) scale(0.97); }
        }
        .grain-layer {
          position: fixed;
          top: -10%;
          left: -10%;
          width: 120%;
          height: 120%;
          opacity: 0.14;
          pointer-events: none;
          z-index: 9999;
          animation: grain-move 0.4s steps(2) infinite;
        }
      `}</style>
      <div className="grain-layer" aria-hidden="true">
        <svg className="w-full h-full">
          <filter id="film-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.7"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.14 0" />
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
          <rect width="100%" height="100%" filter="url(#film-grain)" />
        </svg>
      </div>
    </>
  );
}
