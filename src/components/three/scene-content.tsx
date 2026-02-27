"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 1000;
const CONNECTION_DISTANCE = 1.8;
const MAX_CONNECTIONS = 200;

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  // Generate particle positions
  const particles = useMemo(() => {
    const positions: number[] = [];
    const velocities: number[] = [];
    const phases: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Sphere-ish distribution with some randomness
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 4 + Math.random() * 6;

      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi) + (Math.random() - 0.5) * 2
      );

      // Slow drift velocities
      velocities.push(
        (Math.random() - 0.5) * 0.001,
        (Math.random() - 0.5) * 0.001,
        (Math.random() - 0.5) * 0.001
      );

      // Random phase for pulsing animation
      phases.push(Math.random() * Math.PI * 2);

      // Smaller, more refined particle sizes
      sizes.push(0.008 + Math.random() * 0.018);
    }

    return { positions, velocities, phases, sizes };
  }, []);

  // Pre-allocate connection line geometry
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_CONNECTIONS * 6); // 2 points * 3 coords per line
    const colors = new Float32Array(MAX_CONNECTIONS * 6); // 2 colors * 3 channels per line
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, []);

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // Dummy object for instanced mesh transforms
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  // Track mouse position
  const handlePointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    },
    []
  );

  // Set up mouse listener
  useMemo(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", handlePointerMove);
      return () => window.removeEventListener("mousemove", handlePointerMove);
    }
  }, [handlePointerMove]);

  useFrame((state, delta) => {
    if (!meshRef.current || !linesRef.current) return;

    const time = state.clock.elapsedTime;
    const posArray = particles.positions;
    const velArray = particles.velocities;
    const phaseArray = particles.phases;
    const sizeArray = particles.sizes;

    // Mouse parallax — smooth camera offset
    const targetX = mouseRef.current.x * 0.5;
    const targetY = mouseRef.current.y * 0.3;
    state.camera.position.x += (targetX - state.camera.position.x) * 0.02;
    state.camera.position.y += (targetY - state.camera.position.y) * 0.02;
    state.camera.lookAt(0, 0, 0);

    // Current positions for connection calculation
    const currentPositions: number[] = [];

    // Update particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Drift movement
      posArray[i3] += velArray[i3];
      posArray[i3 + 1] += velArray[i3 + 1];
      posArray[i3 + 2] += velArray[i3 + 2];

      // Soft boundary — pull back toward center if too far
      const dist = Math.sqrt(
        posArray[i3] ** 2 + posArray[i3 + 1] ** 2 + posArray[i3 + 2] ** 2
      );
      if (dist > 10) {
        const pull = 0.0005;
        posArray[i3] -= posArray[i3] * pull;
        posArray[i3 + 1] -= posArray[i3 + 1] * pull;
        posArray[i3 + 2] -= posArray[i3 + 2] * pull;
      }

      // Slow global rotation
      const angle = 0.0008;
      const x = posArray[i3];
      const z = posArray[i3 + 2];
      posArray[i3] = x * Math.cos(angle) - z * Math.sin(angle);
      posArray[i3 + 2] = x * Math.sin(angle) + z * Math.cos(angle);

      // Pulsing scale (breathing)
      const pulse = 0.8 + 0.4 * Math.sin(time * 0.8 + phaseArray[i]);
      const scale = sizeArray[i] * pulse;

      // Depth-based opacity — farther particles dimmer
      const depthFactor = Math.max(0.15, 1 - dist / 14);

      dummy.position.set(posArray[i3], posArray[i3 + 1], posArray[i3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color with depth-based alpha simulation (via brightness)
      const brightness = depthFactor * pulse;
      color.setRGB(0 * brightness, 0.83 * brightness, 0.67 * brightness);
      meshRef.current.setColorAt(i, color);

      currentPositions.push(posArray[i3], posArray[i3 + 1], posArray[i3 + 2]);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;

    // Update connections
    const linePositions = lineGeometry.attributes.position
      .array as Float32Array;
    const lineColors = lineGeometry.attributes.color.array as Float32Array;
    let lineIndex = 0;

    for (let i = 0; i < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; i++) {
      for (
        let j = i + 1;
        j < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS;
        j++
      ) {
        const i3 = i * 3;
        const j3 = j * 3;
        const dx = currentPositions[i3] - currentPositions[j3];
        const dy = currentPositions[i3 + 1] - currentPositions[j3 + 1];
        const dz = currentPositions[i3 + 2] - currentPositions[j3 + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
          const dist = Math.sqrt(distSq);
          const alpha = 1 - dist / CONNECTION_DISTANCE;
          const li = lineIndex * 6;

          linePositions[li] = currentPositions[i3];
          linePositions[li + 1] = currentPositions[i3 + 1];
          linePositions[li + 2] = currentPositions[i3 + 2];
          linePositions[li + 3] = currentPositions[j3];
          linePositions[li + 4] = currentPositions[j3 + 1];
          linePositions[li + 5] = currentPositions[j3 + 2];

          // Neon green lines with distance-based fade
          const a = alpha * 0.3;
          lineColors[li] = 0;
          lineColors[li + 1] = 0.83 * a;
          lineColors[li + 2] = 0.67 * a;
          lineColors[li + 3] = 0;
          lineColors[li + 4] = 0.83 * a;
          lineColors[li + 5] = 0.67 * a;

          lineIndex++;
        }
      }
    }

    lineGeometry.setDrawRange(0, lineIndex * 2);
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, PARTICLE_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <lineSegments
        ref={linesRef}
        geometry={lineGeometry}
        material={lineMaterial}
        frustumCulled={false}
      />
    </>
  );
}

// Central glow orb
function CentralGlow() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const scale = 1 + 0.15 * Math.sin(time * 0.5);
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshBasicMaterial
        color="#00d4aa"
        transparent
        opacity={0.03}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function SceneContent() {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 8, 18]} />
      <Particles />
      <CentralGlow />
    </>
  );
}
