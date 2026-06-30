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
        if (isInfinitePad) return;
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
    <div className="min-h-screen bg-[#0A0B0E] text-[#E0E0E0] p-8 md:p-12 font-sans max-w-7xl mx-auto">
      <h1 className="text-6xl font-black tracking-tighter text-white mb-10 uppercase">SynthWave</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#15171C] p-6 border border-white/10 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 text-[#FF007A]">Oscillator</h2>
            <div className="flex flex-wrap gap-2 mb-4">
                {(['sine', 'square', 'sawtooth', 'triangle'] as const).map(type => (
                    <button 
                        key={type}
                        onClick={() => setOscillatorType(type)}
                        className={`px-4 py-2 text-sm font-medium uppercase border transition-colors ${oscillatorType === type ? 'border-[#00F0FF] text-[#00F0FF] bg-[#00F0FF]/10' : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
            <p className="text-xs text-white/40 mt-auto leading-relaxed">Selects the foundational waveform shape, determining the raw timbre and harmonic content of the sound.</p>
        </div>
        
        <div className="bg-[#15171C] p-6 border border-white/10 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 text-[#00F0FF]">Filter Cutoff <span className="opacity-50 text-white font-normal">({Math.round(filterCutoff)}Hz)</span></h2>
            <input type="range" min="200" max="10000" step="100" value={filterCutoff} onChange={(e) => setFilterCutoff(Number(e.target.value))} className="w-full accent-[#FF007A] mb-4" />
            <p className="text-xs text-white/40 mt-auto leading-relaxed">Adjusts the low-pass filter frequency, removing high frequencies to make the sound darker or brighter.</p>
        </div>
        
        <div className="bg-[#15171C] p-6 border border-white/10 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 text-white">Delay Time <span className="opacity-50 text-white font-normal">({delayTime.toFixed(1)}s)</span></h2>
            <input type="range" min="0.0" max="1.0" step="0.1" value={delayTime} onChange={(e) => setDelayTime(Number(e.target.value))} className="w-full accent-[#00F0FF] mb-4" />
            <p className="text-xs text-white/40 mt-auto leading-relaxed">Sets the time interval between the original sound and its repeating echoes.</p>
        </div>

        <div className="lg:col-span-3 bg-[#15171C] p-6 border border-white/10 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-6 text-[#FF007A]">Envelope (ADSR)</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold uppercase mb-2">Attack <span className="opacity-50 text-white font-normal">({adsr.a.toFixed(1)}s)</span></h3>
                    <input type="range" min="0.01" max="2" step="0.1" value={adsr.a} onChange={(e) => setAdsr({...adsr, a: Number(e.target.value)})} className="w-full accent-[#FF007A] mb-3" />
                    <p className="text-[11px] text-white/40 leading-relaxed mt-auto">Time taken for the sound to reach peak volume after a key is pressed.</p>
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold uppercase mb-2">Decay <span className="opacity-50 text-white font-normal">({adsr.d.toFixed(1)}s)</span></h3>
                    <input type="range" min="0.01" max="2" step="0.1" value={adsr.d} onChange={(e) => setAdsr({...adsr, d: Number(e.target.value)})} className="w-full accent-[#FF007A] mb-3" />
                    <p className="text-[11px] text-white/40 leading-relaxed mt-auto">Time taken for the volume to drop from peak to the sustain level.</p>
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold uppercase mb-2">Sustain <span className="opacity-50 text-white font-normal">({adsr.s.toFixed(2)})</span></h3>
                    <input type="range" min="0.01" max="1" step="0.01" value={adsr.s} onChange={(e) => setAdsr({...adsr, s: Number(e.target.value)})} className="w-full accent-[#FF007A] mb-3" />
                    <p className="text-[11px] text-white/40 leading-relaxed mt-auto">The constant volume level held while the key remains pressed down.</p>
                </div>
                <div className="flex flex-col">
                    <h3 className="text-sm font-bold uppercase mb-2">Release <span className="opacity-50 text-white font-normal">({adsr.r.toFixed(1)}s)</span></h3>
                    <input type="range" min="0.01" max="4" step="0.1" value={adsr.r} onChange={(e) => setAdsr({...adsr, r: Number(e.target.value)})} className="w-full accent-[#FF007A] mb-3" />
                    <p className="text-[11px] text-white/40 leading-relaxed mt-auto">Time taken for the sound to fade out completely after the key is released.</p>
                </div>
            </div>
        </div>
        
        <div className="bg-[#15171C] p-6 border border-white/10 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 text-white">Octave <span className="opacity-50 text-white font-normal">{octave > 0 ? `+${octave}` : octave}</span></h2>
            <div className="flex gap-4 mb-4">
                <button onClick={() => setOctave(o => o - 1)} className="flex-1 py-3 border border-white/10 text-white hover:bg-white/5 text-xl font-bold transition-colors">-</button>
                <button onClick={() => setOctave(o => o + 1)} className="flex-1 py-3 border border-white/10 text-white hover:bg-white/5 text-xl font-bold transition-colors">+</button>
            </div>
            <p className="text-xs text-white/40 mt-auto leading-relaxed">Shifts the pitch of the entire keyboard up or down by full octaves.</p>
        </div>
        
        <div className="bg-[#15171C] p-6 border border-white/10 flex flex-col justify-center gap-4 lg:col-span-2">
            <div className="flex gap-4">
                <button 
                    onClick={() => setIsLooping(!isLooping)}
                    className={`flex-1 px-6 py-4 uppercase font-bold text-sm tracking-widest transition-colors ${isLooping ? 'bg-[#FF007A] text-white' : 'bg-transparent border border-white/20 text-white/50 hover:border-white/40 hover:text-white'}`}
                >
                    {isLooping ? 'Loop: ON' : 'Loop: OFF'}
                </button>
                <button 
                    onClick={() => setIsInfinitePad(!isInfinitePad)}
                    className={`flex-1 px-6 py-4 uppercase font-bold text-sm tracking-widest transition-colors ${isInfinitePad ? 'bg-[#00F0FF] text-black' : 'bg-transparent border border-white/20 text-white/50 hover:border-white/40 hover:text-white'}`}
                >
                    {isInfinitePad ? 'Pad: ON' : 'Pad: OFF'}
                </button>
            </div>
            <p className="text-xs text-white/40 mt-2 leading-relaxed"><strong>Loop:</strong> Continuously replays notes. <strong>Pad:</strong> Infinite sustain mode that holds notes indefinitely until toggled off.</p>
        </div>
      </div>

      <div className="flex gap-2 w-full">
        {NOTES.map((note, idx) => (
            <button 
                key={note.name}
                onMouseDown={() => playNote(note.freq)}
                onMouseUp={() => !isInfinitePad && stopNote(note.freq * Math.pow(2, octave))}
                onMouseLeave={() => !isInfinitePad && stopNote(note.freq * Math.pow(2, octave))}
                className="flex-1 h-56 bg-[#15171C] text-[#E0E0E0] text-xl font-bold flex flex-col items-center justify-end pb-6 border border-[#FF007A] hover:bg-[#FF007A]/20 transition-colors relative"
            >
                <span className="mb-2">{note.name}</span>
                <span className="text-[10px] opacity-40 font-normal tracking-widest uppercase">Key {['a', 's', 'd', 'f', 'g', 'h', 'j'][idx]}</span>
            </button>
        ))}
      </div>
    </div>
  );
}
