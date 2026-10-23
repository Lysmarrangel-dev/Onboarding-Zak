/**
 * Conversación por voz con Kira (Gemini Live), la misma del CRM y del brochure.
 *
 * - Va por el relay WebSocket del backend del CRM (/api/kira/live en api.zak.ia.ve). Vercel no reenvía
 *   WebSockets, por eso la URL apunta directo al backend (api.zak.ia.ve) (CONFIG.kiraLiveUrl). El relay fija la voz
 *   «Aoede» y la clave de Gemini nunca llega al navegador.
 * - El micrófono se captura a 16 kHz con js/kira-pcm-worklet.js (copia del brochure) y la voz de
 *   Kira llega en PCM 24 kHz.
 * - Herramientas (js/kiraWidget.js → app.js): leer la pregunta en pantalla, llenar sus campos con lo
 *   que dice el cliente, enviar la respuesta, leer el acuerdo de confidencialidad y end_conversation.
 *
 * Es una versión en JS de brochure/src/kira.ts (repo itech-crm); si allá cambia el modelo Live o
 * el formato de audio, cambiarlo también acá.
 */
import { CONFIG } from './config.js';

const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SETUP_TIMEOUT_MS = 9000;
const PLAYBACK_LEAD_S = 0.12; // colchón al arrancar cada respuesta (el relay llega con algo de vaivén)

function int16ToBase64(pcm) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToInt16(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

function audioContext(sampleRate) {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  try { return new Ctor({ sampleRate, latencyHint: 'interactive' }); } catch { return new Ctor(); }
}

export const voiceSupported = () =>
  Boolean(CONFIG.kiraLiveUrl && navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext) && 'WebSocket' in window);

/** Reproduce PCM 24 kHz en cola, sin huecos entre fragmentos. */
class PcmPlayer {
  constructor(onDrain, onLevel) {
    this.onDrain = onDrain; this.onLevel = onLevel;
    this.ctx = null; this.nextStart = 0; this.active = new Set();
  }

  async ensure() {
    if (!this.ctx || this.ctx.state === 'closed') { this.ctx = audioContext(OUTPUT_SAMPLE_RATE); this.nextStart = 0; }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  get playing() { return this.active.size > 0; }

  async enqueue(pcm) {
    if (!pcm.length) return;
    const ctx = await this.ensure();
    const buffer = ctx.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
    const ch = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) { ch[i] = pcm[i] / 32768; sum += ch[i] * ch[i]; }
    this.onLevel(Math.min(1, Math.sqrt(sum / pcm.length) * 5));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const at = this.nextStart > ctx.currentTime + 0.01 ? this.nextStart : ctx.currentTime + PLAYBACK_LEAD_S;
    src.start(at);
    this.nextStart = at + buffer.duration;
    this.active.add(src);
    src.onended = () => { this.active.delete(src); if (!this.active.size) this.onDrain(); };
  }

  interrupt() {
    this.active.forEach((s) => { try { s.stop(); } catch { /* ya terminó */ } });
    this.active.clear();
    this.nextStart = 0;
  }

  async close() {
    this.interrupt();
    try { await this.ctx?.close(); } catch { /* nada */ }
    this.ctx = null;
  }
}

/**
 * opts: { systemInstruction, functionDeclarations, tools: { nombre: (args) => resultado },
 *         onState(estado), onUserText(texto, final), onKiraText(texto, final), onLevel(0..1), onNotice(mensaje) }
 * Estados: idle · connecting · listening · thinking · speaking
 */
export class KiraLive {
  constructor(opts) {
    this.opts = opts;
    this.state = 'idle';
    this.ws = null; this.stream = null; this.micCtx = null; this.micNode = null;
    this.turnText = ''; this.userText = ''; this.pendingHangup = false; this.turnDone = true;
    this.player = new PcmPlayer(() => this.onPlayerDrain(), (l) => this.opts.onLevel(l));
  }

