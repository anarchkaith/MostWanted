import assert from 'node:assert/strict';
import { buildWordpressReportPayload } from './payload.js';
import { validateIncomingReportSubmission } from './validation.js';
import { buildDiscordReportPayload, sendReportToDiscordWebhook } from './discordReportEmbed.js';
import { buildDiscordAvatarUrl, attachSessionAvatarToReporter } from '../shared/auth/discordAvatar.js';
import { TIPOS_ETIQUETAS } from '../../components/tiposEtiquetas.js';

function findLabelIdByName(name = '') {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;

  let id = 1;
  for (const tipo of TIPOS_ETIQUETAS) {
    for (const etiqueta of tipo?.etiquetas || []) {
      if (String(etiqueta?.nombre || '').trim().toLowerCase() === target) {
        return id;
      }
      id += 1;
    }
  }

  return null;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('validateIncomingReportSubmission acepta un reporte valido y buildWordpressReportPayload respeta el contrato de WordPress', () => {
  const validation = validateIncomingReportSubmission({
    report: {
      usuario: 'Jugador123',
      motivo: 'Uso de exploit',
      categorias: ['Exploit', 'Vehiculos'],
      etiquetas: ['exploit', 'griefing'],
      contacto: 'MOSTWANTED',
      investigation_status: 'not_found',
    },
    reporter: {
      id: 'user-42',
      name: 'Kaith',
      tag: 'Kaith',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.png',
        name: 'captura-1.png',
        contentType: 'image/png',
      },
    ],
    source: 'mostwanted-web',
  });

  assert.equal(validation.ok, true);

  const payload = buildWordpressReportPayload(validation.value);

  assert.deepEqual(payload, {
    username: 'Jugador123',
    nickname: 'Jugador123',
    playerId: 'TMP-jugador123',
    avatar1: '',
    avatar2: '',
    rid: null,
    ip: '',
    aliases: [],
    time: null,
    reason: 'Uso de exploit',
    typesOfInfraction: ['Exploit', 'Vehiculos'],
    labels: ['exploit', 'griefing'],
    reportedby: 'MOSTWANTED',
    source: 'mostwanted-web',
    reporter: {
      name: 'Kaith',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.png',
        name: 'captura-1.png',
        contentType: 'image/png',
      },
    ],
    report: {
      categories: ['Exploit', 'Vehiculos'],
      tags: ['exploit', 'griefing'],
      reportedby: 'MOSTWANTED',
      investigation_status: 'not_found',
    },
  });

  assert.equal(JSON.stringify(payload).includes('user-42'), false);
  assert.equal(Object.hasOwn(payload.reporter, 'id'), false);
  assert.equal(Object.hasOwn(payload.reporter, 'avatarUrl'), false);
  assert.equal(Object.hasOwn(payload.reporter, 'tag'), false);
});

