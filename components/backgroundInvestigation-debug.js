/**
 * DEBUG: Script para probar el flujo de investigación paso a paso
 * Ejecuta esto en la consola del navegador para ver dónde se detiene
 */

console.clear();
console.log('🔍 INICIANDO DEBUG DE INVESTIGACIÓN DE ANTECEDENTES');
console.log('='.repeat(60));

// Test 1: Obtener RID
async function testGetRid(username) {
  console.log(`\n1️⃣ PRUEBA: Obtener RID para "${username}"`);
  console.log('-'.repeat(60));

  try {
    const url = `https://sc-cache.com/n/${encodeURIComponent(username)}`;
    console.log(`📡 URL: ${url}`);

    const response = await fetch(url);
    console.log(`📊 Status: ${response.status}`);

    const data = await response.json();
    console.log(`📦 Respuesta:`, data);

    const rid = String(data.id);
    console.log(`✅ RID obtenido: ${rid} (tipo: ${typeof rid})`);

    return rid;
  } catch (error) {
    console.error(`❌ ERROR:`, error);
    return null;
  }
}

// Test 2: Obtener Perfil
async function testGetProfile(rid) {
  console.log(`\n2️⃣ PRUEBA: Obtener Perfil para RID "${rid}"`);
  console.log('-'.repeat(60));

  try {
    const ridStr = String(rid);
    const url = `https://sc-cache.com/r/${encodeURIComponent(ridStr)}`;
    console.log(`📡 URL: ${url}`);

    const response = await fetch(url);
    console.log(`📊 Status: ${response.status}`);

    const data = await response.json();
    console.log(`📦 Respuesta:`, data);

    if (!data.name) {
      console.warn(`⚠️ No tiene 'name', buscando otros campos...`);
      console.log(`Claves disponibles:`, Object.keys(data));
    }

    console.log(`✅ Perfil obtenido`);
    return data;
  } catch (error) {
    console.error(`❌ ERROR:`, error);
    return null;
  }
}

// Test 3: Descargar Avatar
async function testDownloadAvatar(rid, index = 0) {
  console.log(`\n3️⃣ PRUEBA: Descargar Avatar ${index} para RID "${rid}"`);
  console.log('-'.repeat(60));

  try {
    const ridStr = String(rid);
    const url = `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(ridStr)}/publish/gta5/mpchars/${index}.png`;
    console.log(`📡 URL: ${url}`);

    const response = await fetch(url);
    console.log(`📊 Status: ${response.status}`);
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      console.warn(`⚠️ Avatar ${index} no disponible (${response.status})`);
      return null;
    }

    const blob = await response.blob();
    console.log(`📦 Blob size: ${blob.size} bytes`);
    console.log(`✅ Avatar ${index} descargado`);

    return blob;
  } catch (error) {
    console.error(`❌ ERROR:`, error);
    return null;
  }
}

// Test 4: Flujo Completo
async function testCompleteFlow(username) {
  console.log(`\n\n🚀 EJECUTANDO FLUJO COMPLETO`);
  console.log('='.repeat(60));

  const rid = await testGetRid(username);
  if (!rid) {
    console.log('\n❌ Falló en obtener RID, deteniendo...');
    return;
  }

  const profile = await testGetProfile(rid);
  if (!profile) {
    console.log('\n❌ Falló en obtener Perfil, deteniendo...');
    return;
  }

  const avatar0 = await testDownloadAvatar(rid, 0);
  const avatar1 = await testDownloadAvatar(rid, 1);

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ PRUEBAS COMPLETADAS');
  console.log('='.repeat(60));

  return {
    username,
    rid,
    profile,
    avatar0,
    avatar1,
  };
}

// Exportar para usar en consola
globalThis.debugInvestigation = {
  testGetRid,
  testGetProfile,
  testDownloadAvatar,
  testCompleteFlow,
};

console.log('\n📌 Funciones disponibles en console:');
console.log('   debugInvestigation.testGetRid(username)');
console.log('   debugInvestigation.testGetProfile(rid)');
console.log('   debugInvestigation.testDownloadAvatar(rid, index)');
console.log('   debugInvestigation.testCompleteFlow(username)');
console.log('\n Ejemplo:');
console.log('   await debugInvestigation.testCompleteFlow("militan___")');
console.log('\n');
