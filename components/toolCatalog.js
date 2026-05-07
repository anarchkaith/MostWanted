/**
 * Catálogo de herramientas de IA
 * Cada herramienta define su propia configuración siguiendo principios SOLID
 */

const TOOL_CATALOG = {
  general_response: {
    id: 'general_response',
    label: 'Preparando respuesta',
    description: 'Responde preguntas generales',
    category: 'general',
  },
  read_all_reports: {
    id: 'read_all_reports',
    label: 'Consultando base de reportes',
    description: 'Lee y analiza todos los reportes disponibles',
    category: 'reports',
  },
  get_report_detail: {
    id: 'get_report_detail',
    label: 'Buscando reporte específico',
    description: 'Obtiene detalles específicos de un reporte',
    category: 'reports',
  },
  analyze_recent_similarity: {
    id: 'analyze_recent_similarity',
    label: 'Analizando similitud de reportes',
    description: 'Analiza la similitud entre reportes recientes',
    category: 'analysis',
  },
};

/**
 * Obtiene una herramienta del catálogo
 * @param {string} toolId - Identificador de la herramienta
 * @returns {object} Configuración de la herramienta o herramienta por defecto
 */
export const getTool = (toolId) => {
  return TOOL_CATALOG[toolId] || TOOL_CATALOG.general_response;
};

/**
 * Obtiene el label/etiqueta de una herramienta
 * @param {string} toolId - Identificador de la herramienta
 * @returns {string} Label legible de la herramienta
 */
export const getToolLabel = (toolId) => {
  return getTool(toolId).label;
};

/**
 * Obtiene todas las herramientas del catálogo
 * @returns {object} Todas las herramientas disponibles
 */
export const getAllTools = () => TOOL_CATALOG;

/**
 * Verifica si una herramienta existe en el catálogo
 * @param {string} toolId - Identificador de la herramienta
 * @returns {boolean} True si la herramienta existe
 */
export const toolExists = (toolId) => Boolean(TOOL_CATALOG[toolId]);

/**
 * Obtiene herramientas por categoría
 * @param {string} category - Categoría de herramientas
 * @returns {object[]} Array de herramientas de la categoría
 */
export const getToolsByCategory = (category) => {
  return Object.values(TOOL_CATALOG).filter((tool) => tool.category === category);
};

export default TOOL_CATALOG;
