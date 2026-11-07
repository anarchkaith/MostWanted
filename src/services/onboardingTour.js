export const SAMPLE_PLAYER_NAME = 'JugadorEjemplo';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function buildSampleReport(playerName = SAMPLE_PLAYER_NAME) {
  return {
    nickname: playerName || SAMPLE_PLAYER_NAME,
    rid: '000000000',
    categories: ['Modder', 'Griffer'],
    reason: 'Ejemplo ficticio: usó un menú modificado para expulsar a otros jugadores de una sesión.',
    evidence: 'Captura con el menú abierto y el registro de la expulsión.',
    fictitious: true,
  };
}

function buildSampleReportPopover(sample) {
  return {
    title: 'Así se ve un reporte',
    description: `<strong>Jugador:</strong> ${escapeHtml(sample.nickname)}<br>`
      + `<strong>Infracciones:</strong> ${escapeHtml(sample.categories.join(', '))}<br>`
      + `<strong>Motivo:</strong> ${escapeHtml(sample.reason)}<br>`
      + `<strong>Evidencia:</strong> ${escapeHtml(sample.evidence)}<br>`
      + '<em>Ejemplo ficticio. No se guarda.</em>',
  };
}

export function buildPlayerTourSteps(playerName) {
  return [
    {
      element: '#report-player-title',
      popover: { title: 'Jugador', description: 'Aquí confirmas al jugador y completas los datos que el sistema ya conoce.' },
    },
    { popover: buildSampleReportPopover(buildSampleReport(playerName)) },
  ];
}

export function buildOnboardingSteps(playerName = SAMPLE_PLAYER_NAME) {
  return [
    {
      element: '.profile-identity',
      popover: { title: 'Tu cuenta', description: 'Aquí ves la sesión con la que iniciaste. Solo tú puedes consultar tus reportes.' },
    },
    {
      element: '#my-reports-title',
      popover: { title: 'Tus reportes', description: 'Cada reporte que envías aparece aquí como una tarjeta con el avatar del jugador.' },
    },
    { popover: buildSampleReportPopover(buildSampleReport(playerName)) },
  ];
}

export async function startOnboardingTour(steps = buildOnboardingSteps()) {
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);
  const tour = driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: 'Siguiente',
    prevBtnText: 'Anterior',
    doneBtnText: 'Entendido',
    steps: steps.map(step => step.element && !document.querySelector(step.element)
      ? { popover: step.popover }
      : step),
  });
  tour.drive();
  return tour;
}
