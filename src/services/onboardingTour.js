export const SAMPLE_PLAYER_NAME = 'JugadorEjemplo';

export function buildSampleReport() {
  return {
    nickname: SAMPLE_PLAYER_NAME,
    rid: '000000000',
    categories: ['Modder', 'Griffer'],
    reason: 'Ejemplo ficticio: usó un menú modificado para expulsar a otros jugadores de una sesión.',
    evidence: 'Captura con el menú abierto y el registro de la expulsión.',
    fictitious: true,
  };
}

export function buildOnboardingSteps() {
  const sample = buildSampleReport();
  return [
    {
      element: '.profile-identity',
      popover: { title: 'Tu cuenta', description: 'Aquí ves la sesión con la que iniciaste. Solo tú puedes consultar tus reportes.' },
    },
    {
      element: '#my-reports-title',
      popover: { title: 'Tus reportes', description: 'Cada reporte que envías aparece aquí como una tarjeta con el avatar del jugador.' },
    },
    {
      popover: {
        title: 'Así se ve un reporte',
        description: `<strong>Jugador:</strong> ${sample.nickname}<br>`
          + `<strong>Infracciones:</strong> ${sample.categories.join(', ')}<br>`
          + `<strong>Motivo:</strong> ${sample.reason}<br>`
          + `<strong>Evidencia:</strong> ${sample.evidence}<br>`
          + '<em>Ejemplo ficticio. No se guarda.</em>',
      },
    },
  ];
}

export async function startOnboardingTour() {
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
    steps: buildOnboardingSteps().map(step => step.element && !document.querySelector(step.element)
      ? { popover: step.popover }
      : step),
  });
  tour.drive();
  return tour;
}
