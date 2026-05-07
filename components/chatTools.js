/**
 * Exportador centralizado de todas las herramientas y utilidades del chat
 * Sigue el patrón Facade para simplificar las importaciones
 */

export { 
  getTool, 
  getToolLabel, 
  getAllTools, 
  toolExists, 
  getToolsByCategory 
} from './toolCatalog';

export {
  readReportesFromLocalStorage,
  buildReportesChatContext
} from './reportesChatContext';
