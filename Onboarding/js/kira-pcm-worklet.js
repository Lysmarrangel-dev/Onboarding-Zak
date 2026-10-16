const TARGET_SAMPLE_RATE = 16000;
const FRAMES_PER_CHUNK = 1024; // ~64 ms a 16 kHz

class KiraPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};

    this.targetRate = opts.targetRate || TARGET_SAMPLE_RATE;
    this.chunkFrames = opts.chunkFrames || FRAMES_PER_CHUNK;

    // `sampleRate` es una variable global dentro del AudioWorkletGlobalScope.
    this.ratio = sampleRate / this.targetRate;

    this._out = new Int16Array(this.chunkFrames);
    this._outIndex = 0;

    // Posición fraccionaria dentro del stream de entrada, se conserva entre
    // llamadas a process() para que el remuestreo no "salte" en las costuras.
    this._readPos = 0;

    this._muted = false;
    this._lastLevelPost = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'mute') this._muted = !!data.value;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;

    const channel = input[0];
    const frames = channel.length;
    if (frames === 0) return true;

    // --- Nivel RMS (para la animación de plasma de la esfera) --------------
    let sumSquares = 0;
    for (let i = 0; i < frames; i++) sumSquares += channel[i] * channel[i];
    const rms = Math.sqrt(sumSquares / frames);

    const now = currentTime;
    if (now - this._lastLevelPost > 0.05) {
      this._lastLevelPost = now;
      this.port.postMessage({ type: 'level', value: Math.min(1, rms * 4) });
    }

    if (this._muted) {
      this._readPos = Math.max(0, this._readPos - frames);
      return true;
    }

    // --- Remuestreo lineal a 16 kHz + cuantización a Int16 -----------------
    let pos = this._readPos;

    while (pos < frames) {
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, frames - 1);
      const frac = pos - i0;

      let sample = channel[i0] * (1 - frac) + channel[i1] * frac;

      // Clamp antes de escalar: evita wrap-around de Int16 en picos.
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;

      this._out[this._outIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

      if (this._outIndex >= this.chunkFrames) {
        const copy = this._out.slice(0);
        this.port.postMessage({ type: 'pcm', buffer: copy.buffer }, [copy.buffer]);
        this._outIndex = 0;
      }

      pos += this.ratio;
    }

    // Arrastramos el resto fraccionario al siguiente bloque de 128 frames.
    this._readPos = pos - frames;

    return true;
  }
}

registerProcessor('kira-pcm-processor', KiraPcmProcessor);
