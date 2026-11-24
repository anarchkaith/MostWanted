const NUMBER_SUFFIXES = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

function scaled(number, suffix) {
  return Number(number.replace(/,/g, '')) * (NUMBER_SUFFIXES[suffix] || 1);
}

/**
 * Convierte los textos de Social Club ("$288.8M", "24d 20h 31m", "4,258.49 miles")
 * en números. Devuelve null si el valor no es numérico (p. ej. "Yes").
 */
export function parseStatValue(value) {
  const text = String(value ?? '').trim();
  const money = text.match(/^\$([\d,]+(?:\.\d+)?)([KMBT])?$/);
  if (money) return { kind: 'money', amount: scaled(money[1], money[2]) };

  const count = text.match(/^([\d,]+(?:\.\d+)?)([KMBT])?$/);
  if (count) return { kind: 'count', amount: scaled(count[1], count[2]) };

  const distance = text.match(/^([\d,]+(?:\.\d+)?)\s*miles$/);
  if (distance) return { kind: 'distance', amount: Number(distance[1].replace(/,/g, '')) };

  const clock = text.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (clock) return { kind: 'duration', amount: Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]) };

  const span = text.match(/^((?:\d+\s*[dhms]\s*)+)$/);
  if (span) {
    const units = { d: 86400, h: 3600, m: 60, s: 1 };
    const seconds = [...span[1].matchAll(/(\d+)\s*([dhms])/g)].reduce((total, [, amount, unit]) => total + Number(amount) * units[unit], 0);
    return { kind: 'duration', amount: seconds };
  }
  return null;
}

/**
 * Indexa filas de carrera por clave de Social Club con su valor numérico.
 * Si una clave aparece en varias secciones, prevalece la primera.
 */
export function indexCareerRows(...rowLists) {
  const byKey = new Map();
  for (const row of rowLists.flat()) {
    if (!row?.key || byKey.has(row.key)) continue;
    byKey.set(row.key, { ...row, parsed: parseStatValue(row.value) });
  }
  return byKey;
}
