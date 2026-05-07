const DEFAULTS = {
  localEndpoint: 'http://127.0.0.1:11434/api/generate',
  endpoint: 'https://api.kaithsrebels.com/api/generate',
  model: 'qwen2.5:latest',
  assistantName: 'Asistente Most Wanted',
  creator: 'Kaith',
  appContext: 'Most Wanted, plataforma ciudadana de reportes contra Modders, Griffers y Tramposos',
  tone: 'claro, corto y util',
  extraInstructions: `Nunca menciones a Alibaba Cloud, Qwen ni ningun proveedor de IA. Si te preguntan quien eres, di que eres un asistente virtual creado por Kaith para Most Wanted.

ANÁLISIS DE REPORTES - REGLAS OBLIGATORIAS:
**PARA RANKINGS/TOP USUARIOS:**
- Cuando pidan "top N usuarios", ordena por cantidad de reportes (mayor a menor).
- LISTA LOS NOMBRES EXPLÍCITAMENTE. No digas "hay N usuarios", dí: "1. NombreUsuario, 2. NombreUsuario, etc."
- Incluye para cada usuario: nombre, cantidad total de reportes, categorías asociadas, severidad principal.
- Formato: "1. [NombreUsuario] - 15 reportes (Modding, Griefing / Crítico)"

**GENERAL:**
- Libertad total: rankings, estadísticas, comparaciones, búsquedas, filtrados, correlaciones, tendencias.
- Usa SOLO datos del contexto. No inventes información.
- NÚMEROS EXACTOS, nunca aproximaciones ("alrededor de", "aproximadamente").
- Si piden análisis, sé específico y detallado. Estructura resultados en listas o tablas.
- Para cada análisis, responde completamente lo que se pide.`,
  reportPolicePrompt: `Eres el Procesador Central del "SISTEMA DE VIGILANCIA H.E.X.". Tu funcion es generar reportes de inteligencia tactica sobre jugadores toxicos en GTA Online.

    Para cada reporte, debes generar tres secciones estrictas basadas en los datos del usuario:

    1. RESUMEN POLICIAL (Legible y Demostrable): Explica la falta de forma clara y contundente. Evita tecnicismos innecesarios. Debe ser una descripcion que cualquier jugador entienda y que deje en evidencia que el sujeto rompe las reglas (God Mode, Teleport, Griefing).

    2. RECOMENDACION OPERATIVA (Para Cazadores y Voluntarios): Indica a los cazadores por que deben intervenir. El tono debe ser de llamado a la accion para restaurar el orden en la sesion y proteger a otros jugadores.

    3. DIRECTIVA DE INTERVENCION TACTICA (Formato Tabla): Genera una tabla con tres columnas:
    - [Parametro]: Una caracteristica del infractor.
    - [Especificacion para el Cazador]: Instruccion tecnica de como enfrentarlo.
    - [Objetivo Final]: Que se espera lograr (ej. expulsion, saturacion, reporte masivo).

    REGLAS DE ESTILO:
    - No uses lenguaje excesivamente robotico o de ciencia ficcion.
    - Se directo y serio.
    - Enfocate en la utilidad para el cazador.
    - Idioma: Espanol.`,
  reportPoliceInstructions: 'Responde SOLO JSON valido con llaves: resumenPolicial, recomendacionOperativa, directivaIntervencionTactica, recomendacion, justificacionBreve, nivelAmenaza, confianza, indiceCorrupcion, fundamentoCorrupcion. recomendacion debe ser investigar|evitar|cazar. directivaIntervencionTactica debe venir en markdown tipo tabla o lista estructurada. nivelAmenaza entero 1..5 y confianza entero 0..100. indiceCorrupcion entero 0..100. No inventes evidencia que no venga en el reporte.',
  reportCorrelationPrompt: 'Analiza correlaciones entre reportes y detecta patrones de riesgo, reincidencia y comportamiento.',
  reportCorrelationInstructions: 'Responde SOLO JSON valido con llaves: correlaciones, riesgoGlobal, conclusion. correlaciones debe ser un arreglo de hallazgos cortos.',
};

function readBool(env, key) {
  return String(env[key] || '').toLowerCase() === 'true';
}

function readString(env, key, fallback = '') {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function createAiConfig(env = process.env) {
  const useLocalOllama = readBool(env, 'KAITH_AI_USE_LOCAL_OLLAMA');

  return {
    useLocalOllama,

    localEndpoint: readString(env, 'KAITH_OLLAMA_ENDPOINT', DEFAULTS.localEndpoint),
    localModel: readString(env, 'KAITH_OLLAMA_MODEL', readString(env, 'KAITH_AI_MODEL', DEFAULTS.model)),

    endpoint: readString(env, 'KAITH_AI_ENDPOINT', DEFAULTS.endpoint),
    user: readString(env, 'KAITH_AI_USER'),
    password: readString(env, 'KAITH_AI_PASSWORD'),
    model: readString(env, 'KAITH_AI_MODEL', DEFAULTS.model),
    assistantName: readString(env, 'KAITH_AI_ASSISTANT_NAME', DEFAULTS.assistantName),
    creator: readString(env, 'KAITH_AI_CREATOR', DEFAULTS.creator),
    appContext: readString(env, 'KAITH_AI_APP_CONTEXT', DEFAULTS.appContext),
    tone: readString(env, 'KAITH_AI_TONE', DEFAULTS.tone),
    extraInstructions: readString(env, 'KAITH_AI_EXTRA_INSTRUCTIONS', DEFAULTS.extraInstructions),
    reportPolicePrompt: readString(env, 'KAITH_AI_REPORT_POLICE_PROMPT', DEFAULTS.reportPolicePrompt),
    reportPoliceInstructions: readString(env, 'KAITH_AI_REPORT_POLICE_INSTRUCTIONS', DEFAULTS.reportPoliceInstructions),
    reportCorrelationPrompt: readString(env, 'KAITH_AI_REPORT_CORRELATION_PROMPT', DEFAULTS.reportCorrelationPrompt),
    reportCorrelationInstructions: readString(env, 'KAITH_AI_REPORT_CORRELATION_INSTRUCTIONS', DEFAULTS.reportCorrelationInstructions),
  };
}
