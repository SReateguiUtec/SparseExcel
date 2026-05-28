import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { RotateCcw, Activity } from 'lucide-react';

const NODE_WIDTH = 3.2;
const NODE_HEIGHT = 2.0;

const SPACING = 5.5;
const NODE_DEPTH = 1.6;

// Layout fractions
const TOP_FRAC = 0.42;  // value section takes 42% of height
const BOT_FRAC = 0.58;  // pointer section takes 58%
const TOP_H = NODE_HEIGHT * TOP_FRAC;
const BOT_H = NODE_HEIGHT * BOT_FRAC;
const TOP_CENTER_Y =  (NODE_HEIGHT / 2) - (TOP_H / 2);
const BOT_CENTER_Y = -(NODE_HEIGHT / 2) + (BOT_H / 2);
const DIV_Y        =  (NODE_HEIGHT / 2) - TOP_H;        // horizontal divider Y
const SEC_W = NODE_WIDTH / 3;                            // each of 3 bottom columns

// World-space port offsets (relative to node center)
const LEFT_PORT_X  = -NODE_WIDTH / 2 + SEC_W / 2;       // ≈ -1.067
const RIGHT_PORT_X =  NODE_WIDTH / 2 - SEC_W / 2;        // ≈ +1.067
const ARROW_Z      =  NODE_DEPTH / 2 + 0.12;             // in front of node face

const NODE_COLOR   = '#00f3ff';
const ROW_COLOR    = '#ef4444';
const COL_COLOR    = '#22c55e';
const HEADER_COLOR = '#475569';

// ─── Orthogonal arrow ───────────────────────────────────────────────────────────
// Uses TWO independent straight-tube segments for true 90-degree corners.
function OrthoArrow({ start, end, color }) {
  const RADIUS = 0.032;

  // Decompose into one or two straight segments
  const { seg1, seg2, lastDir } = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const dx = Math.abs(e.x - s.x);
    const dy = Math.abs(e.y - s.y);

    if (dx < 0.04 || dy < 0.04) {
      // Already axis-aligned — single segment
      const d = new THREE.Vector3().subVectors(e, s).normalize();
      return { seg1: [s, e], seg2: null, lastDir: d };
    }

    // L-shape: horizontal first (for rows) vs vertical first (for cols)
    // Decide by which delta is larger
    const corner = dx >= dy
      ? new THREE.Vector3(e.x, s.y, s.z)   // move X first
      : new THREE.Vector3(s.x, e.y, s.z);  // move Y first

    const d = new THREE.Vector3().subVectors(e, corner).normalize();
    return { seg1: [s, corner], seg2: [corner, e], lastDir: d };
  }, [start, end]);

  const geo1 = useMemo(() => {
    const curve = new THREE.LineCurve3(seg1[0], seg1[1]);
    return new THREE.TubeGeometry(curve, 1, RADIUS, 6, false);
  }, [seg1]);

  const geo2 = useMemo(() => {
    if (!seg2) return null;
    const curve = new THREE.LineCurve3(seg2[0], seg2[1]);
    return new THREE.TubeGeometry(curve, 1, RADIUS, 6, false);
  }, [seg2]);

  // Arrowhead at the tip of the final segment
  const quat = useMemo(() =>
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lastDir),
  [lastDir]);
  const tipPos = useMemo(() =>
    new THREE.Vector3(...end).sub(lastDir.clone().multiplyScalar(0.13)),
  [end, lastDir]);

  return (
    <group>
      <mesh geometry={geo1}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.95} />
      </mesh>
      {geo2 && (
        <mesh geometry={geo2}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} transparent opacity={0.95} />
        </mesh>
      )}
      <mesh position={tipPos} quaternion={quat}>
        <coneGeometry args={[0.1, 0.22, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={6} />
      </mesh>
    </group>
  );
}

// ─── Node ────────────────────────────────────────────────────────────────────
function AnimatedNode({ position, value, r, c, color }) {
  const meshRef = useRef();
  const targetScale = useRef(1);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const current = meshRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, targetScale.current, Math.min(delta * 8, 1));
      meshRef.current.scale.setScalar(next);
    }
  });

  useEffect(() => { targetScale.current = 1; }, []);

  const faceZ = NODE_DEPTH / 2 + 0.012;
  const leftPortX  = -NODE_WIDTH / 2 + SEC_W / 2;
  const rightPortX =  NODE_WIDTH / 2 - SEC_W / 2;

  return (
    <group ref={meshRef} position={position} scale={0.01}>

      {/* ── Body ── */}
      <mesh castShadow>
        <boxGeometry args={[NODE_WIDTH, NODE_HEIGHT, NODE_DEPTH]} />
        <meshPhysicalMaterial
          color="#06101f"
          emissive={color}
          emissiveIntensity={0.07}
          metalness={0.55}
          roughness={0.22}
          transparent
          opacity={0.96}
        />
      </mesh>

      {/* ── Glowing outline ── */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(NODE_WIDTH, NODE_HEIGHT, NODE_DEPTH)]} />
        <lineBasicMaterial color={color} />
      </lineSegments>

      {/* ── Horizontal divider (value | pointers) ── */}
      <mesh position={[0, DIV_Y, faceZ]}>
        <planeGeometry args={[NODE_WIDTH, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} />
      </mesh>

      {/* ── Vertical dividers: at ±SEC_W/2 (create 3 bottom cells) ── */}
      {[-SEC_W / 2, SEC_W / 2].map((xOff, i) => (
        <mesh key={i} position={[xOff, BOT_CENTER_Y, faceZ]}>
          <planeGeometry args={[0.018, BOT_H]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} transparent opacity={0.65} />
        </mesh>
      ))}

      {/* ── VALUE label (top section) ── */}
      <Text
        position={[0, TOP_CENTER_Y, faceZ + 0.04]}
        fontSize={0.55}
        color="#e2e8f0"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {value}
      </Text>

      {/* ── Row index ── */}
      <Text
        position={[-0.16, BOT_CENTER_Y, faceZ + 0.04]}
        fontSize={0.22}
        color="#7dd3fc"
        anchorX="center"
        anchorY="middle"
      >
        {r}
      </Text>

      {/* ── Col index ── */}
      <Text
        position={[0.16, BOT_CENTER_Y, faceZ + 0.04]}
        fontSize={0.22}
        color="#86efac"
        anchorX="center"
        anchorY="middle"
      >
        {c}
      </Text>

      {/* ── LEFT ◆ — next_row pointer (red) ── */}
      <mesh position={[leftPortX, BOT_CENTER_Y, faceZ + 0.06]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.2, 0.07]} />
        <meshStandardMaterial color={ROW_COLOR} emissive={ROW_COLOR} emissiveIntensity={7} />
      </mesh>

      {/* ── RIGHT ◆ — next_col pointer (green) ── */}
      <mesh position={[rightPortX, BOT_CENTER_Y, faceZ + 0.06]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.2, 0.07]} />
        <meshStandardMaterial color={COL_COLOR} emissive={COL_COLOR} emissiveIntensity={7} />
      </mesh>

    </group>
  );
}

