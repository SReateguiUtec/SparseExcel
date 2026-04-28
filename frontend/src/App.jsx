import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Plus, Trash2, Calculator, Grid, Activity, Info, X, RefreshCw, Box, Table, Monitor, LayoutTemplate, Search, Trash } from 'lucide-react';
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

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [stats, setStats] = useState({ sum: 0, max: 0, min: 0, count: 0, avg: 0 });
  const [input, setInput] = useState({ r: '', c: '', val: '', formula: '' });
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('2d');
  const [gridSize] = useState({ rows: 25, cols: 20 });
  
  const [analysisRange, setAnalysisRange] = useState('A1:C5');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastOp, setLastOp] = useState('');

  const [delRow, setDelRow] = useState('');
  const [delCol, setDelCol] = useState('');
  const [delRange, setDelRange] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nodesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/nodes`),
        axios.get(`${API_BASE}/stats`)
      ]);
      setNodes(nodesRes.data);
      setStats(statsRes.data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInsert = async () => {
    if (input.r === '' || input.c === '' || input.val === '') return;
    try {
      await axios.post(`${API_BASE}/insert`, { r: parseInt(input.r), c: parseInt(input.c), val: parseInt(input.val) });
      setInput({ ...input, val: '', formula: '' });
      fetchData();
    } catch (err) { alert("Error"); }
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
      if (op === 'SUMA') res = vals.reduce((a, b) => a + b, 0);
      else if (op === 'PROMEDIO') res = vals.reduce((a, b) => a + b, 0) / vals.length;
      else if (op === 'MAX') res = Math.max(...vals);
      else if (op === 'MIN') res = Math.min(...vals);
      setAnalysisResult(res.toFixed(2));
      setLastOp(op);
    } else if (/^[A-Z]+$/.test(range)) {
      const cIdx = colToIdx(range);
      try {
        const colNodes = nodes.filter(n => n.c === cIdx);
        if (colNodes.length === 0) { setAnalysisResult(0); return; }
        const vals = colNodes.map(n => n.val);
        let res = 0;
        if (op === 'SUMA') res = vals.reduce((a, b) => a + b, 0);
        else if (op === 'PROMEDIO') res = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (op === 'MAX') res = Math.max(...vals);
        else if (op === 'MIN') res = Math.min(...vals);
        setAnalysisResult(res.toFixed(2));
        setLastOp(`${op} COL ${range}`);
      } catch(e) { alert("Error"); }
    } else if (/^[0-9]+$/.test(range)) {
      const rIdx = parseInt(range) - 1;
      try {
        const rowNodes = nodes.filter(n => n.r === rIdx);
        if (rowNodes.length === 0) { setAnalysisResult(0); return; }
        const vals = rowNodes.map(n => n.val);
        let res = 0;
        if (op === 'SUMA') res = vals.reduce((a, b) => a + b, 0);
        else if (op === 'PROMEDIO') res = vals.reduce((a, b) => a + b, 0) / vals.length;
        else if (op === 'MAX') res = Math.max(...vals);
        else if (op === 'MIN') res = Math.min(...vals);
        setAnalysisResult(res.toFixed(2));
        setLastOp(`${op} ROW ${range}`);
      } catch(e) { alert("Error"); }
    }
  };

  const removeRow = async () => {
    if (delRow === '') return;
    try { await axios.post(`${API_BASE}/remove_row`, { r: parseInt(delRow) - 1 }); fetchData(); setDelRow(''); } catch(e) { alert("Error"); }
  };
  const removeCol = async () => {
    if (delCol === '') return;
    const cIdx = /^[A-Z]+$/.test(delCol.toUpperCase()) ? colToIdx(delCol.toUpperCase()) : parseInt(delCol);
    try { await axios.post(`${API_BASE}/remove_col`, { c: cIdx }); fetchData(); setDelCol(''); } catch(e) { alert("Error"); }
  };
  const removeRange = async () => {
    const parts = delRange.split(':');
    if (parts.length !== 2) return alert("Usa A1:C4");
    const s = parseCell(parts[0]);
    const e = parseCell(parts[1]);
    try { await axios.post(`${API_BASE}/remove_range`, { r1: s.r, c1: s.c, r2: e.r, c2: e.c }); fetchData(); setDelRange(''); } catch(e) { alert("Error"); }
  };

  const executeFormula = (e) => {
    if (e.key !== 'Enter') return;
    const f = input.formula.toUpperCase();
    if (!f.startsWith('=')) return;
    const content = f.substring(1);
    const cellRefs = content.match(/[A-Z]+[0-9]+/g);
    let evalStr = content;
    if (cellRefs) {
      cellRefs.forEach(ref => {
        const coords = parseCell(ref);
        const node = nodes.find(n => n.r === coords.r && n.c === coords.c);
        evalStr = evalStr.replace(ref, node ? node.val : 0);
      });
    }
    try {
      const res = Function(`'use strict'; return (${evalStr})`)();
      setAnalysisResult(res.toFixed(2));
      setLastOp('RESULT');
    } catch (e) { alert("Invalid Formula"); }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans selection:bg-neon/30 flex flex-col overflow-hidden">
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
        <div className="flex bg-slate-800 rounded-full p-1 border border-white/10 shadow-inner">
          <button onClick={() => setViewMode(viewMode === '2d' ? 'hidden' : '2d')} className={`px-4 py-1.5 rounded-full text-[9px] font-black transition-all ${viewMode === '2d' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-slate-400 hover:text-white'}`}>
            TOGGLE 2D PANEL
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-white/5 shadow-2xl overflow-hidden relative">
          <div className="flex-1 overflow-hidden relative flex flex-col">
            
            {/* 2D Grid Panel (Top) */}
            <AnimatePresence>
              {viewMode === '2d' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: '45%' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col z-10 shrink-0"
                >
                  <div className="p-3 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-2 pl-1">
                      <Grid size={14} className="text-green-500" />
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">2D Live Grid</span>
                    </div>
                    <button onClick={() => setViewMode('hidden')} className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-red-500/80 rounded-full p-1">
                      <X size={12} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar p-3">
                    <table className="border-collapse w-max">
                      <thead>
                        <tr>
                          <th className="w-10 h-6 bg-slate-800/80 border border-white/5 text-slate-500 text-[9px] sticky top-0 z-20">#</th>
                          {Array.from({ length: gridSize.cols }).map((_, c) => (
                            <th key={c} className="w-16 h-6 bg-slate-800/80 border border-white/5 text-slate-300 text-[9px] font-bold uppercase sticky top-0 z-20">
                              {getColLetter(c)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: gridSize.rows }).map((_, r) => (
                          <tr key={r}>
                            <td className="w-10 h-6 bg-slate-800/80 border border-white/5 text-slate-400 text-[9px] text-center font-bold sticky left-0 z-10">
                              {r + 1}
                            </td>
                            {Array.from({ length: gridSize.cols }).map((_, c) => {
                              const node = nodes.find(n => n.r === r && n.c === c);
                              return (
                                <td key={c} className={`w-16 h-6 border border-white/5 text-center text-[10px] transition-all ${node ? 'bg-green-500/20 text-green-400 font-black shadow-[inset_0_0_10px_rgba(34,197,94,0.1)]' : 'text-slate-800 hover:bg-white/2'}`}>
                                  {node ? node.val : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background 3D Scene (Bottom) */}
            <div className="flex-1 relative z-0">
              <div className="absolute inset-0">
                <Matrix3D nodes={nodes} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 flex flex-col gap-4 overflow-y-auto pr-1 shrink-0">
          <div className="bg-slate-900/50 rounded-xl border border-blue-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={16} className="text-blue-400" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analysis Panel</h2>
            </div>
            <div className="space-y-3">
              <input type="text" value={analysisRange} onChange={e => setAnalysisRange(e.target.value.toUpperCase())} placeholder="A1:C5 o B o 5" className="w-full bg-black/40 border border-white/5 rounded p-2 text-xs outline-none focus:border-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                {['SUMA', 'PROMEDIO', 'MAX', 'MIN'].map(op => (
                  <button key={op} onClick={() => handleManualAnalysis(op)} className="py-2 bg-blue-600/10 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 text-[8px] font-black rounded transition-all">{op}</button>
                ))}
              </div>
              {analysisResult !== null && (
                <div className="p-3 bg-blue-600/20 rounded-lg border border-blue-500/30 text-center">
                  <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">{lastOp}</p>
                  <p className="text-2xl font-black text-white">{analysisResult}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-red-500/[0.03] rounded-xl border border-red-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 size={16} className="text-red-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Memory Cleanup</h2>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" placeholder="Row (ex: 5)" value={delRow} onChange={e => setDelRow(e.target.value)} className="w-1/2 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeRow} className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all">DELETE ROW</button>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Col (ex: B)" value={delCol} onChange={e => setDelCol(e.target.value)} className="w-1/2 bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeCol} className="flex-1 bg-red-500/10 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all">DELETE COL</button>
              </div>
              <div className="space-y-2">
                <input type="text" placeholder="Range (A1:C5)" value={delRange} onChange={e => setDelRange(e.target.value.toUpperCase())} className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs outline-none focus:border-red-500" />
                <button onClick={removeRange} className="w-full py-2 bg-red-500/20 hover:bg-red-500 border border-red-500/30 text-red-500 hover:text-white text-[8px] font-black rounded transition-all uppercase tracking-widest">DELETE SPECIFIC RANGE</button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-xl border border-white/5 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} className="text-green-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node Allocation</h2>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Row" value={input.r} onChange={e => setInput({...input, r: e.target.value})} className="bg-black/40 border border-white/5 rounded p-2 text-xs outline-none" />
                <input type="number" placeholder="Col" value={input.c} onChange={e => setInput({...input, c: e.target.value})} className="bg-black/40 border border-white/5 rounded p-2 text-xs outline-none" />
              </div>
              <input type="number" placeholder="Value" value={input.val} onChange={e => setInput({...input, val: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded p-2 text-xs outline-none" />
              <button onClick={handleInsert} className="w-full py-2.5 bg-green-500 text-white font-black text-[10px] rounded-lg shadow-lg shadow-green-600/20 active:scale-95 transition-all">INSERT NODE</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
