/**
 * Catálogo de herramientas de IA - Lado Servidor
 * Sincronizado con el frontend para mantener consistencia
 */

const TOOL_CATALOG = {
  general_response: {
    id: 'general_response',
    constant: 'GENERAL_RESPONSE',
    label: 'Preparando respuesta',
    description: 'Responde preguntas generales',
    category: 'general',
  },
  read_all_reports: {
    id: 'read_all_reports',
    constant: 'READ_ALL_REPORTS',
    label: 'Consultando base de reportes',
    description: 'Lee y analiza todos los reportes disponibles',
    category: 'reports',
  },
  get_report_detail: {
    id: 'get_report_detail',
    constant: 'GET_REPORT_DETAIL',
    label: 'Buscando reporte específico',
    description: 'Obtiene detalles específicos de un reporte',
    category: 'reports',
  },
  analyze_recent_similarity: {
    id: 'analyze_recent_similarity',
    constant: 'ANALYZE_RECENT_SIMILARITY',
    label: 'Analizando similitud de reportes',
    description: 'Analiza la similitud entre reportes recientes',
    category: 'analysis',
  },
};

/**
 * Set de herramientas válidas para validación rápida
 */
const ALLOWED_TOOLS = new Set(Object.keys(TOOL_CATALOG));

/**
 * Obtiene una herramienta del catálogo
 * @param {string} toolId - Identificador de la herramienta
 * @returns {object|null} Configuración de la herramienta o null
 */
export const getTool = (toolId) => {
  return TOOL_CATALOG[toolId] || null;
};

/**
 * Valida si una herramienta existe en el catálogo
 * @param {string} toolId - Identificador de la herramienta
 * @returns {boolean} True si la herramienta existe
 */
export const isValidTool = (toolId) => {
  return ALLOWED_TOOLS.has(toolId);
};

/**
 * Obtiene todas las herramientas del catálogo
 * @returns {object} Todas las herramientas disponibles
 */
export const getAllTools = () => TOOL_CATALOG;

/**
 * Obtiene herramientas por categoría
 * @param {string} category - Categoría de herramientas
 * @returns {object} Herramientas de la categoría
 */
export const getToolsByCategory = (category) => {
  return Object.values(TOOL_CATALOG).reduce((acc, tool) => {
    if (tool.category === category) {
      acc[tool.id] = tool;
    }
    return acc;
  }, {});
};

export { ALLOWED_TOOLS };
export default TOOL_CATALOG;
