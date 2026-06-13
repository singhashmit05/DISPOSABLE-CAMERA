import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom, Noise, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

// 1. Particle Field (Dust Motes)
const ParticleField = () => {
  const count = 300;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;     // x
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80; // z (depth)
    }
    return pos;
  }, [count]);

  const pointsRef = useRef();
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (pointsRef.current) {
      // Drift slowly
      pointsRef.current.position.y = Math.sin(time * 0.1) * 2;
      pointsRef.current.position.x = Math.cos(time * 0.05) * 1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color="#c9a96e" transparent opacity={0.4} sizeAttenuation />
    </points>
  );
};

// 2. Polaroids in a Helix
const PolaroidHelix = () => {
  const count = 12;
  const polaroids = useMemo(() => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const angle = t * Math.PI * 6; // 3 full turns
      const radius = 8 + Math.random() * 3;
      const x = Math.cos(angle) * radius;
      const y = (Math.random() - 0.5) * 15;
      // Z from +20 down to -60
      const z = 20 - t * 80;
      items.push({ x, y, z, index: i });
    }
    return items;
  }, [count]);

  return (
    <group>
      {polaroids.map((p) => (
        <Polaroid key={p.index} position={[p.x, p.y, p.z]} index={p.index} />
      ))}
    </group>
  );
};

const Polaroid = ({ position, index }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (meshRef.current) {
      // Gentle bobbing and rotating
      meshRef.current.position.y = position[1] + Math.sin(time * 0.3 + index) * 0.5;
      meshRef.current.rotation.y = Math.sin(time * 0.3 + index * 0.7) * 0.1;
      meshRef.current.rotation.z = Math.sin(time * 0.2 + index) * 0.05;
      
      // Hover effect: lift toward camera
      if (hovered) {
        meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, position[2] + 4, 0.05);
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0.1, 0.05);
      } else {
        meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, position[2], 0.05);
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.05);
      }
    }
  });

  return (
    <group ref={meshRef} position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Polaroid Frame */}
      <mesh>
        <planeGeometry args={[3, 3.6]} />
        <meshStandardMaterial color={hovered ? "#ffffff" : "#dddddd"} roughness={0.6} />
      </mesh>
      {/* Inner Photo Area */}
      <mesh position={[0, 0.3, 0.01]}>
        <planeGeometry args={[2.7, 2.7]} />
        <meshStandardMaterial color="#1a1410" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Warm glow on hover */}
      {hovered && <pointLight color="#c9a96e" intensity={2} distance={8} position={[0, 0, 1]} />}
    </group>
  );
};

// 3. Light Leaks
const LightLeaks = () => {
  const ref1 = useRef();
  const ref2 = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (ref1.current) ref1.current.material.opacity = 0.1 + Math.sin(time * 0.8) * 0.2;
    if (ref2.current) ref2.current.material.opacity = 0.1 + Math.cos(time * 0.5) * 0.2;
  });

  return (
    <group>
      <mesh position={[-15, 5, -10]} ref={ref1}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#c0392b" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[15, -5, -20]} ref={ref2}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#d35400" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

// 4. Main Scene Component
export default function Scene3D({ scrollData }) {
  const safelightRef = useRef();

  useFrame((state) => {
    // Oscillate safelight
    if (safelightRef.current) {
      safelightRef.current.position.x = -15 + Math.sin(state.clock.elapsedTime * 0.2) * 5;
    }

    // Sync camera position to GSAP scrollData
    if (scrollData && scrollData.current) {
      // Parallax effect: add a slight mouse offset
      const pointerX = state.pointer.x * 2;
      const pointerY = state.pointer.y * 2;
      
      state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, scrollData.current.z, 0.1);
      state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, scrollData.current.y + pointerY, 0.1);
      state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, pointerX, 0.1);
      
      state.camera.lookAt(0, scrollData.current.y, scrollData.current.z - 20);
    }
  });

  return (
    <>
      <color attach="background" args={['#0a0806']} />
      <fogExp2 attach="fog" args={['#1a0a06', 0.015]} />
      
      {/* Lighting */}
      <ambientLight color="#2a1a0a" intensity={0.5} />
      <pointLight color="#c9a96e" intensity={1.5} position={[0, 10, 5]} />
      
      {/* Red Safelight */}
      <spotLight 
        ref={safelightRef}
        color="#8b0000" 
        intensity={5} 
        angle={0.6} 
        penumbra={1} 
        position={[-15, 15, -10]} 
        castShadow
      />

      <ParticleField />
      <PolaroidHelix />
      <LightLeaks />

      {/* Post-Processing Optimized */}
      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.3} mipmapBlur intensity={1.5} />
        <Noise opacity={0.35} blendFunction={BlendFunction.OVERLAY} />
        <Vignette eskil={false} offset={0.3} darkness={0.9} />
      </EffectComposer>
    </>
  );
}
