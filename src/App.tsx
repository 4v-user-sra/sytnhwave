/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';

// Simplified synthesizer component
const NOTES = [
    { name: 'C', freq: 261.63 },
    { name: 'D', freq: 293.66 },
    { name: 'E', freq: 329.63 },
    { name: 'F', freq: 349.23 },
    { name: 'G', freq: 392.00 },
    { name: 'A', freq: 440.00 },
    { name: 'B', freq: 493.88 },
];

export default function App() {
  const audioContext = useRef<AudioContext | null>(null);
  const [oscillatorType, setOscillatorType] = useState<OscillatorType>('sine');
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [adsr, setAdsr] = useState({ a: 0.1, d: 0.2, s: 0.2, r: 0.5 });
  const [isLooping, setIsLooping] = useState(false);
  const [isInfinitePad, setIsInfinitePad] = useState(false);
  const [octave, setOctave] = useState(0);
  const [delayTime, setDelayTime] = useState(0.2);
  const activeNodes = useRef<Map<number, { osc: OscillatorNode, gain: GainNode }>>(new Map());
  const pressedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const handleKeyDown = (e: KeyboardEvent) => {
        const keyMap: Record<string, number> = { 'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6 };
        if (keyMap.hasOwnProperty(e.key) && !pressedKeys.current.has(e.key)) {
            pressedKeys.current.add(e.key);
            playNote(NOTES[keyMap[e.key]].freq);
        }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
        const keyMap: Record<string, number> = { 'a': 0, 's': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5, 'j': 6 };
        if (keyMap.hasOwnProperty(e.key) && pressedKeys.current.has(e.key)) {
            pressedKeys.current.delete(e.key);
            if (!isInfinitePad) stopNote(NOTES[keyMap[e.key]].freq * Math.pow(2, octave));
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
        audioContext.current?.close();
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [octave, isInfinitePad, adsr]);

  const stopNote = (freq: number) => {
    const node = activeNodes.current.get(freq);
    if (!node || !audioContext.current) return;
    
    const now = audioContext.current.currentTime;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.exponentialRampToValueAtTime(0.001, now + adsr.r);
    node.osc.stop(now + adsr.r);
    
    activeNodes.current.delete(freq);
  };

  const playNote = (freq: number) => {
    if (!audioContext.current) return;

    const targetFreq = freq * Math.pow(2, octave);
    if (activeNodes.current.has(targetFreq)) {
        stopNote(targetFreq);
        if (!isInfinitePad) return;
    }
    
    const osc = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();
    const filter = audioContext.current.createBiquadFilter();
    const delay = audioContext.current.createDelay();
    
    osc.type = oscillatorType;
    osc.frequency.setValueAtTime(targetFreq, audioContext.current.currentTime);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, audioContext.current.currentTime);
    
    delay.delayTime.value = delayTime;
    
    // ADSR Envelope
    const now = audioContext.current.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + adsr.a); // Attack
    gainNode.gain.linearRampToValueAtTime(adsr.s, now + adsr.a + adsr.d); // Decay to Sustain
    
    osc.connect(filter);
    filter.connect(delay);
    delay.connect(gainNode);
    gainNode.connect(audioContext.current.destination);
    
    osc.start();
    
    activeNodes.current.set(targetFreq, { osc, gain: gainNode });

    if (!isInfinitePad) {
        // Release
        const stopTime = now + adsr.a + adsr.d + 1; // Simplified sustain
        gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime + adsr.r);
        osc.stop(stopTime + adsr.r);
        activeNodes.current.delete(targetFreq);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#E0E0E0] p-8 font-sans">
      <h1 className="text-5xl font-black tracking-tighter text-white mb-8 uppercase">SynthWave</h1>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[#15171C] p-4 border border-white/10">
            <h2 className="text-xs uppercase opacity-60 mb-2">Oscillator</h2>
            <div className="flex flex-wrap gap-1">
                {(['sine', 'square', 'sawtooth', 'triangle'] as const).map(type => (
                    <button 
                        key={type}
                        onClick={() => setOscillatorType(type)}
                        className={`px-3 py-1 text-xs uppercase border ${oscillatorType === type ? 'border-[#00F0FF] text-[#00F0FF]' : 'border-white/10 text-white/50'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>
        <div className="bg-[#15171C] p-4 border border-white/10">
            <h2 className="text-xs uppercase opacity-60 mb-2">Filter Cutoff ({Math.round(filterCutoff)}Hz)</h2>
            <input type="range" min="200" max="10000" step="100" value={filterCutoff} onChange={(e) => setFilterCutoff(Number(e.target.value))} className="w-full accent-[#FF007A]" />
        </div>
        <div className="bg-[#15171C] p-4 border border-white/10">
            <h2 className="text-xs uppercase opacity-60 mb-2">Delay Time ({delayTime.toFixed(1)}s)</h2>
            <input type="range" min="0.0" max="1.0" step="0.1" value={delayTime} onChange={(e) => setDelayTime(Number(e.target.value))} className="w-full accent-[#00F0FF]" />
        </div>
        <div className="bg-[#15171C] p-4 border border-white/10">
            <h2 className="text-xs uppercase opacity-60 mb-2">Octave {octave}</h2>
            <div className="flex gap-2">
                <button onClick={() => setOctave(o => o - 1)} className="px-3 py-1 border border-white/10 text-white">-</button>
                <button onClick={() => setOctave(o => o + 1)} className="px-3 py-1 border border-white/10 text-white">+</button>
            </div>
        </div>
        <div className="bg-[#15171C] p-4 border border-white/10 flex flex-col items-center justify-center gap-2">
            <button 
                onClick={() => setIsLooping(!isLooping)}
                className={`w-full px-4 py-2 uppercase font-bold text-xs ${isLooping ? 'bg-[#FF007A] text-white' : 'bg-transparent border border-white/20 text-white/50'}`}
            >
                {isLooping ? 'Loop: ON' : 'Loop: OFF'}
            </button>
            <button 
                onClick={() => setIsInfinitePad(!isInfinitePad)}
                className={`w-full px-4 py-2 uppercase font-bold text-xs ${isInfinitePad ? 'bg-[#00F0FF] text-black' : 'bg-transparent border border-white/20 text-white/50'}`}
            >
                {isInfinitePad ? 'Pad: ON' : 'Pad: OFF'}
            </button>
        </div>
        <div className="col-span-3 bg-[#15171C] p-4 border border-white/10 flex gap-4">
            {(['a', 'd', 's', 'r'] as const).map(param => (
                <div key={param} className="flex-1">
                    <h2 className="text-xs uppercase opacity-60 mb-2">{param.toUpperCase()} ({adsr[param].toFixed(1)})</h2>
                    <input type="range" min="0.01" max="2" step="0.1" value={adsr[param]} onChange={(e) => setAdsr({...adsr, [param]: Number(e.target.value)})} className="w-full accent-[#FF007A]" />
                </div>
            ))}
        </div>
      </div>

      <div className="flex gap-1">
        {NOTES.map(note => (
            <button 
                key={note.name}
                onMouseDown={() => playNote(note.freq)}
                onMouseUp={() => !isInfinitePad && stopNote(note.freq)}
                onMouseLeave={() => !isInfinitePad && stopNote(note.freq)}
                className="flex-1 h-40 bg-[#15171C] text-[#E0E0E0] font-bold flex items-end justify-center pb-4 border border-[#FF007A] hover:bg-[#FF007A]/20"
            >
                {note.name}
            </button>
        ))}
      </div>
    </div>
  );
}
