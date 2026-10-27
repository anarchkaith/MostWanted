import assert from 'node:assert/strict';
import { buildWordpressReportPayload } from './payload.js';
import { validateIncomingReportSubmission } from './validation.js';
import { buildDiscordReportPayload } from './discordReportEmbed.js';
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

runTest('buildDiscordReportPayload omite el campo Estado del embed', () => {
  const payload = buildDiscordReportPayload({
    report: {
      id: 5,
      nickname: 'Jugador123',
      rid: '123',
      reason: 'Motivo',
      investigation_status: 'resolved',
      typesOfInfraction: [],
      labels: [],
      time: Date.now(),
    },
    reporter: { name: 'Kaith' },
  });

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
});

runTest('buildDiscordReportPayload enlaza el nombre al perfil y el reporte desde el embed sin componentes', () => {
  const payload = buildDiscordReportPayload({
    report: { id: 5, nickname: 'Jugador123', rid: '123', reason: 'Motivo', typesOfInfraction: [], labels: [], time: Date.now() },
    reporter: { name: 'Kaith' },
  });
  const embed = payload.embeds[0];
  assert.equal(embed.title, 'Jugador123');
  assert.equal(embed.url, 'https://socialclub.rockstargames.com/members/Jugador123/');
  assert.equal(embed.description, '**Reporte de jugador**\n[Ver reporte y votar](https://mostwanted.kaithsrebels.com/reporte/5)');
  assert.equal(embed.fields.find(({ name }) => name.includes('Enlaces')).value,
    '[Aportar información sobre este jugador](https://mostwanted.kaithsrebels.com/jugador/Jugador123)\n[Reportar a un jugador](https://mostwanted.kaithsrebels.com/denunciar)\n[Ver lista de reportes](https://mostwanted.kaithsrebels.com/#reportes-lista)');
  assert.equal(Object.hasOwn(payload, 'components'), false);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

runTest('buildDiscordReportPayload codifica el perfil y conserva la URL compartida de la galeria', () => {
  const payload = buildDiscordReportPayload({
    report: { id: '42', nickname: ' Jugador #1 ', avatar1: 'https://example.com/avatar.png', time: Date.now() },
    evidence: [{ url: 'https://example.com/evidence.png', contentType: 'image/png' }],
  });
  assert.equal(payload.embeds[0].title, 'Jugador #1');
  assert.equal(payload.embeds[0].url, 'https://socialclub.rockstargames.com/members/Jugador%20%231/');
  assert.match(payload.embeds[0].description, /\/reporte\/42\)/);
  assert.equal(payload.embeds.length, 2);
  assert.equal(payload.embeds[1].url, payload.embeds[0].url);
  assert.equal(payload.embeds[1].image.url, 'https://example.com/evidence.png');
});

runTest('buildDiscordReportPayload respeta el limite del titulo y no inventa enlaces a reportes sin ID valido', () => {
  for (const id of [undefined, 0, -1, 'invalido', 1.5]) {
    const payload = buildDiscordReportPayload({ report: { id, nickname: 'a'.repeat(300), time: Date.now() } });
    assert.equal(payload.embeds[0].title.length, 256);
    assert.equal(payload.embeds[0].description,
      '**Reporte de jugador**\n[Ver reportes en la web](https://mostwanted.kaithsrebels.com)');
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