runTest('validateIncomingReportSubmission rechaza evidencias sin contentType soportado', () => {
  const validation = validateIncomingReportSubmission({
    report: {
      usuario: 'Jugador123',
      motivo: 'Uso de exploit',
      investigation_status: 'not_found',
    },
    evidence: [
      {
        url: 'https://tu-sitio.com/uploads/captura-1.bmp',
        name: 'captura-1.bmp',
        contentType: 'image/bmp',
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.status, 400);
  assert.match(validation.error, /contentType/i);
});

runTest('validateIncomingReportSubmission acepta labels por IDs y los expone como labelIds', () => {
  const aimbotId = findLabelIdByName('Aimbot');
  assert.ok(Number.isInteger(aimbotId) && aimbotId > 0, 'Aimbot debe existir en el catalogo');

  const validation = validateIncomingReportSubmission({
    report: {
      nickname: 'JugadorConIds',
      reason: 'Comportamiento sospechoso reiterado',
      labels: [7, '12', 'Aimbot'],
      crews: 'Crew de Prueba, Crew Secundaria #1, Kaiths Rebels',
      investigation_status: 'not_found',
    },
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.value.report.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(validation.value.report.labels, ['Aimbot']);

  const payload = buildWordpressReportPayload(validation.value);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crewCurrent'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crew1'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'crewsAssigned'), false);
  assert.ok(Array.isArray(payload.crews));
  assert.equal(payload.crews.length, 3);
  assert.equal(payload.crews[0].name, 'Crew de Prueba');
  assert.equal(payload.crews[1].name, 'Crew Secundaria #1');
  assert.deepEqual(payload.crews[2], {
    name: 'Kaiths Rebels',
    url: 'https://socialclub.rockstargames.com/crew/kaiths_rebels',
  });
  assert.deepEqual(payload.labelIds, [7, 12, aimbotId]);
  assert.deepEqual(payload.labels, ['Aimbot']);
  assert.deepEqual(payload.report.tagIds, [7, 12, aimbotId]);
});

console.log('OK payload/validation checks completed');

runTest('buildDiscordReportPayload usa el avatar del autor como icono y omite el logo cuando no existe', () => {
  const baseReport = {
    id: 5,
    nickname: 'Jugador123',
    rid: '123',
    reason: 'Motivo',
    typesOfInfraction: [],
    labels: [],
    time: Date.now(),
  };

  const withAvatar = buildDiscordReportPayload({
    report: baseReport,
    reporter: { name: 'Kaith', avatarUrl: 'https://cdn.discordapp.com/avatars/1/abc.png?size=128' },
  });
  assert.equal(withAvatar.embeds[0].author.icon_url, 'https://cdn.discordapp.com/avatars/1/abc.png?size=128');

  const anonymous = buildDiscordReportPayload({ report: baseReport, reporter: { name: 'Anónimo' } });
  assert.equal(Object.prototype.hasOwnProperty.call(anonymous.embeds[0].author, 'icon_url'), false);
});

runTest('buildDiscordReportPayload agrupa RID, crews e infracciones como campos inline', () => {
  const payload = buildDiscordReportPayload({
    report: {
      id: 5,
      nickname: 'Jugador123',
      rid: '123',
      reason: 'Motivo',
      investigation_status: 'resolved',
      crews: ['Crew Uno'],
      typesOfInfraction: ['MODDER'],
      labels: [],
      time: Date.now(),
    },
    reporter: { name: 'Kaith' },
  });

  const fields = payload.embeds[0].fields;
  assert.deepEqual(fields.slice(0, 3), [
    { name: 'RID', value: '||123||', inline: true },
    { name: '👥 Crews', value: '[Crew Uno](https://socialclub.rockstargames.com/crew/crew_uno)', inline: true },
    { name: '🚥 Tipos de infraccion', value: 'Modder', inline: true },
  ]);
  assert.equal(fields.some(({ name }) => name.includes('Estado')), false);
  assert.equal(payload.embeds[0].footer.text, 'MostWanted • Sistema de reportes');
});

runTest('buildDiscordReportPayload omite campos inline sin información', () => {
  const payload = buildDiscordReportPayload({
    report: { id: 5, nickname: 'Jugador123', rid: '', crews: [], typesOfInfraction: [], reason: 'Motivo' },
  });
  const fields = payload.embeds[0].fields;

  assert.equal(fields.some(({ name }) => name === 'RID'), false);
  assert.equal(fields.some(({ name }) => name.includes('Crews')), false);
  assert.equal(fields.some(({ name }) => name.includes('Tipos de infraccion')), false);
  assert.equal(payload.embeds[0].fields.some(({ name }) => name.includes('Estado')), false);
});

runTest('crews conserva la URL de Social Club en WordPress y Discord', () => {
  const crew = { name: 'EPI GTA5', url: 'https://socialclub.rockstargames.com/crew/epi-gta5' };
  const submission = validateIncomingReportSubmission({
    report: { nickname: 'Player', reason: 'Motivo documentado', investigation_status: 'not_found', crews: [crew] },
  });
  assert.equal(submission.ok, true);
  assert.deepEqual(buildWordpressReportPayload(submission.value).crews, [crew]);
  const payload = buildDiscordReportPayload(submission.value);
  assert.equal(payload.embeds[0].fields.find(field => field.name.includes('Crews')).value,
    `[${crew.name}](${crew.url})`);
  assert.equal(payload.embeds[0].fields.find(field => field.name.includes('Crews')).inline, true);
});

runTest('buildDiscordReportPayload enlaza el nombre al perfil y muestra los enlaces como botones', () => {
  const payload = buildDiscordReportPayload({
    report: { id: 5, nickname: 'Jugador123', rid: '123', reason: 'Motivo', typesOfInfraction: [], labels: [], time: Date.now() },
    reporter: { name: 'Kaith' },
  });
  const embed = payload.embeds[0];
  assert.equal(embed.title, 'Jugador123');
  assert.equal(embed.url, 'https://socialclub.rockstargames.com/members/Jugador123/');
  assert.equal(embed.description, '**Reporte de jugador**');
  assert.equal(embed.fields.some(({ name }) => name.includes('Enlaces')), false);
  const [row] = payload.components;
  assert.equal(row.type, 1);
  assert.ok(row.components.every((button) => button.type === 2 && button.style === 5 && !('custom_id' in button)));
  assert.deepEqual(row.components.map(({ label, url }) => [label, url]), [
    ['Ver reporte y votar', 'https://mostwanted.kaithsrebels.com/reporte/5'],
    ['Aportar información', 'https://mostwanted.kaithsrebels.com/jugador/Jugador123'],
    ['Reportar a un jugador', 'https://mostwanted.kaithsrebels.com/denunciar'],
    ['Ver lista de reportes', 'https://mostwanted.kaithsrebels.com/#reportes-lista'],
  ]);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

runTest('los links de video se validan aparte de los archivos y se muestran como botones en Discord', () => {
  const link = (url) => ({ url, name: 'Video 1 (youtu.be)', contentType: 'text/uri-list' });
  const images = Array.from({ length: 5 }, (_, index) => ({ url: `https://i.test/${index}.png`, name: `img${index}`, contentType: 'image/png' }));
  const body = (evidence) => ({ report: { nickname: 'Player', reason: 'Motivo documentado', investigation_status: 'not_found' }, evidence });

  const accepted = validateIncomingReportSubmission(body([...images, link('https://youtu.be/abc')]));
  assert.equal(accepted.ok, true);
  assert.equal(validateIncomingReportSubmission(body(['1', '2', '3', '4'].map((id) => link(`https://youtu.be/${id}`)))).ok, false);
  assert.equal(validateIncomingReportSubmission(body([link('javascript:alert(1)')])).ok, false);

  const payload = buildDiscordReportPayload({ report: { id: 5, nickname: 'Player', reason: 'Motivo' }, evidence: accepted.value.evidence });
  assert.equal(payload.components.length, 2);
  assert.deepEqual(payload.components[1].components, [
    { type: 2, style: 5, label: 'Video 1 (youtu.be)', url: 'https://youtu.be/abc', emoji: { name: '▶️' } },
  ]);
  assert.equal(payload.embeds.some((embed) => embed.image?.url === 'https://youtu.be/abc'), false);
});

await runAsyncTest('sendReportToDiscordWebhook pide a Discord respetar los botones con with_components', async () => {
  const previous = process.env.DISCORD_WEBHOOK_URL;
  process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/token?wait=true';
  let calledUrl = '';
  try {
    const result = await sendReportToDiscordWebhook(
      { report: { id: 5, nickname: 'Jugador123', reason: 'Motivo' } },
      { fetchImpl: async (url) => { calledUrl = url; return { ok: true, status: 204 }; } },
    );
    assert.equal(result.ok, true);
  } finally {
    if (previous === undefined) delete process.env.DISCORD_WEBHOOK_URL;
    else process.env.DISCORD_WEBHOOK_URL = previous;
  }
  assert.equal(calledUrl, 'https://discord.com/api/webhooks/1/token?wait=true&with_components=true');
});

runTest('buildDiscordReportPayload codifica el perfil y conserva la URL compartida de la galeria', () => {
  const payload = buildDiscordReportPayload({
    report: { id: '42', nickname: ' Jugador #1 ', avatar1: 'https://example.com/avatar.png', time: Date.now() },
    evidence: [{ url: 'https://example.com/evidence.png', contentType: 'image/png' }],
  });
  assert.equal(payload.embeds[0].title, 'Jugador #1');
  assert.equal(payload.embeds[0].url, 'https://socialclub.rockstargames.com/members/Jugador%20%231/');
  assert.equal(payload.components[0].components[0].url, 'https://mostwanted.kaithsrebels.com/reporte/42');
  assert.equal(payload.embeds.length, 2);
  assert.equal(payload.embeds[1].url, payload.embeds[0].url);
  assert.equal(payload.embeds[1].image.url, 'https://example.com/evidence.png');
});

runTest('buildDiscordReportPayload respeta el limite del titulo y no inventa enlaces a reportes sin ID valido', () => {
  for (const id of [undefined, 0, -1, 'invalido', 1.5]) {
    const payload = buildDiscordReportPayload({ report: { id, nickname: 'a'.repeat(300), time: Date.now() } });
    assert.equal(payload.embeds[0].title.length, 256);
    assert.deepEqual(
      [payload.components[0].components[0].label, payload.components[0].components[0].url],
      ['Ver reportes en la web', 'https://mostwanted.kaithsrebels.com'],
    );
  }
});

runTest('buildDiscordAvatarUrl y attachSessionAvatarToReporter usan solo la sesión del mismo usuario', () => {
  assert.equal(
    buildDiscordAvatarUrl({ id: '123', avatar: 'abc' }),
    'https://cdn.discordapp.com/avatars/123/abc.png?size=128',
  );
  assert.equal(
    buildDiscordAvatarUrl({ id: '123', avatar: 'a_abc' }),
    'https://cdn.discordapp.com/avatars/123/a_abc.gif?size=128',
  );
  assert.match(buildDiscordAvatarUrl({ id: '123' }), /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/\d\.png$/);
  assert.equal(buildDiscordAvatarUrl({ id: 'no-numerico', avatar: 'x' }), '');

  const session = { id: '123', avatar: 'abc' };
  assert.equal(
    attachSessionAvatarToReporter({ id: '123', name: 'Kaith' }, session).avatarUrl,
    'https://cdn.discordapp.com/avatars/123/abc.png?size=128',
  );
  assert.equal(attachSessionAvatarToReporter({ id: '999', name: 'Otro' }, session).avatarUrl, undefined);
  assert.equal(attachSessionAvatarToReporter({ id: '123', name: 'Kaith' }, null).avatarUrl, undefined);
});
