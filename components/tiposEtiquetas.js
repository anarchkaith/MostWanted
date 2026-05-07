// Tipos de etiquetas y utilidades para puntaje

export const TIPOS_ETIQUETAS = [
  {
    key: 'GLITCHER',
    emoji: '👾',
    nombre: 'Glitcher',
    etiquetas: [
      { nombre: 'Abuso de bugs', puntaje: 2 },
      { nombre: 'Duplicación de objetos', puntaje: 2 },
      { nombre: 'Inmunidad a daños / Godmode por exploit', puntaje: 4 },
      { nombre: 'Disparar a través de estructuras', puntaje: 2 },
      { nombre: 'Velocidad aumentada (speedhack)', puntaje: 2 },
      { nombre: 'Salir de mapa / Explorar fuera de límites', puntaje: 1 },
      { nombre: 'Invencibilidad temporal (exploit)', puntaje: 2 },
    ]
  },
  {
    key: 'GRIFFER',
    emoji: '🏴‍☠️',
    nombre: 'Griffer',
    etiquetas: [
      { nombre: 'Abusar de vehículos/objetos explotables', puntaje: 1 },
      { nombre: 'Spawnkill', puntaje: 1 },
      { nombre: 'Trolleo masivo (interrupción de partidas)', puntaje: 1 },
      { nombre: 'Sabotaje de partidas', puntaje: 2 },
      { nombre: 'Raideo de servidor / invasión coordinada', puntaje: 4 },
      { nombre: 'Ataque DDoS / daño a infraestructura', puntaje: 5 },
      { nombre: 'Spameo de bots / automatización maliciosa', puntaje: 2 },
    ]
  },
  {
    key: 'MODDER',
    emoji: '🔧',
    nombre: 'Modder',
    etiquetas: [
      { nombre: 'Godmode (hack)', puntaje: 5 },
      { nombre: 'Teleport (hack)', puntaje: 4 },
      { nombre: 'Wallhack / ESP', puntaje: 4 },
      { nombre: 'Aimbot', puntaje: 5 },
      { nombre: 'Explosiones invisibles / efectos no autorizados', puntaje: 2 },
      { nombre: 'Spawnear objetos (manipulación de economía)', puntaje: 2 },
      { nombre: 'Congelar jugadores (modding)', puntaje: 2 },
      { nombre: 'Kickear de la sesión (modding)', puntaje: 2 },
      { nombre: 'Flood de mensajes / spam técnico', puntaje: 1 },
      { nombre: 'Manipulación de datos del juego (cheats avanzados)', puntaje: 4 },
      { nombre: 'Blackscreen', puntaje: 3 },
      { nombre: 'Crash', puntaje: 3 },
    ]
  },
  {
    key: 'ACOSO-RAID',
    emoji: '🚨',
    nombre: 'Acoso/Hostigamiento',
    etiquetas: [
      { nombre: 'Hostigamiento por chat', puntaje: 1 },
      { nombre: 'Mensajes de odio / discriminación', puntaje: 2 },
      { nombre: 'Acoso en redes sociales', puntaje: 2 },
      { nombre: 'Acoso grupal / doxxing parcial', puntaje: 3 },
      { nombre: 'Amenazas fuera del juego', puntaje: 5 },
      { nombre: 'Extorsión / suplantación con fines de daño', puntaje: 5 },
      { nombre: 'Divulgación de información privada (doxxing)', puntaje: 5 },
      { nombre: 'Phishing / ingeniería social', puntaje: 5 },
      { nombre: 'Difamación grave', puntaje: 2 },
      { nombre: 'Multicuentas / evasión de sanciones', puntaje: 2 },
    ]
  },
];

export const getPuntajeEtiquetas = () => {
  return TIPOS_ETIQUETAS.reduce((acc, tipo) => {
    tipo.etiquetas.forEach(etq => {
      acc[etq.nombre] = etq.puntaje;
    });
    return acc;
  }, {});
};
