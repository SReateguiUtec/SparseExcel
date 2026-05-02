import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { RotateCcw, Activity } from 'lucide-react';

const NODE_WIDTH = 3.2;
const NODE_HEIGHT = 1.8;
const CELL_W = NODE_WIDTH / 4;
const HALF_H = NODE_HEIGHT / 2;
const SPACING = 5.5;
const NODE_DEPTH = 2.0;

const NODE_COLOR = '#00f3ff'; // cyan  — nodos
const ROW_COLOR = '#ef4444'; // rojo  — flechas horizontales
const COL_COLOR = '#22c55e'; // verde — flechas verticales
const HEADER_COLOR = '#475569'; // gris pizarra — cabeceras de fila y columna

// Glowing tube arrow between two points
function GlowArrow({ start, end, color }) {
  const curve = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    return new THREE.LineCurve3(s, e);
  }, [start, end]);

  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 1, 0.045, 6, false), [curve]);
  const direction = useMemo(() => new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize(), [start, end]);
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction), [direction]);
  const arrowPos = useMemo(() => new THREE.Vector3(...end).sub(direction.clone().multiplyScalar(0.18)), [end, direction]);

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.85} />
      </mesh>
      <mesh position={arrowPos} quaternion={quaternion}>
        <coneGeometry args={[0.1, 0.28, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
      </mesh>
    </group>
  );
}

// Animated node that scales in on mount
function AnimatedNode({ position, value, r, c, color }) {
  const meshRef = useRef();
  const [scale, setScale] = useState(0.01);
  const targetScale = useRef(1);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const current = meshRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, targetScale.current, Math.min(delta * 8, 1));
      meshRef.current.scale.setScalar(next);
    }
  });

  // Trigger animation on mount
  useMemo(() => { targetScale.current = 1; }, []);

  return (
    <group ref={meshRef} position={position} scale={0.01}>
      {/* Main body */}
      <mesh castShadow>
        <boxGeometry args={[NODE_WIDTH, NODE_HEIGHT, NODE_DEPTH]} />
        <meshPhysicalMaterial
          color="#0f172a"
          emissive={color}
          emissiveIntensity={0.12}
          metalness={0.6}
          roughness={0.2}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Glowing border frame */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(NODE_WIDTH, NODE_HEIGHT, NODE_DEPTH)]} />
        <lineBasicMaterial color={color} />
      </lineSegments>

      {/* Top half divider */}
      <mesh position={[0, 0, NODE_DEPTH / 2 + 0.001]}>
        <planeGeometry args={[NODE_WIDTH, 0.012]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>

      {/* Vertical dividers in bottom half */}
      {[1, 2, 3].map(i => (
        <mesh key={i} position={[-NODE_WIDTH / 2 + i * CELL_W, -HALF_H / 2, NODE_DEPTH / 2 + 0.001]}>
          <planeGeometry args={[0.012, HALF_H]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* VALUE */}
      <Text position={[0, HALF_H / 2, NODE_DEPTH / 2 + 0.05]} fontSize={0.5} color="#ffffff" font={undefined} anchorX="center" anchorY="middle">
        {value}
      </Text>

      {/* Row index */}
      <Text position={[-CELL_W / 2 - 0.05, -HALF_H / 2, NODE_DEPTH / 2 + 0.05]} fontSize={0.24} color="#94a3b8" anchorX="center" anchorY="middle">
        {r}
      </Text>

      {/* Col index */}
      <Text position={[CELL_W / 2, -HALF_H / 2, NODE_DEPTH / 2 + 0.05]} fontSize={0.24} color="#94a3b8" anchorX="center" anchorY="middle">
        {c}
      </Text>

      {/* Green diamond port (col pointer) */}
      <mesh position={[-1.5 * CELL_W, -HALF_H / 2, NODE_DEPTH / 2 + 0.07]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.14, 0.14, 0.06]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={5} />
      </mesh>

      {/* Red diamond port (row pointer) */}
      <mesh position={[NODE_WIDTH / 2, 0, NODE_DEPTH / 2 + 0.07]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.14, 0.14, 0.06]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={5} />
      </mesh>
    </group>
  );
}

// Row / Col header
function HeaderNode({ position, label, type, color }) {
  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
      <group position={position}>
        <mesh>
          <boxGeometry args={[2.8, 0.9, 1.2]} />
          <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.35} metalness={0.7} roughness={0.15} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(2.8, 0.9, 1.2)]} />
          <lineBasicMaterial color={color} />
        </lineSegments>
        <Text position={[0, 0, 0.65]} fontSize={0.28} color={color} anchorX="center" anchorY="middle">
          {label}
        </Text>
      </group>
    </Float>
  );
}

