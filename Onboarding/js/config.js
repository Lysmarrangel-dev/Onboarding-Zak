/**
 * Configuración de la app. Es el único archivo que hay que tocar al desplegar.
 * La URL del Apps Script es pública por diseño (no es una clave privada).
 */
export const CONFIG = {
  agentName: 'Kira',

  // URL de la aplicación web de Apps Script (termina en /exec). Ver docs/GUIA.md, paso 4.
  // Vacía = modo demostración: la app funciona completa pero no envía nada.
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbx4_h4UlxmrShKBTEGvVNYi9m_NyX0h7y4ZAb8j6N6xl2LvpE_VLHlbdfyKpaPLjjm3/exec',

  // Voz de Kira (la misma del CRM y del brochure), servida por el backend del CRM. Se usa cuando falta
  // el MP3 pregenerado de un texto. Vacía = esos textos usan la voz del navegador.
  // Ruta del mismo dominio: vercel.json la reenvía al backend en Easypanel (api.zak.ia.ve) (igual que el CRM y el brochure), sin CORS.
  kiraTtsUrl: '/api/kira/tts',

  // Kira responde las dudas del cliente con IA (mismo motor que el CRM y el brochure), por el mismo
  // rewrite de vercel.json. Vacía = las dudas se responden solo con config/faq.json.
  kiraChatUrl: '/api/kira/generate',

  // Conversación por voz con Kira (botón del micrófono): relay WebSocket del backend del CRM.
  // Vercel no reenvía WebSockets, por eso va directo al backend (api.zak.ia.ve). Vacía = sin botón de voz.
  kiraLiveUrl: 'wss://api.zak.ia.ve/api/kira/live',

  // Reintentos automáticos del envío (esperas en ms entre intentos).
  retryDelays: [1000, 3000, 6000],
  requestTimeoutMs: 30000,
  uploadTimeoutMs: 120000,

  // Clave de guardado local del progreso.
  storageKey: 'zak-onboarding-v1',

  // Ritmo del indicador «escribiendo…» (ms). Se anula con prefers-reduced-motion.
  typingDelayMs: 650,

  // Presentación audiovisual de bienvenida (primer mensaje del chat).
  intro: {
    enabled: true,
    voice: true,        // narración con la voz de Kira; el cliente puede silenciarla
    // Si producen un video (p. ej. con el avatar), pon su URL aquí y reemplaza la animación:
    videoSrc: '',       // 'assets/video/intro-zak.mp4'
    videoPoster: '',    // imagen de portada opcional
    captionsSrc: '',    // subtítulos .vtt opcionales
  },
};
