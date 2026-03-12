"use client";

import { useRef, useMemo, useEffect, useState, useSyncExternalStore } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 150;

// Module-level function: Math.random() calls here are outside any render/hook context
function generateAmbientParticles() {
  const positions: number[] = [];
  const velocities: number[] = [];
  const phases: number[] = [];
  const sizes: number[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Wide spread, mostly behind content area
    positions.push(
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 20,
      -5 - Math.random() * 15
    );

    velocities.push(
      (Math.random() - 0.5) * 0.003,
      (Math.random() - 0.5) * 0.002,
      (Math.random() - 0.5) * 0.001
    );

    phases.push(Math.random() * Math.PI * 2);
    sizes.push(0.01 + Math.random() * 0.025);
  }

  return { positions, velocities, phases, sizes };
}

function AmbientParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // useRef holds mutable particle data; generateAmbientParticles() runs outside render
  const particlesRef = useRef(generateAmbientParticles());

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;
    const particles = particlesRef.current;
    const posArray = particles.positions;
    const velArray = particles.velocities;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Gentle drift
      posArray[i3] += velArray[i3];
      posArray[i3 + 1] += velArray[i3 + 1];
      posArray[i3 + 2] += velArray[i3 + 2];

      // Wrap around boundaries
      if (Math.abs(posArray[i3]) > 15) posArray[i3] *= -0.95;
      if (Math.abs(posArray[i3 + 1]) > 10) posArray[i3 + 1] *= -0.95;

      // Breathing pulse
      const pulse =
        0.6 + 0.4 * Math.sin(time * 0.4 + particles.phases[i]);
      const scale = particles.sizes[i] * pulse;

      dummy.position.set(posArray[i3], posArray[i3 + 1], posArray[i3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Very subtle neon color
      const brightness = pulse * 0.3;
      color.setRGB(0, 0.83 * brightness, 0.67 * brightness);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function AmbientSceneContent() {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 5, 25]} />
      <AmbientParticles />
    </>
  );
}

export function AmbientScene() {
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pause rendering when not visible (performance)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Reduce motion preference — useSyncExternalStore returns false on server (no hydration mismatch)
  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );

  if (prefersReducedMotion) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.4 }}
    >
      {isVisible && (
        <Canvas
          camera={{ position: [0, 0, 8], fov: 60 }}
          dpr={[1, 1]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "low-power",
          }}
          frameloop="always" // Required: continuous particle animation uses useFrame
          style={{ background: "transparent" }}
        >
          <AmbientSceneContent />
        </Canvas>
      )}
    </div>
  );
}
