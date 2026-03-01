"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

interface ComparisonMetric {
  name: string;
  modelAValue: number;
  modelBValue: number;
  maxValue: number;
}

interface ModelComparisonProps {
  modelA: { name: string; provider: string; qualityScore: number };
  modelB: { name: string; provider: string; qualityScore: number };
  metrics: ComparisonMetric[];
}

function ModelOrb({
  position,
  color,
  size,
  label,
  provider,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  label: string;
  provider: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      glowRef.current.scale.setScalar(s);
      glowRef.current.position.y =
        meshRef.current?.position.y ?? position[1];
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Glow sphere */}
      <mesh ref={glowRef} position={[0, position[1], 0]}>
        <sphereGeometry args={[size * 1.5, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Main sphere */}
      <mesh ref={meshRef} position={[0, position[1], 0]}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Score label */}
      <Text
        position={[0, position[1] + size + 0.5, 0]}
        fontSize={0.3}
        color={color}
        anchorX="center"
        font={undefined}
      >
        {label}
      </Text>

      {/* Provider subtitle */}
      <Text
        position={[0, position[1] + size + 0.2, 0]}
        fontSize={0.15}
        color="#666"
        anchorX="center"
        font={undefined}
      >
        {provider}
      </Text>
    </group>
  );
}

function ComparisonBeam({
  metric,
  index,
  total,
}: {
  metric: ComparisonMetric;
  index: number;
  total: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const y = 2 - (index / (total - 1 || 1)) * 4;
  const normalizedA =
    metric.maxValue > 0 ? metric.modelAValue / metric.maxValue : 0;
  const normalizedB =
    metric.maxValue > 0 ? metric.modelBValue / metric.maxValue : 0;
  const winner = normalizedA >= normalizedB ? "A" : "B";
  const winnerColor = winner === "A" ? "#00d4aa" : "#f59e0b";

  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity =
        0.15 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.05;
    }
  });

  return (
    <group>
      {/* Connecting beam */}
      <mesh ref={meshRef} position={[0, y, 0]}>
        <boxGeometry args={[5, 0.02, 0.02]} />
        <meshBasicMaterial
          color={winnerColor}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Metric name */}
      <Text
        position={[0, y + 0.18, 0]}
        fontSize={0.12}
        color="#555"
        anchorX="center"
        font={undefined}
      >
        {metric.name}
      </Text>

      {/* Score A */}
      <Text
        position={[-2.8, y, 0]}
        fontSize={0.14}
        color={winner === "A" ? "#00d4aa" : "#555"}
        anchorX="right"
        font={undefined}
      >
        {metric.modelAValue.toFixed(1)}
      </Text>

      {/* Score B */}
      <Text
        position={[2.8, y, 0]}
        fontSize={0.14}
        color={winner === "B" ? "#f59e0b" : "#555"}
        anchorX="left"
        font={undefined}
      >
        {metric.modelBValue.toFixed(1)}
      </Text>
    </group>
  );
}

function ComparisonScene({ modelA, modelB, metrics }: ModelComparisonProps) {
  const groupRef = useRef<THREE.Group>(null);

  const sizeA = 0.4 + (modelA.qualityScore / 100) * 0.6;
  const sizeB = 0.4 + (modelB.qualityScore / 100) * 0.6;

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 6, 16]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[-4, 4, 4]} intensity={0.8} color="#00d4aa" />
      <pointLight position={[4, 4, 4]} intensity={0.8} color="#f59e0b" />

      <group ref={groupRef}>
        <ModelOrb
          position={[-3, 1, 0]}
          color="#00d4aa"
          size={sizeA}
          label={modelA.name}
          provider={modelA.provider}
        />
        <ModelOrb
          position={[3, 1, 0]}
          color="#f59e0b"
          size={sizeB}
          label={modelB.name}
          provider={modelB.provider}
        />

        {metrics.map((metric, i) => (
          <ComparisonBeam
            key={metric.name}
            metric={metric}
            index={i}
            total={metrics.length}
          />
        ))}
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        maxPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

export function ModelComparison3D({
  modelA,
  modelB,
  metrics,
}: ModelComparisonProps) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-border/30">
      <Canvas
        camera={{ position: [0, 1, 8], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <ComparisonScene modelA={modelA} modelB={modelB} metrics={metrics} />
      </Canvas>

      {/* Score badges */}
      <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
        <div className="rounded-lg border border-[#00d4aa]/30 bg-black/80 backdrop-blur-md px-3 py-2">
          <span className="text-lg font-bold text-[#00d4aa] tabular-nums">
            {modelA.qualityScore.toFixed(1)}
          </span>
        </div>
        <div className="rounded-lg border border-[#f59e0b]/30 bg-black/80 backdrop-blur-md px-3 py-2">
          <span className="text-lg font-bold text-[#f59e0b] tabular-nums">
            {modelB.qualityScore.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
