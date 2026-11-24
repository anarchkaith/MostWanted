import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlayerIntel, sanitizeIntelDigest, toIntelDigest } from './playerIntel.service.js';

const career = values => Object.entries(values).map(([key, value]) => ({ category: 'Test', key, label: key, value }));

function stubSocialClub({ failPlatform = null, failStats = false } = {}) {
  const calls = [];
  return {
    calls,
    platforms: ['pc', 'ps5'],
    async searchPlayers({ name }) {
      calls.push(`search:${name}`);
      return { status: 200, payload: { accounts: [{ rid: '166688426', name: 'Sazxinxxx', avatarUrl: 'a.png', crew: { id: 9, name: 'Kaith Rebels', tag: 'KRB' } }] } };
    },
    async getCareer({ platform, section = 'overview' }) {
      calls.push(`career:${platform}:${section}`);
      if (platform === failPlatform || (failStats && platform === 'pc' && section === 'stats')) return { status: 502, payload: { ok: false } };
      if (platform !== 'pc') return { status: 200, payload: { hasCareer: false, rows: [] } };
      return { status: 200, payload: { hasCareer: true, rows: section === 'stats'
        ? career({ MPPLY_TOTAL_TIME_SPENT_FREEMODE: '9d 5h', MPPLY_TOTAL_EVC: '$312.5M', MPPLY_TOTAL_SVC: '$284.2M' })
        : career({ Rank: '936', RP: '43M', WALLET_BALANCE: '$0', BANK_BALANCE: '$288.8M' }) } };
    },
  };
}

const aliases = async () => ({ fetched: true, names: [{ name: 'OldSaz', time: 1_700_000_000 }, { name: 'Sazxinxxx', time: 1_763_238_566 }] });
const silent = { error() {} };

test('unifica identidad, crew, carrera y señales, y lo cachea solo si está completo', async () => {
  const socialClub = stubSocialClub();
  const { getPlayerIntel } = createPlayerIntel({ socialClub, fetchAliases: aliases, resolveRidByName: async () => '', now: () => Date.UTC(2026, 0, 1), logger: silent });
  const { status, payload } = await getPlayerIntel({ nickname: 'Sazxinxxx' });

  assert.equal(status, 200);
  assert.equal(payload.identity.rid, '166688426');
  assert.equal(payload.identity.nickname, 'Sazxinxxx');
  assert.equal(payload.identity.socialClub.crew.tag, 'KRB');
  assert.deepEqual(payload.platforms.map(entry => entry.platform), ['pc']);
  assert.deepEqual(payload.signals, []);
  assert.equal(payload.complete, true);
  assert.match(payload.signature, /^[0-9a-f]{16}$/);

  const digest = toIntelDigest(payload);
  assert.equal(digest.crewSocialClub.nombre, 'Kaith Rebels');
  assert.deepEqual(digest.historialNombres.map(entry => entry.nombre), ['Sazxinxxx', 'OldSaz']);
  assert.equal(digest.carreras[0].saldo, '$288.8M');
  assert.equal(digest.carreras[0].ingresosTotales, '$312.5M');
  assert.equal(Object.hasOwn(digest.carreras[0], 'dineroSinOrigen'), false);

  const callCount = socialClub.calls.length;
  await getPlayerIntel({ nickname: 'sazxinxxx' });
  assert.equal(socialClub.calls.length, callCount);
});

test('los cambios de nombre se conservan sin sospechas y los digests antiguos pierden heurísticas retiradas', async () => {
  const names = Array.from({ length: 12 }, (_, index) => ({ name: `Alias${index}`, time: Date.now() / 1000 - index * 86400 }));
  const { getPlayerIntel } = createPlayerIntel({
    socialClub: stubSocialClub(), fetchAliases: async () => ({ fetched: true, names }), logger: silent,
  });
  const payload = (await getPlayerIntel({ rid: '166688426' })).payload;
  assert.equal(payload.identity.names.length, 12);
  assert.deepEqual(payload.signals, []);
  payload.signals = [
    { id: 'unexplained_money', title: 'Dinero sin origen registrado' },
    { id: 'kd_ratio', title: 'K/D alto' },
    { id: 'rank_over_cap', title: 'Rango por encima del máximo', severity: 'alta' },
  ];
  const digest = toIntelDigest(payload);
  assert.deepEqual(digest.señales.map(entry => entry.id), ['rank_over_cap']);
  const legacy = {
    ...digest,
    carreras: [{ ...digest.carreras[0], dineroSinOrigen: '$260.5M', ingresosPorHora: '$1.4M' }],
    señales: [...digest.señales, { titulo: 'Dinero sin origen registrado' }, { id: 'accuracy', titulo: 'Precisión alta' }],
  };
  const clean = sanitizeIntelDigest(legacy);
  assert.deepEqual(clean.señales, digest.señales);
  assert.equal(clean.carreras[0].saldo, '$288.8M');
  assert.equal(Object.hasOwn(clean.carreras[0], 'dineroSinOrigen'), false);
  assert.equal(Object.hasOwn(clean.carreras[0], 'ingresosPorHora'), false);
  assert.equal(legacy.carreras[0].dineroSinOrigen, '$260.5M', 'La lectura no modifica el digest recibido');
});

