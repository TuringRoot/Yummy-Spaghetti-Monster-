
// A self-contained Web Audio API engine for procedural music and SFX
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private currentIntervals: number[] = [];
  private isMuted: boolean = false;
  private brownNoiseLastOut: number = 0;

  constructor() {
    // Lazy init handled in init()
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Master volume
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  stopAll() {
    this.currentOscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    this.currentOscillators = [];
    this.currentIntervals.forEach(i => clearInterval(i));
    this.currentIntervals = [];
  }

  // --- SOUND EFFECTS ---

  playSFX(type: 'click' | 'catch' | 'miss' | 'spray' | 'explosion' | 'gift' | 'switch') {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Default connection usually overridden below
    osc.connect(gain);
    gain.connect(this.masterGain);

    // Lower default SFX volume (0.2 max instead of 0.5)
    const vol = 0.2;

    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case 'catch':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.linearRampToValueAtTime(1800, t + 0.1);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
      case 'miss':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      case 'spray':
        // Wet Squeeze Sound: Filtered Brown Noise
        const bufferSize = this.ctx.sampleRate * 0.3; // Longer duration
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (this.brownNoiseLastOut + (0.02 * white)) / 1.02; // Brown noise approximation
            this.brownNoiseLastOut = data[i];
            data[i] *= 3.5; // Gain up
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 1;
        filter.frequency.setValueAtTime(800, t); // Start open
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.25); // Close tight (thud)
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        
        noise.start(t);
        break;
      case 'explosion':
        // Deep rumble + noise - Keep this relatively loud for impact
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 1);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
        osc.start(t);
        osc.stop(t + 2);
        break;
      case 'gift':
        // Fanfare - Pleasant chime
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
        notes.forEach((freq, i) => {
             const o = this.ctx!.createOscillator();
             const g = this.ctx!.createGain();
             o.type = 'sine';
             o.frequency.value = freq;
             o.connect(g);
             g.connect(this.masterGain!);
             g.gain.setValueAtTime(0.15, t + i * 0.08);
             g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.6);
             o.start(t + i * 0.08);
             o.stop(t + i * 0.08 + 0.6);
        });
        break;
       case 'switch':
         osc.type = 'sine';
         osc.frequency.setValueAtTime(400, t);
         osc.frequency.linearRampToValueAtTime(600, t + 0.1);
         gain.gain.setValueAtTime(0.1, t);
         gain.gain.linearRampToValueAtTime(0.001, t + 0.15);
         osc.start(t);
         osc.stop(t + 0.15);
         break;
    }
  }

  // --- BGM THEMES ---

  playTheme(stage: string) {
    this.stopAll();
    if (!this.ctx || !this.masterGain) return;

    if (stage === 'INTRO') {
        // Ethereal Drone
        this.createDrone([261.63, 392.00], 'sine', 0.1); // C4, G4
    } 
    else if (stage === 'COOKING') {
        // More varied, fun 8-bit kitchen beat
        const bassFreq = 110;
        // Pentatonic scale pattern
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; 
        let step = 0;
        
        const interval = window.setInterval(() => {
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            
            // Bass line changes every 8 steps
            const currentRoot = (Math.floor(step / 8) % 2 === 0) ? bassFreq : bassFreq * 0.75; // A then F roughly

            if (step % 2 === 0) {
                this.playTone(currentRoot, 'square', 0.08, 0.1, t);
            } else {
                this.playTone(currentRoot * 2, 'square', 0.04, 0.1, t);
            }
            
            // Melody - Semi random but constrained
            if (step % 4 === 0 || Math.random() > 0.4) {
                const noteIdx = Math.floor(Math.random() * scale.length);
                const note = scale[noteIdx];
                this.playTone(note, 'triangle', 0.06, 0.15, t);
            }
            
            step++;
        }, 180); // Slightly faster
        this.currentIntervals.push(interval);
    }
    else if (stage === 'FEEDING') {
         // Fast-paced, varied tension
        let step = 0;
        const interval = window.setInterval(() => {
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            
            // Driving bass - Alternating octaves
            const bassNote = 110; 
            this.playTone(step % 2 === 0 ? bassNote : bassNote * 2, 'sawtooth', 0.08, 0.1, t);
            
            // Hi-hats
            if (step % 2 === 0) {
                 this.playTone(800 + Math.random()*200, 'square', 0.03, 0.03, t);
            }

            // High Arpeggio Alarm (Melodic)
            if (step % 4 === 0) {
                this.playTone(523.25 + (step % 16) * 20, 'sine', 0.05, 0.1, t);
            }

            step++;
        }, 110);
        this.currentIntervals.push(interval);
    }
    else if (stage === 'EXPLOSION') {
        // Intense transition
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        // Rising pitch sweep
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 3);
        
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 2.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
        
        osc.start();
        
        // Tremolo for shaking effect
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 15; // Fast shake
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();

        this.currentOscillators.push(osc, lfo);
    }
    else if (stage === 'AFTERMATH') {
        // Quiet, pure space drone. No noise.
        this.createDrone([110, 164.81], 'sine', 0.15); // A2, E3 - harmonics
        
        // Sparse Sparkles (Star chimes)
        const scale = [523.25, 659.25, 783.99, 987.77, 1046.50]; // C Major Pentatonic
        const interval = window.setInterval(() => {
             if (!this.ctx || Math.random() > 0.3) return; // Less frequent
             const note = scale[Math.floor(Math.random() * scale.length)] * (Math.random() > 0.5 ? 2 : 4);
             const t = this.ctx.currentTime;
             
             // Very soft envelope
             const osc = this.ctx.createOscillator();
             const gain = this.ctx.createGain();
             osc.type = 'sine'; // Pure sine
             osc.frequency.value = note;
             osc.connect(gain);
             gain.connect(this.masterGain!);
             
             gain.gain.setValueAtTime(0, t);
             gain.gain.linearRampToValueAtTime(0.08, t + 0.2); // Soft attack
             gain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); // Very long tail
             
             osc.start(t);
             osc.stop(t + 4.0);
        }, 400);
        this.currentIntervals.push(interval);
    }
  }

  // --- HELPERS ---

  private playTone(freq: number, type: OscillatorType, vol: number, dur: number, time: number) {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      osc.connect(gain);
      gain.connect(this.masterGain);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.start(time);
      osc.stop(time + dur);
  }

  private createDrone(freqs: number[], type: OscillatorType, vol: number) {
      if (!this.ctx || !this.masterGain) return;
      freqs.forEach(f => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = type;
          osc.frequency.value = f;
          osc.connect(gain);
          gain.connect(this.masterGain!);
          gain.gain.value = vol / freqs.length;
          osc.start();
          this.currentOscillators.push(osc);
      });
  }
}

export const audio = new AudioEngine();
