// Test script para enviar un reporte de prueba al webhook de Discord

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1487549131655483583/zYfylIqIqPAM7Oy9icfNAiZb51kQvVD0oVVhq9HAW1UxheTp6U7RMIsoRBh2FIQQrx2O';

const testReport = {
  report: {
    nickname: 'CHEATER_TEST_123',
    crews: 'Los Diablos',
    avatar1: 'https://api.imgbb.com/avatar/xxxxx',
    avatar2: '',
    rid: 1234567890,
    ip: '192.168.1.100',
    aliases: 'CHEATER_ALT, TEST_2',
    time: Math.floor(Date.now() / 1000),
    typesOfInfraction: ['Modder', 'Aimbot'],
    reason: 'Este jugador ha sido observado utilizando software de asistencia de puntería (Aimbot) en múltiples sesiones consecutivas. La precisión es imposible de alcanzar naturalmente.',
    labels: ['Aimbot', 'Godmode', 'Reincidente'],
    reportedby: 'TestUser#1234',
  },
  reporter: {
    id: 'test-user-id',
    name: 'Test Usuario',
    tag: 'TestUser#1234',
    email: 'test@example.com',
  },
  evidence: [
    {
      url: 'https://api.imgbb.com/1/upload/evidence_001.png',
      name: 'screenshot_aimbot.png',
      contentType: 'image/png',
    },
  ],
};

async function sendTestReport() {
  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: '⚠️ H.E.X. SYSTEM',
        avatar_url: 'https://i.pinimg.com/736x/2b/6e/f6/2b6ef68a43b6b4363dcea23ee5c78421.jpg',
        content: '🚨 **REPORTE DE JUGADOR FRAUDULENTO DETECTADO** 🚨',
        embeds: [
          {
            author: {
              name: '◢◤ H.E.X. VIGILANCE SYSTEM ◢◤',
              icon_url: 'https://i.ibb.co/zT7r8F2P/X.png',
            },
            title: `⛔ TARGET: ${testReport.report.nickname}`,
            description: '**Nuevo reporte ingresado en el sistema de vigilancia**',
            color: 0xff3333,
            fields: [
              {
                name: '👤 JUGADOR REPORTADO',
                value: `**Nickname:** \`${testReport.report.nickname}\`\n**Crews:** \`${testReport.report.crews}\`\n**RID:** \`${testReport.report.rid}\`\n**IP:** \`${testReport.report.ip}\`\n**Aliases:** \`${testReport.report.aliases}\``,
                inline: false,
              },
              {
                name: '📋 INFRACCIONES',
                value: '```\nModder, Aimbot\n```',
                inline: false,
              },
              {
                name: '📝 RAZÓN DEL REPORTE',
                value: 'Este jugador ha sido observado utilizando software de asistencia de puntería (Aimbot) en múltiples sesiones consecutivas. La precisión es imposible de alcanzar naturalmente.',
                inline: false,
              },
              {
                name: '🏷️ ETIQUETAS',
                value: '`Aimbot` `Godmode` `Reincidente`',
                inline: false,
              },
              {
                name: '👤 REPORTADO POR',
                value: '`TestUser#1234`',
                inline: true,
              },
              {
                name: '🕐 HORA INCIDENTE',
                value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                inline: true,
              },
              {
                name: '📎 EVIDENCIAS',
                value: '[screenshot_aimbot.png](https://api.imgbb.com/1/upload/evidence_001.png)',
                inline: false,
              },
            ],
            thumbnail: {
              url: testReport.report.avatar1 || 'https://i.pinimg.com/736x/2b/6e/f6/2b6ef68a43b6b4363dcea23ee5c78421.jpg',
            },
            footer: {
              text: 'Sistema de Reportes MostWanted • Kaith\'s Rebels',
              icon_url: 'https://i.ibb.co/v4KTFw0q/Vector.png',
            },
            timestamp: new Date().toISOString(),
          },
        ],
        allowed_mentions: {
          parse: [],
        },
      }),
    });

    if (!response.ok) {
      console.error(`Error: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    console.log('✅ Reporte de prueba enviado a Discord exitosamente');
  } catch (error) {
    console.error('❌ Error al enviar el reporte:', error.message);
  }
}

// Ejecutar si se llama desde CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  sendTestReport();
}

export { sendTestReport, testReport };