test('una plataforma caída deja el análisis incompleto, sin caché y con la limitación explicada', async () => {
  const socialClub = stubSocialClub({ failPlatform: 'ps5' });
  const { getPlayerIntel } = createPlayerIntel({ socialClub, fetchAliases: aliases, resolveRidByName: async () => '', logger: silent });
  const first = await getPlayerIntel({ rid: '166688426' });
  assert.equal(first.payload.complete, false);
  assert.deepEqual(first.payload.limitations, ['No se pudo consultar la carrera en: PlayStation 5.']);
  const callCount = socialClub.calls.length;
  await getPlayerIntel({ rid: '166688426' });
  assert.ok(socialClub.calls.length > callCount);
});

test('las estadísticas detalladas no disponibles también hacen incompleta la inteligencia', async () => {
  const socialClub = stubSocialClub({ failStats: true });
  const { getPlayerIntel } = createPlayerIntel({ socialClub, fetchAliases: aliases, logger: silent });
  const first = await getPlayerIntel({ rid: '166688426' });
  assert.equal(first.payload.complete, false);
  assert.deepEqual(first.payload.limitations, ['Sin estadísticas detalladas en PC Legacy.']);
  const callCount = socialClub.calls.length;
  await getPlayerIntel({ rid: '166688426' });
  assert.ok(socialClub.calls.length > callCount, 'Los datos incompletos no se guardan en la caché completa');
});

test('la firma cambia cuando cambian los datos o se recuperan fuentes, aunque las señales sean las mismas', async () => {
  let time = 0;
  let spending = '$284.2M';
  const socialClub = stubSocialClub();
  const getCareer = socialClub.getCareer;
  socialClub.getCareer = async options => {
    const result = await getCareer(options);
    if (options.platform === 'pc' && options.section === 'stats') {
      result.payload.rows.find(row => row.key === 'MPPLY_TOTAL_SVC').value = spending;
    }
    return result;
  };
  const complete = createPlayerIntel({ socialClub, fetchAliases: aliases, now: () => time, logger: silent });
  const first = (await complete.getPlayerIntel({ rid: '166688426' })).payload;
  spending = '$283.2M';
  time += 11 * 60 * 1000;
  const changed = (await complete.getPlayerIntel({ rid: '166688426' })).payload;
  const signalKeys = payload => payload.signals.map(({ id, severity }) => `${id}:${severity}`);
  assert.deepEqual(signalKeys(changed), signalKeys(first));
  assert.notEqual(changed.signature, first.signature, 'Una estadística incluida en el prompt cambió');

  const partial = createPlayerIntel({ socialClub: stubSocialClub({ failPlatform: 'ps5' }), fetchAliases: aliases, now: () => time, logger: silent });
  spending = '$284.2M';
  const incomplete = (await partial.getPlayerIntel({ rid: '166688426' })).payload;
  assert.deepEqual(signalKeys(incomplete), signalKeys(first));
  assert.notEqual(incomplete.signature, first.signature, 'La limitación de una fuente también cambia el contexto de HEX');
});

test('valida la entrada e informa jugadores inexistentes', async () => {
  const { getPlayerIntel } = createPlayerIntel({
    socialClub: { platforms: [], searchPlayers: async () => ({ status: 200, payload: { accounts: [] } }) },
    fetchAliases: aliases, resolveRidByName: async () => '', logger: silent,
  });
  assert.equal((await getPlayerIntel({})).status, 400);
  assert.equal((await getPlayerIntel({ rid: '12ab' })).status, 400);
  const missing = await getPlayerIntel({ nickname: 'NadieAqui' });
  assert.equal(missing.payload.found, false);
  assert.equal(toIntelDigest(missing.payload), null);
});
