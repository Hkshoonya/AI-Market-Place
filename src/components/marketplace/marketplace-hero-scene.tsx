"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import type { Group } from "three";

function HeroTokens() {
  const leftRef = useRef<Group>(null);
  const rightRef = useRef<Group>(null);
  const blocksRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (leftRef.current) {
      leftRef.current.rotation.z = Math.sin(t * 0.8) * 0.08;
      leftRef.current.position.y = Math.sin(t * 1.2) * 0.08;
    }

    if (rightRef.current) {
      rightRef.current.rotation.z = -Math.sin(t * 0.8) * 0.08;
      rightRef.current.position.y = Math.cos(t * 1.2) * 0.08;
    }

    if (blocksRef.current) {
      blocksRef.current.rotation.y = t * 0.25;
      blocksRef.current.position.y = Math.sin(t * 0.7) * 0.06;
    }
  });

  const blockPositions = useMemo(
    () => [
      [-0.7, 0.4, 0],
      [0, 0, 0.1],
      [0.7, -0.4, 0],
    ],
    []
  );

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />

      <group ref={leftRef} position={[-1.8, 0, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color="#00d4aa" emissive="#00d4aa" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -0.25, 0]}>
          <capsuleGeometry args={[0.26, 0.9, 8, 16]} />
          <meshStandardMaterial color="#0f1f1b" emissive="#00d4aa" emissiveIntensity={0.15} />
        </mesh>
      </group>

      <group ref={rightRef} position={[1.8, 0, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#7cf0d8" emissive="#7cf0d8" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.72, 1.05, 0.4]} />
          <meshStandardMaterial color="#091311" emissive="#00d4aa" emissiveIntensity={0.12} />
        </mesh>
      </group>

      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 2.3, 24]} />
        <meshStandardMaterial color="#d7fff6" emissive="#d7fff6" emissiveIntensity={0.45} />
      </mesh>

      <group ref={blocksRef}>
        {blockPositions.map((position, index) => (
          <mesh key={index} position={position as [number, number, number]}>
            <boxGeometry args={[0.28, 0.28, 0.28]} />
            <meshStandardMaterial
              color={index === 1 ? "#7cf0d8" : "#17312b"}
              emissive="#00d4aa"
              emissiveIntensity={index === 1 ? 0.3 : 0.12}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function MarketplaceHeroScene() {
  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );

  if (prefersReducedMotion) {
    return (
      <div
        data-testid="marketplace-hero-scene"
        className="h-[260px] rounded-[28px] border border-border/50 bg-[radial-gradient(circle_at_center,_rgba(0,212,170,0.20),_rgba(0,0,0,0)_70%)]"
      />
    );
  }

  return (
    <div
      data-testid="marketplace-hero-scene"
      className="h-[260px] overflow-hidden rounded-[28px] border border-border/50 bg-[radial-gradient(circle_at_center,_rgba(0,212,170,0.14),_rgba(0,0,0,0)_72%)]"
    >
      <Canvas camera={{ position: [0, 0, 6], fov: 42 }} dpr={[1, 1.5]}>
        <HeroTokens />
      </Canvas>
    </div>
  );
}
