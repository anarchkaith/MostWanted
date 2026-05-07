import { getAssistantReply, requestAiGenerate } from '../client.js';
import { toSafeText } from '../utils.js';

function sanitizeClientReportes(reportes = []) {
  if (!Array.isArray(reportes)) return [];

  // Mantener datos útiles pero compactos para no saturar el contexto del modelo.
  return reportes
    .map((reporte) => ({
      id: reporte?.id ?? null,
      usuario: toSafeText(reporte?.usuario, ''),
      categoria: toSafeText(reporte?.categoria, ''),
      severidad: toSafeText(reporte?.severidad, ''),
      motivo: toSafeText(reporte?.motivo, '').slice(0, 180),
      fecha: toSafeText(reporte?.fecha, ''),
      validacion: toSafeText(reporte?.validacion, 'pendiente'),
      etiquetas: Array.isArray(reporte?.etiquetas) ? reporte.etiquetas.slice(0, 4) : [],
    }))
    .filter((reporte) => reporte.usuario);
}

function buildChatPrompt(messages, config, reportesContextText = '') {
  const systemLines = [
    `Eres ${config.assistantName}, un asistente virtual creado por ${config.creator}.`,
    `Contexto: ${config.appContext}.`,
    `Responde siempre en espanol con un tono ${config.tone}.`,
    config.extraInstructions,
    reportesContextText,
  ].filter(Boolean).join(' ');

  const history = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && typeof message === 'object')
    .map((message) => ({
      role: typeof message.role === 'string' ? message.role.trim() : '',
      content: typeof message.content === 'string' ? message.content.trim() : '',
    }))
    .filter((message) => message.role && message.role !== 'system' && message.content)
    .slice(-10)
    .map((message) => `${message.role === 'assistant' ? 'Asistente' : 'Usuario'}: ${message.content}`)
    .join('\n');

  return [systemLines, history, 'Asistente:'].filter(Boolean).join('\n');
}

function buildReportesContext({ reportes = [] }) {
  if (!Array.isArray(reportes) || reportes.length === 0) {
    return '';
  }

  const byCategoria = {};
  const bySeveridad = {};

  // Construir agregados por usuario para facilitar rankings y comparativas.
  const usuarioMap = {};
  for (const reporte of reportes) {
    const u = String(reporte?.usuario || '').trim();
    if (!u) continue;

    if (!usuarioMap[u]) {
      usuarioMap[u] = {
        usuario: u,
        totalReportes: 0,
        categorias: {},
        severidades: {},
        ultimaFecha: null,
      };
    }

    usuarioMap[u].totalReportes += 1;

    const cat = String(reporte?.categoria || 'sin_categoria').trim();
    usuarioMap[u].categorias[cat] = (usuarioMap[u].categorias[cat] || 0) + 1;
    byCategoria[cat] = (byCategoria[cat] || 0) + 1;

    const sev = String(reporte?.severidad || 'sin_severidad').trim();
    usuarioMap[u].severidades[sev] = (usuarioMap[u].severidades[sev] || 0) + 1;
    bySeveridad[sev] = (bySeveridad[sev] || 0) + 1;

    const fecha = String(reporte?.fecha || '').trim();
    if (fecha && (!usuarioMap[u].ultimaFecha || fecha > usuarioMap[u].ultimaFecha)) {
      usuarioMap[u].ultimaFecha = fecha;
    }
  }

  const usuariosRanking = Object.values(usuarioMap)
    .sort((a, b) => b.totalReportes - a.totalReportes);

  const reportesRecientes = [...reportes]
    .sort((a, b) => String(b?.fecha || '').localeCompare(String(a?.fecha || '')))
    .slice(0, 120)
    .map((r) => ({
      id: r?.id ?? null,
      usuario: String(r?.usuario || '').trim(),
      categoria: String(r?.categoria || '').trim(),
      severidad: String(r?.severidad || '').trim(),
      fecha: String(r?.fecha || '').trim(),
      motivo: String(r?.motivo || '').trim().slice(0, 120),
      etiquetas: Array.isArray(r?.etiquetas) ? r.etiquetas.slice(0, 3) : [],
    }));

  const contextData = {
    totalReportes: reportes.length,
    totalUsuariosUnicos: usuariosRanking.length,
    byCategoria,
    bySeveridad,
    usuariosRanking,
    reportesRecientes,
  };

  const rankingLines = usuariosRanking
    .slice(0, 20)
    .map((u, i) => {
      const cats = Object.entries(u.categorias).map(([k, v]) => `${k}:${v}`).join(', ');
      const sevs = Object.entries(u.severidades).map(([k, v]) => `${k}:${v}`).join(', ');
      return `${i + 1}. ${u.usuario} — ${u.totalReportes} reporte(s) | categorias: ${cats} | severidad: ${sevs} | ultima: ${u.ultimaFecha || 'desconocida'}`;
    })
    .join('\n');

  return `CONTEXTO DE BASE DE REPORTES (para análisis):
${JSON.stringify(contextData, null, 2)}

RANKING DE USUARIOS (ya calculado, úsalo directamente):
${rankingLines}

INSTRUCCIONES CRÍTICAS:
1. NOMBRES: Cuando se pida "top N usuarios", copia los nombres EXACTOS del RANKING DE USUARIOS de arriba. No los inventes.
2. DETALLES: Para cada usuario del ranking incluye nombre, totalReportes, categorias y severidades tal como aparecen.
3. NÚMEROS: Responde con cantidades EXACTAS del JSON. Nunca aproximes ni generalices.
4. ESTRUCTURA: Usa formato numerado. Ejemplo: "1. NombreUsuario — 3 reportes | modder:2, griffer:1"
5. SOLO DATOS: No inventes información. Usa únicamente el JSON y el RANKING brindados.
6. LIBERTAD: Haz cualquier análisis: rankings, estadísticas, comparaciones, búsquedas, filtrados, tendencias, correlaciones, etc.`;
}

export async function executeChatUseCase({ config, body, reportes = [] }) {
  const includeReportesDb = Boolean(body?.useReportesDb);
  const clientReportes = sanitizeClientReportes(body?.reportesContext?.reportes);
  const effectiveReportes = clientReportes.length > 0 ? clientReportes : reportes;

  const promptFromMessages = Array.isArray(body?.messages)
    ? buildChatPrompt(
      body.messages,
      config,
      includeReportesDb
        ? buildReportesContext({ reportes: effectiveReportes })
        : ''
    )
    : '';

  const prompt = promptFromMessages || toSafeText(body?.prompt, '');

  if (!prompt) {
    return {
      ok: false,
      status: 400,
      error: 'La consulta no contiene mensajes ni prompt valido.',
      details: 'Envia messages o prompt con contenido.',
    };
  }

  const upstreamPayload = {
    prompt,
    stream: typeof body?.stream === 'boolean' ? body.stream : false,
  };

  const upstreamResult = await requestAiGenerate({ config, payload: upstreamPayload, timeoutMs: 120000 });
  if (!upstreamResult.ok) {
    return upstreamResult;
  }

  return {
    ok: true,
    status: upstreamResult.status,
    payload: {
      response: getAssistantReply(upstreamResult.payload || {}),
    },
  };
}
