"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";

interface BenchmarkScore {
  benchmark: string;
  score: number;
  maxScore: number;
}

interface BenchmarkRadar3DProps {
  scores: BenchmarkScore[];
  modelName?: string;
  comparisonScores?: BenchmarkScore[];
  comparisonName?: string;
}

function RadarWeb({ scores, color = "#00d4aa", opacity = 0.3 }: {
  scores: BenchmarkScore[];
  color?: string;
  opacity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const n = scores.length;
    if (n < 3) return new THREE.BufferGeometry();

    const vertices: number[] = [0, 0, 0]; // Center point
    const indices: number[] = [];

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const normalized = scores[i].maxScore > 0
        ? (scores[i].score / scores[i].maxScore)
        : 0;
      const radius = Math.max(normalized, 0.05) * 2.5;
      vertices.push(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      );

      // Triangle fan from center
      if (i > 0) {
        indices.push(0, i, i + 1);
      }
    }
    // Close the fan
    indices.push(0, n, 1);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [scores]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function RadarLines({ scores }: { scores: BenchmarkScore[] }) {
  const n = scores.length;

  // Axis lines from center to outer edge
  const axisLines = useMemo(() => {
    const lines: [number, number, number][][] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * 2.8;
      const y = Math.sin(angle) * 2.8;
      lines.push([[0, 0, 0], [x, y, 0]]);
    }
    return lines;
  }, [n]);

  // Concentric rings
  const rings = useMemo(() => {
    const ringLines: [number, number, number][][] = [];
    for (let r = 0.5; r <= 2.5; r += 0.5) {
      const ringPoints: [number, number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        ringPoints.push([Math.cos(angle) * r, Math.sin(angle) * r, 0]);
      }
      ringLines.push(ringPoints);
    }
    return ringLines;
  }, [n]);

  return (
    <>
      {/* Axis lines */}
      {axisLines.map((points, i) => (
        <Line
          key={`axis-${i}`}
          points={points}
          color="#222222"
          transparent
          opacity={0.5}
          lineWidth={1}
        />
      ))}

      {/* Concentric rings */}
      {rings.map((points, i) => (
        <Line
          key={`ring-${i}`}
          points={points}
          color="#1a1a1a"
          transparent
          opacity={0.4}
          lineWidth={1}
        />
      ))}
    </>
  );
}

function RadarLabels({ scores }: { scores: BenchmarkScore[] }) {
  const n = scores.length;
  return (
    <>
      {scores.map((s, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const labelRadius = 3.2;
        return (
          <Text
            key={s.benchmark}
            position={[Math.cos(angle) * labelRadius, Math.sin(angle) * labelRadius, 0]}
            fontSize={0.18}
            color="#888"
            anchorX="center"
            anchorY="middle"
          >
            {s.benchmark.length > 10 ? s.benchmark.slice(0, 10) + "\u2026" : s.benchmark}
          </Text>
        );
      })}
    </>
  );
}

function ScorePoints({ scores, color = "#00d4aa" }: { scores: BenchmarkScore[]; color?: string }) {
  const n = scores.length;

  return (
    <>
      {scores.map((s, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const normalized = s.maxScore > 0 ? s.score / s.maxScore : 0;
        const radius = Math.max(normalized, 0.05) * 2.5;
        return (
          <mesh key={s.benchmark} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </>
  );
}

function RadarOutline({ scores, color = "#00d4aa" }: { scores: BenchmarkScore[]; color?: string }) {
  const n = scores.length;

  const points = useMemo((): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
      const s = scores[idx];
      const normalized = s.maxScore > 0 ? s.score / s.maxScore : 0;
      const radius = Math.max(normalized, 0.05) * 2.5;
      pts.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 0]);
    }
    return pts;
  }, [scores, n]);

  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={0.8}
      lineWidth={2}
    />
  );
}

function RadarScene({ scores, comparisonScores }: {
  scores: BenchmarkScore[];
  comparisonScores?: BenchmarkScore[];
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.05;
      // Gentle tilt oscillation
      groupRef.current.rotation.x = Math.sin(Date.now() * 0.0003) * 0.15;
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />

      <group ref={groupRef}>
        <RadarLines scores={scores} />
        <RadarWeb scores={scores} color="#00d4aa" opacity={0.2} />
        <ScorePoints scores={scores} color="#00d4aa" />
        <RadarOutline scores={scores} color="#00d4aa" />

        {comparisonScores && (
          <>
            <RadarWeb scores={comparisonScores} color="#f59e0b" opacity={0.15} />
            <ScorePoints scores={comparisonScores} color="#f59e0b" />
            <RadarOutline scores={comparisonScores} color="#f59e0b" />
          </>
        )}

        <RadarLabels scores={scores} />
      </group>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.2}
      />
    </>
  );
}

export function BenchmarkRadar3D({
  scores,
  modelName,
  comparisonScores,
  comparisonName,
}: BenchmarkRadar3DProps) {
  if (!scores || scores.length < 3) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
        Need at least 3 benchmarks for radar visualization
      </div>
    );
  }

  return (
    <div className="relative w-full h-[350px] rounded-xl overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <RadarScene scores={scores} comparisonScores={comparisonScores} />
      </Canvas>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 pointer-events-none">
        {modelName && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#00d4aa]" />
            <span className="text-xs text-muted-foreground">{modelName}</span>
          </div>
        )}
        {comparisonName && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b]" />
            <span className="text-xs text-muted-foreground">{comparisonName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
