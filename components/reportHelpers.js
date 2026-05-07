import { getPuntajeEtiquetas } from './tiposEtiquetas';

const severidadMap = { baja: 1, media: 2, alta: 3, critica: 4, inviable: 5 };
export const mapSeveridad = (valor = '') => severidadMap[valor.toLowerCase()] || 2;

const PUNTAJE_ETIQUETAS = getPuntajeEtiquetas();

/**
 * Calcula la severidad sugerida según categorías y etiquetas seleccionadas.
 * - Cada etiqueta suma su puntaje (o 1 si no está definida).
 * - Cada categoría suma 2 puntos.
 * - Los umbrales determinan el nivel de severidad.
 * @param {string[]} categorias
 * @param {string[]} etiquetas
 * @returns {{ nivel: string, puntaje: number }}
 */
export const calcularSeveridadSugerida = (categorias, etiquetas) => {
  const puntajeEtiquetas = etiquetas.reduce((acc, e) => acc + (PUNTAJE_ETIQUETAS[e] || 1), 0);
  const puntajeCategorias = (categorias?.length || 0) * 2;
  const puntaje = puntajeEtiquetas + puntajeCategorias;

  const niveles = [
    { nivel: 'inviable', umbral: 14 },
    { nivel: 'critica', umbral: 10 },
    { nivel: 'alta', umbral: 7 },
    { nivel: 'media', umbral: 4 },
    { nivel: 'baja', umbral: 0 }
  ];
  const { nivel } = niveles.find(n => puntaje >= n.umbral);
  return { nivel, puntaje };
};
