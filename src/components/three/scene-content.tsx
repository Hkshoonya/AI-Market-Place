"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 1200;
const CONNECTION_DISTANCE = 1.7;
const CONNECTION_DISTANCE_SQ = CONNECTION_DISTANCE * CONNECTION_DISTANCE;
const MAX_CONNECTIONS = 180;

export interface SceneContentProps {
  connectionBudget: number;
  connectionRefreshStride: number;
  simulationStride: number;
  isScrolling: boolean;
}

interface ParticleBuffers {
  positions: Float32Array;
  velocities: Float32Array;
  phases: Float32Array;
  sizes: Float32Array;
  driftSeeds: Float32Array;
}

function generateParticleData(): ParticleBuffers {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);
  const phases = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const driftSeeds = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 4 + Math.random() * 8;
    const i3 = i * 3;

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi) + (Math.random() - 0.5) * 2;

    velocities[i3] = (Math.random() - 0.5) * 0.002;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.002;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.002;

    phases[i] = Math.random() * Math.PI * 2;
    sizes[i] = 0.008 + Math.random() * 0.018;

    driftSeeds[i3] = Math.random() * Math.PI * 2;
    driftSeeds[i3 + 1] = Math.random() * Math.PI * 2;
    driftSeeds[i3 + 2] = 0.3 + Math.random() * 0.7;
  }

  return { positions, velocities, phases, sizes, driftSeeds };
}

function createDynamicAttribute(size: number) {
  const attribute = new THREE.BufferAttribute(new Float32Array(size), 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  return attribute;
}

function Particles({
  connectionBudget,
  connectionRefreshStride,
  simulationStride,
  isScrolling,
}: SceneContentProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameIndexRef = useRef(0);
  const lastConnectionBudgetRef = useRef(connectionBudget);
  const particlesRef = useRef(generateParticleData());

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", createDynamicAttribute(MAX_CONNECTIONS * 6));
    geometry.setAttribute("color", createDynamicAttribute(MAX_CONNECTIONS * 6));
    geometry.setDrawRange(0, 0);
    return geometry;
  }, []);

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const handlePointerMove = useCallback((event: MouseEvent) => {
    mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", handlePointerMove);
  }, [handlePointerMove]);

  useFrame((state) => {
    if (!meshRef.current || !linesRef.current) return;

    frameIndexRef.current += 1;
    if (frameIndexRef.current % simulationStride !== 0) return;

    const time = state.clock.elapsedTime;
    const { positions, velocities, phases, sizes, driftSeeds } = particlesRef.current;
    const targetX = mouseRef.current.x * (isScrolling ? 0.42 : 0.5);
    const targetY = mouseRef.current.y * (isScrolling ? 0.24 : 0.3);
    const smoothing = isScrolling ? 0.03 : 0.02;

    state.camera.position.x += (targetX - state.camera.position.x) * smoothing;
    state.camera.position.y += (targetY - state.camera.position.y) * smoothing;
    state.camera.lookAt(0, 0, 0);

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const i3 = i * 3;
      const speed = driftSeeds[i3 + 2];
      const wanderX = Math.sin(time * 0.4 * speed + driftSeeds[i3]) * 0.0006;
      const wanderY = Math.sin(time * 0.35 * speed + driftSeeds[i3 + 1]) * 0.0006;
      const wanderZ = Math.cos(time * 0.45 * speed + driftSeeds[i3] + driftSeeds[i3 + 1]) * 0.0006;

      velocities[i3] += wanderX;
      velocities[i3 + 1] += wanderY;
      velocities[i3 + 2] += wanderZ;

      const vMag = Math.sqrt(velocities[i3] ** 2 + velocities[i3 + 1] ** 2 + velocities[i3 + 2] ** 2);
      if (vMag > 0.004) {
        const dampen = 0.004 / vMag;
        velocities[i3] *= dampen;
        velocities[i3 + 1] *= dampen;
        velocities[i3 + 2] *= dampen;
      }

      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      const distance = Math.sqrt(
        positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2
      );

      if (distance > 12) {
        const pull = 0.0008;
        positions[i3] -= positions[i3] * pull;
        positions[i3 + 1] -= positions[i3 + 1] * pull;
        positions[i3 + 2] -= positions[i3 + 2] * pull;
      }

      const pulse = 0.75 + 0.45 * Math.sin(time * 1.0 + phases[i]);
      const scale = sizes[i] * pulse;
      const depthFactor = Math.max(0.12, 1 - distance / 18);

      dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      const brightness = depthFactor * pulse;
      color.setRGB(0, 0.83 * brightness, 0.67 * brightness);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }

    const shouldRefreshConnections =
      frameIndexRef.current % connectionRefreshStride === 0 ||
      lastConnectionBudgetRef.current !== connectionBudget;

    if (!shouldRefreshConnections) {
      return;
    }

    lastConnectionBudgetRef.current = connectionBudget;

    const linePositions = lineGeometry.attributes.position.array as Float32Array;
    const lineColors = lineGeometry.attributes.color.array as Float32Array;
    let lineIndex = 0;
    const targetConnections = Math.min(connectionBudget, MAX_CONNECTIONS);

    for (let i = 0; i < PARTICLE_COUNT && lineIndex < targetConnections; i += 1) {
      const i3 = i * 3;

      for (let j = i + 1; j < PARTICLE_COUNT && lineIndex < targetConnections; j += 1) {
        const j3 = j * 3;
        const dx = positions[i3] - positions[j3];
        const dy = positions[i3 + 1] - positions[j3 + 1];
        const dz = positions[i3 + 2] - positions[j3 + 2];
        const distanceSq = dx * dx + dy * dy + dz * dz;

        if (distanceSq >= CONNECTION_DISTANCE_SQ) {
          continue;
        }

        const distance = Math.sqrt(distanceSq);
        const proximity = 1 - distance / CONNECTION_DISTANCE;
        const shimmer = 0.6 + 0.4 * Math.sin(time * 1.5 + (i * 7 + j * 13) * 0.1);
        const alpha = proximity * proximity * shimmer * 0.35;
        const li = lineIndex * 6;

        linePositions[li] = positions[i3];
        linePositions[li + 1] = positions[i3 + 1];
        linePositions[li + 2] = positions[i3 + 2];
        linePositions[li + 3] = positions[j3];
        linePositions[li + 4] = positions[j3 + 1];
        linePositions[li + 5] = positions[j3 + 2];

        lineColors[li] = 0;
        lineColors[li + 1] = 0.83 * alpha;
        lineColors[li + 2] = 0.67 * alpha;
        lineColors[li + 3] = 0;
        lineColors[li + 4] = 0.83 * alpha;
        lineColors[li + 5] = 0.67 * alpha;

        lineIndex += 1;
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
        <sphereGeometry args={[1, 6, 6]} />
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

function CentralGlow() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const scale = 1 + 0.25 * Math.sin(time * 0.8);
    meshRef.current.scale.setScalar(scale);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshBasicMaterial
        color="#00d4aa"
        transparent
        opacity={0.08}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function SceneContent({
  connectionBudget,
  connectionRefreshStride,
  simulationStride,
  isScrolling,
}: SceneContentProps) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 10, 22]} />
      <Particles
        connectionBudget={connectionBudget}
        connectionRefreshStride={connectionRefreshStride}
        simulationStride={simulationStride}
        isScrolling={isScrolling}
      />
      <CentralGlow />
    </>
  );
}
