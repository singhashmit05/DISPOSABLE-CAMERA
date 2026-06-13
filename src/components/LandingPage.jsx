import React, { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene3D from './Scene3D';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage({ onEnter }) {
  // This mutable object will be driven by GSAP on scroll.
  const scrollData = useRef({ z: 20, y: 0 });

  useEffect(() => {
    // We create a timeline that maps the total scroll distance to the camera's path
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: ".scroll-container",
          start: "top top",
          end: "bottom bottom",
          scrub: 1.5,
        }
      });

      // Map out the camera journey across the 4 sections after the hero
      // We use proportional durations to evenly space the journey over the scroll height
      tl.to(scrollData.current, { z: 5, y: -2, ease: "none", duration: 1 })
        .to(scrollData.current, { z: -10, y: 1, ease: "none", duration: 1 })
        .to(scrollData.current, { z: -25, y: 0, ease: "none", duration: 1 })
        .to(scrollData.current, { z: -40, y: 0, ease: "none", duration: 1 });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="relative w-full cursor-crosshair-custom bg-[#0a0806] text-[#F5F0E8] overflow-x-hidden scroll-container" style={{ height: '500vh' }}>
      
      {/* 3D Canvas Background (Fixed) */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <Canvas dpr={[1, 1.5]} gl={{ antialias: false }}>
          <Scene3D scrollData={scrollData} />
        </Canvas>
      </div>

      {/* HTML Overlay Sections */}
      <div className="relative z-10 w-full pointer-events-none">
        
        {/* Film Strip Top */}
        <div className="fixed top-0 left-0 right-0 z-50 film-strip-border" />

        {/* Section 1: Hero */}
        <section className="h-screen flex flex-col items-center justify-center text-center p-6 relative">
          <h1 className="font-handwritten text-7xl md:text-[96px] tracking-tight mb-2 text-[#F5F0E8] drop-shadow-md">
            FLASHBACK
          </h1>
          <p className="font-mono text-xs md:text-[14px] uppercase tracking-[0.2em] text-[#F5F0E8]/45 font-bold mb-12">
            Every shot matters. None of them are perfect.
          </p>
          <div className="flex gap-4 pointer-events-auto">
             <button onClick={onEnter} className="font-mono text-[13px] uppercase tracking-wider px-8 py-4 rounded-full bg-[#C0392B] text-white hover:shadow-[0_0_30px_rgba(192,57,43,0.5)] transition-all">
               Start Shooting
             </button>
          </div>
          <div className="absolute bottom-12 animate-bounce">
            <span className="text-[#F5F0E8]/50 font-mono text-xs uppercase tracking-widest">↓ scroll</span>
          </div>
        </section>

        {/* Section 2: The Roll */}
        <section className="h-screen flex items-center justify-start p-6 md:p-24 relative pointer-events-none">
          <div className="max-w-lg bg-[#1A1410]/60 p-8 border border-[#c9a96e]/30 backdrop-blur-sm rounded-lg pointer-events-auto transform hover:scale-[1.02] transition-transform">
            <h2 className="font-handwritten text-4xl text-[#c9a96e] mb-4">Every Frame Counts</h2>
            <p className="font-mono text-sm text-[#F5F0E8]/80 leading-relaxed mb-6">
              Unlike digital cameras where you take 100 photos just to keep one, Flashback limits you to 27 shots. You can't see the photo right away. You have to wait.
            </p>
            <div className="flex gap-4 opacity-80 pointer-events-none">
              <img src="/sample.png" className="w-32 h-32 object-cover border-4 border-white rotate-[-6deg] shadow-xl filter sepia-[0.3]" alt="snapshot" />
              <img src="/sample.png" className="w-32 h-32 object-cover border-4 border-white rotate-[4deg] shadow-xl mt-4 filter sepia-[0.3]" alt="snapshot" />
            </div>
          </div>
        </section>

        {/* Section 3: Features */}
        <section className="h-screen flex items-center justify-center p-6 relative">
          <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#1A1410]/80 p-8 border border-[#c9a96e]/30 backdrop-blur-md rounded-lg pointer-events-auto transform hover:scale-105 transition-transform">
              <h3 className="font-mono text-lg font-bold text-[#c9a96e] mb-4 flex items-center gap-2">
                <span>📸</span> Shoot Instantly
              </h3>
              <p className="text-[#F5F0E8]/80 text-sm leading-relaxed">No signup. Just aim and click. The camera is always ready for the moment.</p>
            </div>
            <div className="bg-[#1A1410]/80 p-8 border border-[#c9a96e]/30 backdrop-blur-md rounded-lg pointer-events-auto transform hover:scale-105 transition-transform md:translate-y-12">
              <h3 className="font-mono text-lg font-bold text-[#c9a96e] mb-4 flex items-center gap-2">
                <span>🎞️</span> Shared Gallery
              </h3>
              <p className="text-[#F5F0E8]/80 text-sm leading-relaxed">Every photo goes to the same roll. Experience the memories together.</p>
            </div>
            <div className="bg-[#1A1410]/80 p-8 border border-[#c9a96e]/30 backdrop-blur-md rounded-lg pointer-events-auto transform hover:scale-105 transition-transform">
              <h3 className="font-mono text-lg font-bold text-[#c9a96e] mb-4 flex items-center gap-2">
                <span>✨</span> Film Aesthetic
              </h3>
              <p className="text-[#F5F0E8]/80 text-sm leading-relaxed">Grain, warmth, and unpredictable light leaks built into every frame.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Gallery Preview */}
        <section className="h-screen flex items-center justify-end p-6 md:p-24 relative pointer-events-none">
          <div className="max-w-lg bg-[#1A1410]/60 p-8 border border-[#c9a96e]/30 backdrop-blur-sm rounded-lg text-right pointer-events-auto transform hover:scale-[1.02] transition-transform">
            <h2 className="font-handwritten text-4xl text-[#c9a96e] mb-4">A Shared Perspective</h2>
            <p className="font-mono text-sm text-[#F5F0E8]/80 leading-relaxed mb-6">
              When the roll is finished, everyone who contributed gets to see the developed gallery. The raw, unfiltered memories, all in one place.
            </p>
            <div className="flex justify-end gap-4 opacity-80 pointer-events-none">
              <img src="/sample.png" className="w-40 h-32 object-cover border-4 border-white rotate-[2deg] shadow-xl filter sepia-[0.2] contrast-125" alt="snapshot" />
            </div>
          </div>
        </section>

        {/* Section 5: CTA */}
        <section className="h-screen flex flex-col items-center justify-center text-center p-6 relative">
          <p className="font-handwritten text-4xl md:text-5xl text-[#c9a96e] mb-8 max-w-2xl drop-shadow-md">
            27 shots. No retakes. No filters.<br/>Just real moments.
          </p>
          <button onClick={onEnter} className="pointer-events-auto font-mono text-[13px] uppercase tracking-wider px-10 py-5 rounded-full bg-[#C0392B] text-white hover:shadow-[0_0_30px_rgba(192,57,43,0.5)] transition-all transform hover:-translate-y-1">
            → Open the Camera
          </button>
          <div className="absolute bottom-16 font-mono text-[10px] uppercase tracking-widest text-[#F5F0E8]/40 pointer-events-auto">
            DEVELOPED BY SINGH
          </div>
        </section>

        {/* Film Strip Bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 film-strip-border" />
      </div>
    </div>
  );
}