// Infinite floor grid lines with major/minor hierarchy
function CyberpunkFloor({ rows, cols }) {
  const { majorGeo, minorGeo } = useMemo(() => {
    const majorLines = [];
    const minorLines = [];

    const width = cols * SPACING * 1.5;
    const height = rows * SPACING;
    const step = 5.5;

    // Verticales
    for (let x = -SPACING; x <= width + SPACING; x += step * 1.5) {
      const isMajor = Math.round(x / (step * 1.5)) % 5 === 0;
      const target = isMajor ? majorLines : minorLines;
      target.push(x, SPACING, 0, x, -height - SPACING, 0);
    }
    // Horizontales
    for (let y = SPACING; y >= -height - SPACING; y -= step) {
      const isMajor = Math.round(y / step) % 10 === 0;
      const target = isMajor ? majorLines : minorLines;
      target.push(-SPACING, y, 0, width + SPACING, y, 0);
    }

    const gMaj = new THREE.BufferGeometry();
    gMaj.setAttribute('position', new THREE.Float32BufferAttribute(majorLines, 3));
    const gMin = new THREE.BufferGeometry();
    gMin.setAttribute('position', new THREE.Float32BufferAttribute(minorLines, 3));

    return { majorGeo: gMaj, minorGeo: gMin };
  }, [rows, cols]);

  return (
    <group position={[0, 0, -3.2]}>
      <lineSegments geometry={majorGeo}>
        <lineBasicMaterial color="#334155" transparent opacity={0.6} />
      </lineSegments>
      <lineSegments geometry={minorGeo}>
        <lineBasicMaterial color="#1e293b" transparent opacity={0.2} />
      </lineSegments>
    </group>
  );
}

// Animated selection frame for active cell
function SelectionHighlight({ position }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.05);
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <boxGeometry args={[NODE_WIDTH + 0.5, NODE_HEIGHT + 0.5, NODE_DEPTH + 0.2]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.15} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(NODE_WIDTH + 0.5, NODE_HEIGHT + 0.5, NODE_DEPTH + 0.2)]} />
        <lineBasicMaterial color="#22c55e" />
      </lineSegments>
      {/* Searchlight effect */}
      <pointLight distance={10} intensity={20} color="#22c55e" />
    </group>
  );
}

