import { useEffect, useRef, useState } from 'react';
import { useFormikContext } from 'formik';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';
import { suggestInfractionsFromText } from '../../src/services/reportKeywords.js';

export default function ReportInfractionPreload({ active }) {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  const [applied, setApplied] = useState(null);
  const lastReasonRef = useRef(null);
  const reason = String(values.reason || '').trim();

  useEffect(() => {
    if (!active || isSubmitting || values.typesOfInfraction.length > 0 || values.labels.length > 0) return;
    if (lastReasonRef.current === reason) return;
    lastReasonRef.current = reason;
    const { categories, labels } = suggestInfractionsFromText(reason, TIPOS_ETIQUETAS);
    if (!categories.length && !labels.length) return;
    setFieldValue('typesOfInfraction', [...values.typesOfInfraction, ...categories]);
    setFieldValue('labels', [...values.labels, ...labels]);
    setApplied({ categories, labels });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reason, isSubmitting]);

  if (!applied) return null;

  const total = applied.categories.length + applied.labels.length;
  const undo = () => {
    setFieldValue('typesOfInfraction', values.typesOfInfraction.filter(key => !applied.categories.includes(key)));
    setFieldValue('labels', values.labels.filter(label => !applied.labels.includes(label)));
    setApplied(null);
  };

  return <div className="infraction-preload" role="status">
    <p>HEX marcó {total} según tu relato. Desmarca lo que no corresponda.</p>
    <button type="button" className="infraction-preload__undo" onClick={undo}>Deshacer</button>
  </div>;
}
