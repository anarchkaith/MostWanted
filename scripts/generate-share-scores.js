import fs from 'node:fs';
import { TIPOS_ETIQUETAS } from '../components/tiposEtiquetas.js';

const scores = Object.fromEntries(TIPOS_ETIQUETAS.flatMap(type =>
  type.etiquetas.map(label => [label.nombre, label.puntaje])));
fs.writeFileSync(new URL('../public/share-conduct-scores.json', import.meta.url), `${JSON.stringify(scores, null, 2)}\n`);