export default function Matrix3D({ nodes, activeCell, gridSize }) {
  const controlsRef = useRef();

  const activeRows = useMemo(() => {
    const fromNodes = nodes.map(n => n.r);
    const editingR = activeCell ? [activeCell.r] : [];
    return [...new Set([0, 1, 2, 3, ...fromNodes, ...editingR])].sort((a, b) => a - b);
  }, [nodes, activeCell]);

  const activeCols = useMemo(() => {
    const fromNodes = nodes.map(n => n.c);
    const editingC = activeCell ? [activeCell.c] : [];
    return [...new Set([0, 1, 2, 3, ...fromNodes, ...editingC])].sort((a, b) => a - b);
  }, [nodes, activeCell]);

  const startX = -8;
  const startY = 7;

  const focusAll = () => {
    if (!nodes.length || !controlsRef.current) return;

    // Calcular centro y tamaño de la escena activa
    const maxR = Math.max(...nodes.map(n => n.r), 10);
    const maxC = Math.max(...nodes.map(n => n.c), 10);

    const center = [(maxC * SPACING * 1.5) / 2, (-maxR * SPACING) / 2, 0];
    const distance = Math.max(maxR * SPACING, maxC * SPACING * 1.5) * 1.2;

    controlsRef.current.target.set(...center);
    controlsRef.current.object.position.set(center[0], center[1], distance);
    controlsRef.current.update();
  };

  return (
    <div className="w-full h-full bg-slate-950 overflow-hidden relative">
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button
          onClick={focusAll}
          className="px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 rounded-full text-[10px] font-black flex items-center gap-2 transition-all backdrop-blur"
        >
          <Activity size={12} /> ENFOCAR TODO
        </button>
        <button
          onClick={() => controlsRef.current?.reset()}
          className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 rounded-full text-[10px] font-black flex items-center gap-2 transition-all backdrop-blur"
        >
          <RotateCcw size={12} /> REINICIAR CÁMARA
        </button>
      </div>

      <Canvas
        camera={{ position: [4, 2, 26], fov: 42, far: 20000 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#020617']} />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          screenSpacePanning
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />

        {/* Lights */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 15, 15]} intensity={60} color="#ffffff" castShadow />
        <pointLight position={[-10, -5, 10]} intensity={30} color="#0ea5e9" />
        <pointLight position={[20, -10, 5]} intensity={20} color="#a855f7" />
        <CyberpunkFloor rows={gridSize.rows} cols={gridSize.cols} />

        {/* Active Selection Highlight */}
        {activeCell && (
          <SelectionHighlight
            position={[activeCell.c * SPACING * 1.5, -activeCell.r * SPACING, 0]}
          />
        )}

        {/* Row headers */}
        {activeRows.map(r => (
          <HeaderNode
            key={`rh-${r}`}
            position={[startX, -r * SPACING, 0]}
            label={`Fila ${r}`}
            type="row"
            color={r === activeCell?.r ? '#22c55e' : HEADER_COLOR}
          />
        ))}

        {/* Col headers */}
        {activeCols.map(c => (
          <HeaderNode
            key={`ch-${c}`}
            position={[c * SPACING * 1.5, startY, 0]}
            label={`Col ${c}`}
            type="col"
            color={c === activeCell?.c ? '#22c55e' : HEADER_COLOR}
          />
        ))}

        {/* Nodes + Arrows */}
        {nodes.map((node, i) => {
          const nodePos = [node.c * SPACING * 1.5, -node.r * SPACING, 0];

          // Row arrow (red)
          const rowNodes = nodes.filter(n => n.r === node.r).sort((a, b) => a.c - b.c);
          const rIdx = rowNodes.findIndex(n => n.c === node.c);
          const startR = rIdx === 0
            ? [startX + 1.4, nodePos[1], 0]
            : [rowNodes[rIdx - 1].c * SPACING * 1.5 + NODE_WIDTH / 2, nodePos[1], 0];
          const endR = [nodePos[0] - NODE_WIDTH / 2, nodePos[1], 0];

          // Col arrow (green)
          const colNodes = nodes.filter(n => n.c === node.c).sort((a, b) => a.r - b.r);
          const cIdx = colNodes.findIndex(n => n.r === node.r);
          const targetX = nodePos[0] - 1.5 * CELL_W;
          const startC = cIdx === 0
            ? [targetX, startY - 0.45, 0]
            : [targetX, -colNodes[cIdx - 1].r * SPACING - NODE_HEIGHT / 2, 0];
          const endC = [targetX, nodePos[1] + NODE_HEIGHT / 2, 0];

          return (
            <group key={`${node.r}-${node.c}-${i}`}>
              <AnimatedNode position={nodePos} value={node.val} r={node.r} c={node.c} color={NODE_COLOR} />
              <GlowArrow start={startR} end={endR} color={ROW_COLOR} />
              <GlowArrow start={startC} end={endC} color={COL_COLOR} />
            </group>
          );
        })}

        {/* Post-processing */}
        <EffectComposer>
          <Bloom
            intensity={2.5}
            luminanceThreshold={0.05}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.ADD}
            mipmapBlur
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={[0.0005, 0.0005]}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