  get live() { return this.ws?.readyState === WebSocket.OPEN; }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState(s);
    if (s !== 'speaking' && s !== 'listening') this.opts.onLevel(0);
  }

  /** Abre la sesión de voz. Llamar dentro del clic (el navegador exige el gesto para el audio). */
  async start(greeting) {
    if (this.state !== 'idle') return this.live;
    this.setState('connecting');
    await this.player.ensure();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch {
      this.setState('idle');
      this.opts.onNotice('Sin acceso al micrófono. Revisa el permiso del navegador o escríbele a Kira.');
      return false;
    }
    if (!(await this.connect())) {
      this.releaseMic();
      this.setState('idle');
      this.opts.onNotice('La voz de Kira no está disponible ahora mismo. Escríbele y te responde por texto.');
      return false;
    }
    // El saludo sale antes de montar el micrófono (cargar el worklet tarda).
    this.setState('listening');
    if (greeting) this.sendJson({ realtimeInput: { text: greeting } });
    try { await this.startCapture(); } catch { /* se cerró la voz mientras se montaba el micrófono */ }
    return true;
  }

  connect() {
    return new Promise((resolve) => {
      let settled = false;
      let ws;
      try { ws = new WebSocket(CONFIG.kiraLiveUrl); } catch { resolve(false); return; }
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!ok) { try { ws.close(); } catch { /* nada */ } }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), SETUP_TIMEOUT_MS);
      ws.onopen = () => ws.send(JSON.stringify(this.setupPayload()));
      ws.onmessage = async (ev) => {
        const raw = typeof ev.data === 'string' ? ev.data : await ev.data.text();
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (!settled) {
          if (msg.setupComplete) { this.ws = ws; finish(true); }
          return;
        }
        this.handleServerMessage(msg);
      };
      ws.onerror = () => finish(false);
      ws.onclose = () => {
        if (!settled) { finish(false); return; }
        if (this.ws === ws) { this.ws = null; this.stop(); }
      };
    });
  }

  setupPayload() {
    return {
      setup: {
        model: `models/${LIVE_MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          temperature: 0.7,
          speechConfig: { languageCode: 'es-US', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
        },
        systemInstruction: { parts: [{ text: this.opts.systemInstruction }] },
        tools: [{ functionDeclarations: this.opts.functionDeclarations }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
            endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
            prefixPaddingMs: 20,
            silenceDurationMs: 450,
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
        },
        contextWindowCompression: { slidingWindow: {} },
      },
    };
  }

  handleServerMessage(msg) {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this.player.interrupt();
        if (this.pendingHangup) { this.stop(); return; }
        this.setState('listening');
      }
      if (sc.inputTranscription?.text) {
        this.userText += sc.inputTranscription.text;
        this.opts.onUserText(this.userText, false);
      }
      if (sc.outputTranscription?.text) {
        this.flushUserText();
        this.turnText += sc.outputTranscription.text;
        this.opts.onKiraText(this.turnText, false);
      }
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data && String(part.inlineData.mimeType || '').startsWith('audio/')) {
          this.turnDone = false;
          this.setState('speaking');
          this.player.enqueue(base64ToInt16(part.inlineData.data));
        }
      }
      if (sc.turnComplete || sc.generationComplete) {
        this.flushUserText();
        if (this.turnText) this.opts.onKiraText(this.turnText, true);
        this.turnText = '';
        this.turnDone = true;
        if (!this.player.playing) this.onPlayerDrain();
      }
    }
    if (msg.toolCall?.functionCalls?.length) {
      const functionResponses = msg.toolCall.functionCalls.map((call) => ({
        id: call.id, name: call.name, response: this.runTool(call.name, call.args || {}),
      }));
      this.sendJson({ toolResponse: { functionResponses } });
    }
  }

  flushUserText() {
    if (!this.userText) return;
    this.opts.onUserText(this.userText, true);
    this.userText = '';
  }

  onPlayerDrain() {
    if (!this.turnDone) return;
    if (this.pendingHangup) { this.stop(); return; }
    if (this.live) this.setState('listening');
  }

  async startCapture() {
    if (!this.stream) return;
    this.micCtx = audioContext(INPUT_SAMPLE_RATE);
    if (this.micCtx.state === 'suspended') await this.micCtx.resume();
    const source = this.micCtx.createMediaStreamSource(this.stream);
    const send = (pcm) => this.sendJson({ realtimeInput: { audio: { data: int16ToBase64(pcm), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } } });
    const level = (l) => { if (this.state === 'listening') this.opts.onLevel(l); };
    try {
      await this.micCtx.audioWorklet.addModule(new URL('./kira-pcm-worklet.js', import.meta.url).href);
      const node = new AudioWorkletNode(this.micCtx, 'kira-pcm-processor', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { targetRate: INPUT_SAMPLE_RATE },
      });
      node.port.onmessage = (e) => {
        if (e.data.type === 'pcm') send(new Int16Array(e.data.buffer));
        else if (e.data.type === 'level') level(e.data.value);
      };
      this.micNode = node;
    } catch {
      // Navegadores sin AudioWorkletNode: remuestreo en el hilo principal.
      const node = this.micCtx.createScriptProcessor(2048, 1, 1);
      const ratio = this.micCtx.sampleRate / INPUT_SAMPLE_RATE;
      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        level(Math.min(1, Math.sqrt(sum / input.length) * 4));
        const out = new Int16Array(Math.floor(input.length / ratio));
        for (let i = 0; i < out.length; i++) {
          const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
          out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        send(out);
      };
      this.micNode = node;
    }
    source.connect(this.micNode);
    const mute = this.micCtx.createGain();
    mute.gain.value = 0;
    this.micNode.connect(mute);
    mute.connect(this.micCtx.destination);
  }

  releaseMic() {
    try { this.micNode?.disconnect(); } catch { /* nada */ }
    if (this.micNode?.port) this.micNode.port.onmessage = null;
    this.micNode = null;
    this.micCtx?.close().catch(() => {});
    this.micCtx = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  /** Cierra la sesión de voz (botón «Terminar», end_conversation o al salir del chat). */
  stop() {
    this.pendingHangup = false;
    const ws = this.ws;
    this.ws = null;
    try { ws?.close(1000, 'fin'); } catch { /* nada */ }
    this.releaseMic();
    this.player.interrupt();
    this.flushUserText();
    if (this.turnText) this.opts.onKiraText(this.turnText, true);
    this.turnText = '';
    this.turnDone = true;
    this.setState('idle');
  }

  /** Texto escrito en plena llamada: Kira lo contesta con voz en la misma conversación. */
  sendText(text) {
    if (!this.live) return;
    this.player.interrupt();
    this.sendJson({ realtimeInput: { text } });
    this.setState('thinking');
  }

  sendJson(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  runTool(name, args) {
    if (name === 'end_conversation') {
      this.pendingHangup = true;
      return { result: { ok: true, message: 'Despídete en una frase corta; la voz se cierra al terminar.' } };
    }
    const handler = this.opts.tools[name];
    if (!handler) return { error: `La acción «${name}» no existe en el onboarding.` };
    try { return { result: handler(args) ?? { ok: true } }; } catch (err) { return { error: err?.message || 'No se pudo ejecutar.' }; }
  }
}
