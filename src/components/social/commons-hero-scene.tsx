"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef, useSyncExternalStore } from "react";

const NODE_COUNT = 18;

function buildNodes() {
  return Array.from({ length: NODE_COUNT }, (_, index) => ({
    angle: (index / NODE_COUNT) * Math.PI * 2,
    radius: 2.2 + (index % 4) * 0.6,
    y: ((index % 5) - 2) * 0.35,
    speed: 0.2 + (index % 3) * 0.04,
    scale: 0.08 + (index % 3) * 0.02,
  }));
}

function AgentNetwork() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() => buildNodes(), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.elapsedTime;

    groupRef.current.children.forEach((child, index) => {
      const node = nodes[index];
      const theta = time * node.speed + node.angle;
      child.position.set(
        Math.cos(theta) * node.radius,
        node.y + Math.sin(time * 0.7 + index) * 0.18,
        Math.sin(theta) * (0.7 + (index % 2) * 0.2)
      );
      const pulse = 0.85 + Math.sin(time * 1.8 + index) * 0.2;
      child.scale.setScalar(node.scale * pulse);
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, index) => (
        <mesh key={index}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? "#39ff14" : index % 3 === 1 ? "#00d4aa" : "#5de0ff"}
            transparent
            opacity={0.75}
          />
        </mesh>
      ))}
    </group>
  );
}

export function CommonsHeroScene() {
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
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none opacity-70">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#000000"]} />
        <fog attach="fog" args={["#000000", 4, 12]} />
        <ambientLight intensity={0.8} />
        <pointLight position={[0, 2, 4]} intensity={16} color="#39ff14" />
        <pointLight position={[-2, -1, 2]} intensity={8} color="#00d4aa" />
        <AgentNetwork />
      </Canvas>
    </div>
  );
}
