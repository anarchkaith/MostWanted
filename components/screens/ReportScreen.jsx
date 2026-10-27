import ReportFormModal from '../ReportFormModal';
import SpecialText from '../ui/SpecialText';

export default function ReportScreen(formProps) {
  return (
    <main id="reportar" className="report-workspace">
      <div className="workspace-intro">
        <div>
          <h2 className="cyber-h"><SpecialText>Registrar un reporte</SpecialText></h2>
        </div>
      </div>
      <ReportFormModal {...formProps} />
    </main>
  );
}
