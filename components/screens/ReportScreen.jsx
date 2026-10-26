import ReportFormModal from '../ReportFormModal';
import TerminalText from '../ui/TerminalText';

export default function ReportScreen(formProps) {
  return (
    <main id="reportar" className="report-workspace">
      <div className="workspace-intro">
        <div>
          <h2 className="cyber-h"><TerminalText text="Registrar un reporte" /></h2>
        </div>
      </div>
      <ReportFormModal {...formProps} />
    </main>
  );
}