// Row / Col header — same linked-list node shape as data nodes
function HeaderNode({ position, label, type, color }) {
  const W = NODE_WIDTH;
  const H = NODE_HEIGHT;
  const D = NODE_DEPTH;

  const faceZ    = D / 2 + 0.012;
  const topCY    = TOP_CENTER_Y;
  const botCY    = BOT_CENTER_Y;
  const divY_h   = DIV_Y;
  const sW       = SEC_W;

  // Active port: row headers point right (◆ red), col headers point down (◆ green)
  const portColor = type === 'row' ? ROW_COLOR : COL_COLOR;
  // Port sits in the RIGHT third of the bottom row
  const portX = W / 2 - sW / 2;

  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0.25}>
      <group position={position}>

        {/* Body */}
        <mesh>
          <boxGeometry args={[W, H, D]} />
          <meshPhysicalMaterial
            color="#0c1a2e"
            emissive={color}
            emissiveIntensity={0.18}
            metalness={0.65}
            roughness={0.2}
            transparent
            opacity={0.82}
          />
        </mesh>

        {/* Glowing outline */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(W, H, D)]} />
          <lineBasicMaterial color={color} />
        </lineSegments>

        {/* Horizontal divider */}
        <mesh position={[0, divY_h, faceZ]}>
          <planeGeometry args={[W, 0.022]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} />
        </mesh>

        {/* Vertical dividers — create 3 bottom cells */}
        {[-sW / 2, sW / 2].map((xOff, i) => (
          <mesh key={i} position={[xOff, botCY, faceZ]}>
            <planeGeometry args={[0.018, BOT_H]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} transparent opacity={0.55} />
          </mesh>
        ))}

        {/* Label in top section */}
        <Text
          position={[0, topCY, faceZ + 0.04]}
          fontSize={0.32}
          color={color}
          anchorX="center"
          anchorY="middle"
          font={undefined}
        >
          {label}
        </Text>

        {/* Index number in center-bottom cell */}
        <Text
          position={[0, botCY, faceZ + 0.04]}
          fontSize={0.24}
          color="#cbd5e1"
          anchorX="center"
          anchorY="middle"
        >
          {type === 'row'
            ? label.replace('Fila ', '')
            : label.replace('Col ', '')}
        </Text>

        {/* Active pointer diamond — right cell */}
        <mesh position={[portX, botCY, faceZ + 0.06]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.2, 0.2, 0.07]} />
          <meshStandardMaterial color={portColor} emissive={portColor} emissiveIntensity={7} />
        </mesh>

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

          // ── Row arrow (red): right ◆ of prev → left ◆ of this node ──
          const rowNodes = nodes.filter(n => n.r === node.r).sort((a, b) => a.c - b.c);
          const rIdx = rowNodes.findIndex(n => n.c === node.c);
          const rowY = nodePos[1] + BOT_CENTER_Y;
          const startR = rIdx === 0
            ? [startX + RIGHT_PORT_X, rowY, ARROW_Z]
            : [rowNodes[rIdx - 1].c * SPACING * 1.5 + RIGHT_PORT_X, rowY, ARROW_Z];
          const endR = [nodePos[0] + LEFT_PORT_X, rowY, ARROW_Z];

          // ── Col arrow (green): bottom of prev → top of this node ──
          const colNodes = nodes.filter(n => n.c === node.c).sort((a, b) => a.r - b.r);
          const cIdx = colNodes.findIndex(n => n.r === node.r);
          const colX = nodePos[0] + LEFT_PORT_X;
          const startC = cIdx === 0
            ? [colX, startY - NODE_HEIGHT / 2, ARROW_Z]
            : [colNodes[cIdx - 1].c * SPACING * 1.5 + LEFT_PORT_X,
               -colNodes[cIdx - 1].r * SPACING - NODE_HEIGHT / 2, ARROW_Z];
          const endC = [colX, nodePos[1] + NODE_HEIGHT / 2, ARROW_Z];

          return (
            <group key={`${node.r}-${node.c}-${i}`}>
              <AnimatedNode position={nodePos} value={node.val} r={node.r} c={node.c} color={NODE_COLOR} />
              <OrthoArrow start={startR} end={endR} color={ROW_COLOR} />
              <OrthoArrow start={startC} end={endC} color={COL_COLOR} />
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
