import { ErrorMessage, Field, useFormikContext } from 'formik';

export default function ReportAdditionalDetails({ initialPlayer }) {
  const { values, errors, touched, isSubmitting } = useFormikContext();
  const ridResolved = Boolean(initialPlayer?.rid) || values.investigation_status === 'resolved';
  return <div className="rfm-panel mw-cyber-panel">
    <div className="cyber-tile mw-cyber-frame" aria-hidden="true" />
    <h3 className="rfm-panel__title cyber-h mw-cyber-heading">Datos adicionales</h3>
    <div className="rfm-field-row" style={{ marginBottom: '0.75rem' }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="rid" className="form-group__label">{ridResolved ? 'RID' : 'RID (opcional)'}</label>
        <div className="cyber-input-full mw-cyber-input">
          <Field type="text" id="rid" name="rid" aria-invalid={Boolean(touched.rid && errors.rid)}
            className="form-group__input" placeholder="ID numérico" autoComplete="off" disabled={isSubmitting || ridResolved} />
        </div>
        {ridResolved && <div className="form-group__hint">Cuenta asociada al reporte.</div>}
        <ErrorMessage name="rid" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="crews" className="form-group__label">Crews</label>
        <div className="cyber-input-full mw-cyber-input">
          <Field type="text" id="crews" name="crews" aria-invalid={Boolean(touched.crews && errors.crews)}
            className="form-group__input" placeholder="Separadas por coma" autoComplete="off" disabled={isSubmitting} />
        </div>
        <ErrorMessage name="crews" component="span" className="form-group__hint" style={{ color: '#ff3333' }} />
      </div>
    </div>
    <div className="form-group">
      <span id="report-aliases-label" className="form-group__label">Otros nombres conocidos</span>
      <p className="rfm-player-aliases notranslate" translate="no" aria-labelledby="report-aliases-label">{values.aliases || 'Sin otros nombres registrados.'}</p>
      <ErrorMessage name="aliases" component="span" className="form-group__hint" />
    </div>
  </div>;
}
