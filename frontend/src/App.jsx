import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, Calculator, Grid, LayoutTemplate, Activity, Monitor } from 'lucide-react';
import axios from 'axios';
import Matrix3D from './Matrix3D';

const API_BASE = 'http://localhost:8080';

const getColLetter = (index) => {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
};

const parseCell = (cell) => {
  const match = cell.toUpperCase().match(/([A-Z]+)([0-9]+)/);
  if (!match) return null;
  const letters = match[1];
  const row = parseInt(match[2]) - 1;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { r: row, c: col - 1 };
};

const colToIdx = (letters) => {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
};

const parseCellValue = (value) => {
  const clean = String(value ?? '').trim();

  if (clean === '') return '';

  // Reconoce tanto enteros como decimales
  const isNumber = /^-?\d+(\.\d+)?$/.test(clean);

  if (isNumber) {
    return Number(clean);
  }

  return clean;
};
export default function App() {
  const gridRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [stats, setStats] = useState({ sum: 0, max: 0, min: 0, count: 0, avg: 0 });
  const [input, setInput] = useState({ r: '', c: '', val: '', formula: '' });
  const [loading, setLoading] = useState(false);

  const [gridSize, setGridSize] = useState({ rows: 100, cols: 52 });

  // Grid interaction state
  const [editingCell, setEditingCell] = useState(null); // {r, c}
  const [editValue, setEditValue] = useState('');

  const [analysisRange, setAnalysisRange] = useState('A1:C5');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastOp, setLastOp] = useState('');

  const [delRow, setDelRow] = useState('');
  const [delCol, setDelCol] = useState('');
  const [debugNode, setDebugNode] = useState(null); // Para el popup de memoria
  const [delRange, setDelRange] = useState('');
  const [opLog, setOpLog] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // {x, y, type, index}

  // Optimize node lookup for the grid
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(`${n.r},${n.c}`, n));
    return map;
  }, [nodes]);

  const fetchData = async () => {
    try {
      const [nodesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/nodes`),
        axios.get(`${API_BASE}/stats`)
      ]);
      setNodes(nodesRes.data);
      setStats(statsRes.data);

      // Auto-expand visible grid if nodes exist beyond current bounds
      const maxR = nodesRes.data.reduce((max, n) => Math.max(max, n.r), 0);
      const maxC = nodesRes.data.reduce((max, n) => Math.max(max, n.c), 0);
      setGridSize(prev => ({
        rows: Math.max(prev.rows, maxR + 10), // Buffer de 10
        cols: Math.max(prev.cols, maxC + 5)   // Buffer de 5
      }));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCellClick = (r, c, val) => {
    setEditingCell({ r, c });
    setEditValue(val || '');

    // Si hay un nodo en esta celda, lo ponemos en modo debug
    const node = nodes.find(n => n.r === r && n.c === c);
    if (node) {
      setDebugNode(node);
    } else {
      setDebugNode(null);
    }
  };

  const saveCell = async (r, c, val) => {
    setEditingCell(null);
    let finalVal = val;
    const colLetter = getColLetter(c);
    const cellName = `${colLetter}${r + 1}`;
    const hadNode = nodeMap.has(`${r},${c}`);

    // FORMULA SUPPORT: detect '=' (Evaluado en Backend)
    if (val.toString().startsWith('=')) {
      try {
        const { data } = await axios.post(`${API_BASE}/evaluate`, { formula: val });
        finalVal = data.result;
      } catch (e) {
        alert("Error en fórmula (Backend)");
        return;
      }
    }

    const parsedValue = parseCellValue(finalVal);

    try {
      if (parsedValue === '') {
        if (!hadNode) return;
        await axios.post(`${API_BASE}/delete`, { r, c });
        setOpLog(prev => [{ type: 'delete', cell: cellName, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 8));
      } else {
        // Decidir si modificar o insertar
        const endpoint = hadNode ? '/modify' : '/insert';
        await axios.post(`${API_BASE}${endpoint}`, { r, c, val: parsedValue });

        const logEntry = {
          type: hadNode ? 'modify' : 'insert',
          cell: cellName,
          val: parsedValue,
          isFormula: val.toString().startsWith('='),
          time: new Date().toLocaleTimeString()
        };

        setOpLog(prev => [logEntry, ...prev].slice(0, 8));
      }

      fetchData();
    } catch (err) {
      console.error("Error updating cell", err);
    }
  };

  const handleKeyDown = (e, r, c) => {
    if (e.key === 'Enter') {
      saveCell(r, c, editValue);
      // Move down after enter
      if (r < gridSize.rows - 1) handleCellClick(r + 1, c, nodeMap.get(`${r + 1},${c}`)?.val);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveCell(r, c, editValue);
      if (c < gridSize.cols - 1) handleCellClick(r, c + 1, nodeMap.get(`${r},${c + 1}`)?.val);
    }
  };

  const handleManualAnalysis = async (op) => {
    const range = analysisRange.trim().toUpperCase();

    if (range.includes(':')) {
      const parts = range.split(':');
      const start = parseCell(parts[0]);
      const end = parseCell(parts[1]);
      if (!start || !end) return;
      const inRange = nodes.filter(n =>
        n.r >= Math.min(start.r, end.r) && n.r <= Math.max(start.r, end.r) &&
        n.c >= Math.min(start.c, end.c) && n.c <= Math.max(start.c, end.c)
      );
      if (inRange.length === 0) { setAnalysisResult(0); setLastOp(op); return; }
      const vals = inRange.map(n => n.val);
      let res = 0;
      const rangeData = {
        r1: Math.min(start.r, end.r),
        c1: Math.min(start.c, end.c),
        r2: Math.max(start.r, end.r),
        c2: Math.max(start.c, end.c)
      };

      try {
        let endpoint = '';
        if (op === 'SUMA') endpoint = '/sum_range';
        else if (op === 'PROMEDIO') endpoint = '/avg_range';
        else if (op === 'MAX') endpoint = '/max_range';
        else if (op === 'MIN') endpoint = '/min_range';

        const { data } = await axios.post(`${API_BASE}${endpoint}`, rangeData);
        res = data.result;
      } catch (e) {
        console.error(e);
        res = 0;
      }

      setAnalysisResult(Number(res).toFixed(2));
      setLastOp(op);
    } else if (/^[A-Z]+$/.test(range)) {
      const cIdx = colToIdx(range);
      try {
        const colNodes = nodes.filter(n => n.c === cIdx);
        if (colNodes.length === 0) { setAnalysisResult(0); return; }
        const vals = colNodes
            .map(n => Number(n.val))
            .filter(v => !isNaN(v));
        if (vals.length === 0) {
          setAnalysisResult(0);
          setLastOp(`${op} COL ${range}`);
          return;
        }
        let res = 0;
        if (op === 'SUMA') res = vals.reduce((a, b) => a + b, 0);
        else if (op === 'PROMEDIO') res = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (op === 'MAX') res = Math.max(...vals);
        else if (op === 'MIN') res = Math.min(...vals);
        setAnalysisResult(res.toFixed(2));
        setLastOp(`${op} COL ${range}`);
      } catch (e) { alert("Error"); }
    } else if (/^[0-9]+$/.test(range)) {
      const rIdx = parseInt(range) - 1;
      try {
        const rowNodes = nodes.filter(n => n.r === rIdx);
        if (rowNodes.length === 0) { setAnalysisResult(0); return; }
        const vals = rowNodes
            .map(n => Number(n.val))
            .filter(v => !isNaN(v));
        if (vals.length === 0) {
          setAnalysisResult(0);
          setLastOp(`${op} COL ${range}`);
          return;
        }
        let res = 0;
        if (op === 'SUMA') res = vals.reduce((a, b) => a + b, 0);
        else if (op === 'PROMEDIO') res = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (op === 'MAX') res = Math.max(...vals);
        else if (op === 'MIN') res = Math.min(...vals);
        setAnalysisResult(res.toFixed(2));
        setLastOp(`${op} ROW ${range}`);
      } catch (e) { alert("Error"); }
    }
  };

  const removeRow = async () => {
    if (delRow === '') return;
    try { await axios.post(`${API_BASE}/remove_row`, { r: parseInt(delRow) - 1 }); fetchData(); setDelRow(''); } catch (e) { alert("Error"); }
  };
  const removeCol = async () => {
    if (delCol === '') return;
    const cIdx = /^[A-Z]+$/.test(delCol.toUpperCase()) ? colToIdx(delCol.toUpperCase()) : parseInt(delCol);
    try { await axios.post(`${API_BASE}/remove_col`, { c: cIdx }); fetchData(); setDelCol(''); } catch (e) { alert("Error"); }
  };
  const removeRange = async () => {
    const parts = delRange.split(':');
    if (parts.length !== 2) return alert("Usa A1:C4");
    const s = parseCell(parts[0]);
    const e = parseCell(parts[1]);
    try { await axios.post(`${API_BASE}/remove_range`, { r1: s.r, c1: s.c, r2: e.r, c2: e.c }); fetchData(); setDelRange(''); } catch (e) { alert("Error"); }
  };

  const handleContextMenu = (e, type, index) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, index });
  };

  const closeMenu = () => setContextMenu(null);

  useEffect(() => {
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const evaluateExpression = (expr) => {
    const content = expr.startsWith('=') ? expr.substring(1).toUpperCase() : expr.toUpperCase();
    const cellRefs = content.match(/[A-Z]+[0-9]+/g);
    let evalStr = content;

    if (cellRefs) {
      cellRefs.forEach(ref => {
        const coords = parseCell(ref);
        if (coords) {
          const node = nodes.find(n => n.r === coords.r && n.c === coords.c);
          evalStr = evalStr.replace(ref, node ? node.val : 0);
        }
      });
    }

    // Replace SUMA(A1:B2) or similar if needed, but for now basic arithmetic
    try {
      // Basic protection against non-arithmetic code
      if (/[^0-9+\-*/(). ]/.test(evalStr)) throw new Error("Invalid characters");
      return Function(`'use strict'; return (${evalStr})`)();
    } catch (e) {
      return null;
    }
  };

  const executeFormula = async (e) => {
    if (e.key !== 'Enter') return;
    try {
      const { data } = await axios.post(`${API_BASE}/evaluate`, { formula: input.formula });
      setAnalysisResult(Number(data.result).toFixed(2));
      setLastOp('RESULTADO (C++)');
    } catch (e) {
      alert("Fórmula Inválida en Backend");
    }
  };

  const jumpToCell = (r, c) => {
    const table = gridRef.current;
    if (!table) return;
    const rowEl = table.querySelector(`tr:nth-child(${r + 1})`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans selection:bg-green-500/30 flex flex-col overflow-hidden">
      <div className="bg-slate-900 border-b border-white/5 p-2 flex items-center gap-4 shrink-0 shadow-lg z-50">
        <div className="flex items-center gap-2 px-4 border-r border-white/10">
          <LayoutTemplate className="text-green-500" size={20} />
          <span className="font-bold text-sm text-white tracking-tight">Sparse<span className="text-green-500 font-black">Excel</span></span>
        </div>
        <div className="flex-1 flex items-center gap-2 bg-black/40 rounded px-3 py-1.5 border border-white/5 focus-within:border-green-500 transition-all">
          <span className="text-green-500 font-mono text-xs italic pr-2 border-r border-white/5">fx</span>
          <input
            className="bg-transparent flex-1 outline-none text-sm font-mono text-white"
            placeholder="Ej: =SUMA(A1:C4) o =A1+B1"
            value={input.formula}
            onChange={(e) => setInput({ ...input, formula: e.target.value })}
            onKeyDown={executeFormula}
          />
        </div>
        <div className="flex items-center gap-6 px-4 mr-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-slate-500 uppercase font-black">Nodos en Memoria</span>
            <span className="text-sm font-mono text-green-400 font-bold">{stats.count}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
          <div className="flex-1 overflow-hidden relative flex flex-col">

            {/* 2D Grid Panel (Top) — always visible */}
            <div className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col z-10 shrink-0" style={{ height: '50%' }}>
              <div className="p-2 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2 pl-1">
                  <Grid size={14} className="text-green-500" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Matriz 2D Interactiva</span>
                </div>
                <span className="text-[9px] text-slate-500 italic pr-2">Clic en celda para editar • Tab / Enter para navegar</span>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar" ref={gridRef}>
                <table className="border-collapse w-max">
                  <thead>
                    <tr>
                      <th className="w-10 h-8 bg-slate-900 border border-white/5 text-slate-500 text-[9px] sticky top-0 left-0 z-30">#</th>
                      {Array.from({ length: gridSize.cols }).map((_, c) => (
                        <th
                          key={c}
                          onContextMenu={(e) => handleContextMenu(e, 'col', c)}
                          className="w-20 h-8 bg-slate-900 border border-white/5 text-slate-400 text-[10px] font-bold uppercase sticky top-0 z-20 hover:bg-white/5 cursor-context-menu"
                        >
                          {getColLetter(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: gridSize.rows }).map((_, r) => (
                      <tr key={r}>
                        <td
                          onContextMenu={(e) => handleContextMenu(e, 'row', r)}
                          className="w-10 h-7 bg-slate-900 border border-white/5 text-slate-500 text-[9px] text-center font-bold sticky left-0 z-10 hover:bg-white/5 cursor-context-menu"
                        >
                          {r + 1}
                        </td>
                        {Array.from({ length: gridSize.cols }).map((_, c) => {
                          const node = nodeMap.get(`${r},${c}`);
                          const isEditing = editingCell?.r === r && editingCell?.c === c;
                          return (
                            <td
                              key={c}
                              onClick={() => handleCellClick(r, c, node?.val)}
                              className={`w-20 h-7 border border-white/5 text-center text-xs transition-all cursor-text relative
                                ${node ? 'bg-green-500/10 text-green-400 font-bold' : 'hover:bg-white/5 text-slate-700'}
                                ${isEditing ? 'ring-2 ring-green-500 ring-inset bg-slate-900 z-10' : ''}`}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-center text-white font-bold"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={() => saveCell(r, c, editValue)}
                                  onKeyDown={(e) => handleKeyDown(e, r, c)}
                                />
                              ) : (
                                node ? node.val : ''
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Background 3D Scene (Bottom) */}
            <div className="flex-1 relative z-0">
              <div className="absolute inset-0">
                <Matrix3D nodes={nodes} activeCell={editingCell} gridSize={gridSize} />
              </div>

              {/* Overlay legend */}
              <div className="absolute bottom-4 left-4 flex gap-4 p-3 bg-black/40 backdrop-blur rounded-lg border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Filas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Columnas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Valores</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4 overflow-y-auto pr-1 shrink-0">
          <div className="bg-slate-900/50 rounded-xl border border-blue-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} className="text-blue-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motor de Análisis</h2>
            </div>
            <div className="space-y-3">
              <input type="text" value={analysisRange} onChange={e => setAnalysisRange(e.target.value.toUpperCase())} placeholder="A1:C5 o B o 5" className="w-full bg-black/40 border border-white/5 rounded p-2 text-xs outline-none focus:border-blue-500 transition-colors" />
              <div className="grid grid-cols-2 gap-2">
                {['SUMA', 'PROMEDIO', 'MAX', 'MIN'].map(op => (
                  <button key={op} onClick={() => handleManualAnalysis(op)} className="py-2 bg-blue-600/10 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 text-[8px] font-black rounded transition-all active:scale-95">{op}</button>
                ))}
              </div>
              {analysisResult !== null && (
                <div className="p-3 bg-blue-600/20 rounded-lg border border-blue-500/30 text-center shadow-[0_0_20px_rgba(37,99,235,0.1)]">
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">{lastOp}</p>
                  <p className="text-2xl font-black text-white">{analysisResult}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-green-500/5 rounded-xl border border-green-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Grid size={16} className="text-green-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inserción Manual</h2>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Col (AA)"
                  maxLength={3}
                  value={input.c}
                  onChange={e => setInput({ ...input, c: e.target.value.toUpperCase() })}
                  className="w-1/3 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[10px] outline-none focus:border-green-500 text-center font-bold"
                />
                <input
                  type="number"
                  placeholder="Fila"
                  value={input.r}
                  onChange={e => setInput({ ...input, r: e.target.value })}
                  className="w-1/3 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[10px] outline-none focus:border-green-500 text-center font-bold"
                />
                <input
                  type="text"
                  placeholder="Val"
                  value={input.val}
                  onChange={e => setInput({ ...input, val: e.target.value })}
                  className="w-1/3 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-[10px] outline-none focus:border-green-500 text-center font-bold"
                />
              </div>
              <button
                onClick={async () => {
                  const colStr = input.c.toUpperCase();
                  if (!/^[A-Z]+$/.test(colStr)) {
                    return alert("La columna debe contener solo letras (ej: A, Z, AA).");
                  }
                  const cIdx = colToIdx(colStr);
                  const rIdx = parseInt(input.r) - 1;
                  const val = parseCellValue(input.val);

                  if (isNaN(cIdx) || isNaN(rIdx) || rIdx < 0 || val === '') {
                    return alert("Datos inválidos. Ej: Col: B, Fila: 50, Val: 10 o Val: Hola");
                  }

                  await axios.post(`${API_BASE}/insert`, { r: rIdx, c: cIdx, val });
                  setInput({ ...input, r: '', c: '', val: '' });
                  fetchData();
                  setTimeout(() => jumpToCell(rIdx, cIdx), 500);
                }}
                className="w-full py-2 bg-green-600/20 hover:bg-green-600 border border-green-500/30 text-green-400 hover:text-white text-[8px] font-black rounded transition-all uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.1)]"
              >
                INSERTAR Y VER NODO
              </button>
            </div>
          </div>

          <div className="bg-red-500/3 rounded-xl border border-red-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 size={16} className="text-red-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limpieza de Memoria</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" placeholder="Row (ej: 5)" value={delRow} onChange={e => setDelRow(e.target.value)} className="w-1/2 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeRow} className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all">ELIMINAR FILA</button>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Col (ej: B)" value={delCol} onChange={e => setDelCol(e.target.value)} className="w-1/2 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeCol} className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all">ELIMINAR COLUMNA</button>
              </div>
              <div className="space-y-2">
                <input type="text" placeholder="Rango (A1:C5)" value={delRange} onChange={e => setDelRange(e.target.value.toUpperCase())} className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeRange} className="w-full py-2 bg-red-500/20 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all uppercase tracking-widest">ELIMINAR RANGO</button>
              </div>
            </div>
          </div>

          {/* ── Sparse Analytics ── */}
          <div className="bg-slate-900/50 rounded-xl border border-cyan-500/10 p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-cyan-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análisis de Matriz</h2>
              <div className="ml-auto flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse delay-75" />
              </div>
            </div>
            {(() => {
              const total = gridSize.rows * gridSize.cols;
              const used = nodes.length;
              const density = total ? ((used / total) * 100).toFixed(2) : 0;
              const sparsity = (100 - density).toFixed(2);
              const memDense = total;
              const memSparse = used * 3;
              const memSaved = total ? Math.round(((memDense - memSparse) / memDense) * 100) : 0;
              const rowCounts = {};
              const colCounts = {};
              nodes.forEach(n => {
                rowCounts[n.r] = (rowCounts[n.r] || 0) + 1;
                colCounts[n.c] = (colCounts[n.c] || 0) + 1;
              });
              const topRow = Object.entries(rowCounts).sort((a, b) => b[1] - a[1])[0];
              const topCol = Object.entries(colCounts).sort((a, b) => b[1] - a[1])[0];
              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[8px] text-slate-500 uppercase font-black">Densidad</p>
                      <p className="text-lg font-black text-cyan-400">{density}<span className="text-xs">%</span></p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 border border-white/5">
                      <p className="text-[8px] text-slate-500 uppercase font-black">Dispersión</p>
                      <p className="text-lg font-black text-purple-400">{sparsity}<span className="text-xs">%</span></p>
                    </div>
                  </div>
                  {/* Density bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] text-slate-500">
                      <span>{used} nodos / {total} celdas</span>
                      <span>{memSaved > 0 ? `~${memSaved}% mem. ahorrada` : 'densa'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-linear-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-700" style={{ width: `${density}%` }} />
                    </div>
                  </div>
                  {topRow && (
                    <div className="flex justify-between text-[8px]">
                      <span className="text-slate-500">Fila más activa</span>
                      <span className="text-red-400 font-bold">Fila {topRow[0]} ({topRow[1]} nodos)</span>
                    </div>
                  )}
                  {topCol && (
                    <div className="flex justify-between text-[8px]">
                      <span className="text-slate-500">Columna más activa</span>
                      <span className="text-green-400 font-bold">{getColLetter(parseInt(topCol[0]))} ({topCol[1]} nodos)</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Operation Log ── */}
          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-4 flex flex-col h-64 shadow-xl">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <Monitor size={14} className="text-slate-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registro de Operaciones</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {opLog.length === 0 ? (
                <p className="text-[9px] text-slate-600 italic text-center mt-4">Sin operaciones aún.<br />Haz clic en una celda para comenzar.</p>
              ) : opLog.map((op, i) => (
                <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[9px] font-mono
                  ${op.type === 'insert'
                    ? 'bg-green-500/5 border-green-500/20 text-green-400'
                    : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                  <span className="font-black">{op.type === 'insert' ? (op.isFormula ? 'ƒ' : '✚') : '✕'}</span>
                  <span className="font-bold">{op.cell}</span>
                  {op.type === 'insert' && <span className="text-slate-400">= {op.val}</span>}
                  <span className="ml-auto text-slate-600 text-[7px]">{op.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── NODE MEMORY DEBUGGER (POPUP) ── */}
      {debugNode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10000 w-96 bg-slate-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-cyan-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Inspector de Memoria de Nodo</span>
            </div>
            <button onClick={() => setDebugNode(null)} className="text-cyan-400 hover:text-white transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="p-5 space-y-4 font-mono">
            <div className="grid grid-cols-2 gap-4 text-[10px]">
              <div className="space-y-1">
                <p className="text-slate-500 uppercase text-[8px] font-bold">Dirección Física</p>
                <p className="text-white font-bold bg-white/5 p-2 rounded border border-white/10">{debugNode.addr}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 uppercase text-[8px] font-bold">Valor (Tipo T)</p>
                <p className="text-cyan-400 font-bold bg-cyan-500/5 p-2 rounded border border-cyan-500/10">{debugNode.val}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400">next row pointer</span>
                <span className={`font-bold ${debugNode.next_r === 'NULL' ? 'text-slate-600' : 'text-red-400'}`}>
                  {debugNode.next_r}
                </span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400">next col pointer</span>
                <span className={`font-bold ${debugNode.next_c === 'NULL' ? 'text-slate-600' : 'text-green-400'}`}>
                  {debugNode.next_c}
                </span>
              </div>
            </div>

            <div className="text-[8px] text-slate-500 flex justify-between pt-2">
              <span>F: {debugNode.r} | C: {debugNode.c}</span>
              <span className="animate-pulse italic">ENLACE C++ EN TIEMPO REAL ACTIVO</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="fixed z-9999 bg-slate-900 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[140px] backdrop-blur-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={async () => {
              if (contextMenu.type === 'row') {
                await axios.post(`${API_BASE}/remove_row`, { r: contextMenu.index });
              } else {
                await axios.post(`${API_BASE}/remove_col`, { c: contextMenu.index });
              }
              fetchData();
              setOpLog(prev => [{
                type: 'delete',
                cell: contextMenu.type === 'row' ? `Fila ${contextMenu.index + 1}` : `Col ${getColLetter(contextMenu.index)}`,
                time: new Date().toLocaleTimeString()
              }, ...prev].slice(0, 8));
            }}
            className="w-full text-left px-4 py-2 text-[10px] font-black text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors uppercase tracking-widest"
          >
            <Trash2 size={12} /> Eliminar {contextMenu.type === 'row' ? 'Fila' : 'Columna'}
          </button>
        </div>
      )}
    </div>
  );
}
