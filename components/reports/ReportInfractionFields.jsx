import { ErrorMessage, useFormikContext } from 'formik';
import TipoInfraccionSelector from '../TipoInfraccionSelector';
import EtiquetasSelector from '../EtiquetasSelector';
import { TIPOS_ETIQUETAS } from '../tiposEtiquetas';

export function ReportInfractionFields() {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  return <div className="rfm-panel mw-cyber-panel">
    <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
    <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Infracciones</h3>
    <p className="rfm-section-description">Puedes elegir varias.</p>
    <div className="form-group" style={{ marginBottom: 0 }}>
      <TipoInfraccionSelector value={values.typesOfInfraction}
        onChange={categories => { setFieldValue('typesOfInfraction', categories); setFieldValue('labels', []); }}
        options={TIPOS_ETIQUETAS} disabled={isSubmitting} />
      {values.typesOfInfraction.filter(category => !TIPOS_ETIQUETAS.some(type => type.key === category)).map(category =>
        <button key={category} type="button" className="threat-label" disabled={isSubmitting}
          onClick={() => { setFieldValue('typesOfInfraction', values.typesOfInfraction.filter(item => item !== category)); setFieldValue('labels', []); }}>
          {category} (histórica; quitar)
        </button>)}
      <ErrorMessage name="typesOfInfraction" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
    </div>
  </div>;
}

export function ReportBehaviorFields() {
  const { values, isSubmitting, setFieldValue } = useFormikContext();
  if (!values.typesOfInfraction.length) return null;
  return <div className="rfm-panel mw-cyber-panel">
    <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
    <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Conductas</h3>
    <EtiquetasSelector categorias={values.typesOfInfraction} etiquetas={values.labels}
      setFieldValue={setFieldValue} tiposEtiquetas={TIPOS_ETIQUETAS} disabled={isSubmitting} />
    {values.labels.filter(label => !TIPOS_ETIQUETAS.some(type => values.typesOfInfraction.includes(type.key)
      && type.etiquetas.some(item => item.nombre === label))).map(label =>
      <button key={label} type="button" className="threat-label" disabled={isSubmitting}
        onClick={() => setFieldValue('labels', values.labels.filter(item => item !== label))}>{label} (histórica; quitar)</button>)}
  </div>;
}
