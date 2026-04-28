"use strict";

// =============================================================================
// CONSTANTES DE CONFIGURACIÓN
// Manual: sin números mágicos. Cada valor tiene nombre descriptivo.
// =============================================================================
const ANCHO_DEL_CANVAS = 1280;
const ALTO_DEL_CANVAS = 720;
const GROSOR_DE_PAREDES = 50;
const TAMANO_DEL_JUGADOR = 24; // Mitad del lado del cuadrado
const VELOCIDAD_DE_MOVIMIENTO = 0.006;
const FUERZA_DE_SALTO = 0.015;
const VELOCIDAD_MAXIMA_HORIZONTAL = 5;
const UMBRAL_DE_VELOCIDAD_EN_SUELO = 0.9;
const NIVEL_INICIAL = 1;
const CANTIDAD_TOTAL_DE_NIVELES = 2;

// Distancia de la ligadura llave-jugador (qué tan alto flota la llave)
const DISTANCIA_DE_LIGADURA_DE_LLAVE = TAMANO_DEL_JUGADOR + 18;

const TITULOS_DE_NIVELES = {
  1: "Nivel 1 — Alcanzá la Llave",
  2: "Nivel 2 — La Torre Humana",
};

// =============================================================================
// ALIASES DE MATTER.JS
// Destructuring: sacamos solo lo que vamos a usar del objeto global Matter.
// Ahora agregamos Constraint (ligaduras) y Composite (para limpiar el mundo).
// =============================================================================
const {
  Engine,
  Render,
  Runner,
  Bodies,
  Body,
  World,
  Events,
  Constraint, // ← NUEVO: crea ligaduras entre dos cuerpos físicos
  Composite, // ← NUEVO: maneja grupos de cuerpos (útil para limpiar)
} = Matter;

// =============================================================================
// ESTADO GLOBAL DEL JUEGO
// =============================================================================
let motorDeFisica;
let renderizador;
let ejecutorDeFisica;
let mundoDeFisica;

let nivelActual = NIVEL_INICIAL;
let jugadoresEnPantalla = {}; // { socketId: cuerpoDeMatter }
let inputsDeJugadores = {}; // { socketId: { izquierda, derecha, salto } }
let llaveDelNivel = null; // Cuerpo físico de la llave
let zonaDeSalidaDelNivel = null; // Cuerpo sensor de la zona de salida
let jugadorQueCargarLaLlave = null; // socketId del portador, o null
let ligaduraDeLlave = null; // Constraint que une llave con jugador
let elNivelYaTermino = false;

// =============================================================================
// CONEXIÓN CON EL SERVIDOR
// io() se conecta automáticamente al servidor que sirvió este HTML.
// =============================================================================
const socketDelJuego = io();

// =============================================================================
// NIVEL ALTO — Punto de entrada
// Solo orquesta. No tiene detalles técnicos.
// =============================================================================
function iniciarJuego() {
  inicializarMotorDeFisica();
  inicializarRenderizador();
  iniciarLoopPrincipal();
  escucharEventosDeFisica();
  escucharEventosDelServidor();
  Runner.run(ejecutorDeFisica, motorDeFisica);
  Render.run(renderizador);
  cargarNivel(nivelActual);
}

// =============================================================================
// NIVEL MEDIO — Motor y renderizador
// =============================================================================

function inicializarMotorDeFisica() {
  motorDeFisica = Engine.create();
  mundoDeFisica = motorDeFisica.world;
  ejecutorDeFisica = Runner.create();
}

function inicializarRenderizador() {
  renderizador = Render.create({
    element: document.body,
    engine: motorDeFisica,
    options: {
      width: ANCHO_DEL_CANVAS,
      height: ALTO_DEL_CANVAS,
      wireframes: false,
      background: "#1a1a2e",
    },
  });
}

// =============================================================================
// NIVEL MEDIO — Sistema de niveles
// =============================================================================

function cargarNivel(numeroDeNivel) {
  elNivelYaTermino = false;
  limpiarMundoActual();
  construirEstructuraBasicaDelMundo();

  if (numeroDeNivel === 1) construirNivelUno();
  else if (numeroDeNivel === 2) construirNivelDos();

  reposicionarJugadoresExistentes();
  actualizarTituloDelNivel(numeroDeNivel);
  actualizarIndicadorDeLlave(null);
}

function limpiarMundoActual() {
  // Eliminamos la ligadura antes de limpiar el mundo
  // Si no, Matter.js puede tirar errores por referencias rotas
  if (ligaduraDeLlave !== null) {
    World.remove(mundoDeFisica, ligaduraDeLlave);
    ligaduraDeLlave = null;
  }

  World.clear(mundoDeFisica);
  Engine.clear(motorDeFisica);

  llaveDelNivel = null;
  zonaDeSalidaDelNivel = null;
  jugadorQueCargarLaLlave = null;
}

function construirEstructuraBasicaDelMundo() {
  const piso = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2,
    ALTO_DEL_CANVAS + GROSOR_DE_PAREDES / 2,
    ANCHO_DEL_CANVAS,
    GROSOR_DE_PAREDES,
    "piso",
    "#2c3e50",
  );
  const paredIzquierda = crearCuerpoEstatico(
    -GROSOR_DE_PAREDES / 2,
    ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES,
    ALTO_DEL_CANVAS,
    "paredIzquierda",
    "#2c3e50",
  );
  const paredDerecha = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS + GROSOR_DE_PAREDES / 2,
    ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES,
    ALTO_DEL_CANVAS,
    "paredDerecha",
    "#2c3e50",
  );
  const techo = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2,
    -GROSOR_DE_PAREDES / 2,
    ANCHO_DEL_CANVAS,
    GROSOR_DE_PAREDES,
    "techo",
    "#2c3e50",
  );

  World.add(mundoDeFisica, [piso, paredIzquierda, paredDerecha, techo]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 1: La llave está en una plataforma elevada del medio.
// Los jugadores deben alcanzarla usando las plataformas escalonadas,
// luego llevarla a la puerta (zona verde) TODOS juntos.
// ─────────────────────────────────────────────────────────────────────────────
function construirNivelUno() {
  const plataformas = [
    crearPlataforma(160, 630, 260, 20, "#4a6fa5"),
    crearPlataforma(480, 530, 200, 20, "#4a6fa5"),
    crearPlataforma(760, 430, 200, 20, "#4a6fa5"),
    crearPlataforma(640, 270, 240, 20, "#e67e22"), // Plataforma de la llave
    crearPlataforma(1050, 530, 200, 20, "#4a6fa5"),
    crearPlataforma(1100, 370, 180, 20, "#4a6fa5"),
  ];

  llaveDelNivel = crearLlave(640, 232);
  const puerta = crearDecoracionDePuerta(1185, 298);
  zonaDeSalidaDelNivel = crearZonaDeSalida(1110, 315, 190, 95);

  World.add(mundoDeFisica, [
    ...plataformas,
    llaveDelNivel,
    puerta,
    zonaDeSalidaDelNivel,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 2: Plataforma muy alta, imposible de alcanzar sin apilarse.
// Los jugadores son cuadrados sólidos — pueden subirse unos sobre otros.
// ─────────────────────────────────────────────────────────────────────────────
function construirNivelDos() {
  const plataformas = [
    crearPlataforma(200, 630, 280, 20, "#4a6fa5"),
    crearPlataforma(640, 630, 280, 20, "#4a6fa5"),
    crearPlataforma(1080, 630, 280, 20, "#4a6fa5"),
    crearPlataforma(420, 460, 160, 20, "#8e44ad"),
    crearPlataforma(860, 460, 160, 20, "#8e44ad"),
    // Plataforma elevada — requiere apilarse para llegar
    crearPlataforma(640, 240, 220, 20, "#c0392b"),
  ];

  llaveDelNivel = crearLlave(640, 202);
  const puerta = crearDecoracionDePuerta(1190, 565);
  zonaDeSalidaDelNivel = crearZonaDeSalida(1110, 580, 190, 95);

  World.add(mundoDeFisica, [
    ...plataformas,
    llaveDelNivel,
    puerta,
    zonaDeSalidaDelNivel,
  ]);
}

// =============================================================================
// NIVEL BAJO — Constructores de objetos físicos
// Cada función crea UN solo tipo de objeto (SRP).
// =============================================================================

function crearCuerpoEstatico(x, y, ancho, alto, etiqueta, color) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    label: etiqueta,
    render: { fillStyle: color },
  });
}

function crearPlataforma(x, y, ancho, alto, color) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    label: "plataforma",
    friction: 0.8,
    render: {
      fillStyle: color,
      strokeStyle: "rgba(255,255,255,0.12)",
      lineWidth: 1,
    },
  });
}

function crearLlave(x, y) {
  // isSensor: true → la llave detecta colisiones pero no bloquea físicamente.
  // Así el jugador puede "entrar" en ella para recogerla.
  return Bodies.rectangle(x, y, 34, 14, {
    isStatic: true,
    isSensor: true,
    label: "llave",
    render: {
      fillStyle: "#f1c40f",
      strokeStyle: "#f39c12",
      lineWidth: 3,
    },
  });
}

function crearDecoracionDePuerta(x, y) {
  return Bodies.rectangle(x, y, 24, 90, {
    isStatic: true,
    isSensor: true,
    label: "puerta",
    render: {
      fillStyle: "#27ae60",
      strokeStyle: "#1e8449",
      lineWidth: 2,
    },
  });
}

function crearZonaDeSalida(x, y, ancho, alto) {
  // isSensor: true → los jugadores pueden entrar sin ser bloqueados.
  // Usamos bounds de este cuerpo para detectar si están adentro.
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    isSensor: true,
    label: "zonaDeSalida",
    render: {
      fillStyle: "rgba(39,174,96,0.20)",
      strokeStyle: "#2ecc71",
      lineWidth: 2,
    },
  });
}

// =============================================================================
// NIVEL MEDIO — Gestión de jugadores
// Los jugadores son CUADRADOS (rectangles) para poder apilarse tipo bloques.
// =============================================================================

function agregarJugadorAlMundo(idDelJugador, colorDelJugador, indiceDeColor) {
  const jugadorYaExiste = jugadoresEnPantalla[idDelJugador] !== undefined;
  if (jugadorYaExiste) return;

  const posicionInicialX = 80 + indiceDeColor * 75;
  const posicionInicialY = ALTO_DEL_CANVAS - 80;
  const ladoDelCuadrado = TAMANO_DEL_JUGADOR * 2; // 48px de lado

  // Bodies.rectangle para que sean cuadrados sólidos apilables
  const cuerpoDelJugador = Bodies.rectangle(
    posicionInicialX,
    posicionInicialY,
    ladoDelCuadrado,
    ladoDelCuadrado,
    {
      label: `jugador_${idDelJugador}`,
      frictionAir: 0.1,
      friction: 0.6,
      restitution: 0.0, // Sin rebote: se apilan limpio
      // inertia Infinity: el cuadrado no rota al chocar con paredes
      inertia: Infinity,
      render: {
        fillStyle: colorDelJugador,
        strokeStyle: "rgba(255,255,255,0.5)",
        lineWidth: 3,
      },
    },
  );

  jugadoresEnPantalla[idDelJugador] = cuerpoDelJugador;
  inputsDeJugadores[idDelJugador] = {
    izquierda: false,
    derecha: false,
    salto: false,
  };

  World.add(mundoDeFisica, cuerpoDelJugador);
}

function eliminarJugadorDelMundo(idDelJugador) {
  const cuerpoDelJugador = jugadoresEnPantalla[idDelJugador];
  const jugadorExiste = cuerpoDelJugador !== undefined;
  if (!jugadorExiste) return;

  const eraElPortador = jugadorQueCargarLaLlave === idDelJugador;
  if (eraElPortador) resetearLlave();

  World.remove(mundoDeFisica, cuerpoDelJugador);
  delete jugadoresEnPantalla[idDelJugador];
  delete inputsDeJugadores[idDelJugador];
}

function reposicionarJugadoresExistentes() {
  Object.keys(jugadoresEnPantalla).forEach((idDelJugador, indice) => {
    const cuerpo = jugadoresEnPantalla[idDelJugador];
    Body.setPosition(cuerpo, {
      x: 80 + indice * 75,
      y: ALTO_DEL_CANVAS - 80,
    });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });
  });
}

// =============================================================================
// NIVEL MEDIO — Loop principal
// =============================================================================

function iniciarLoopPrincipal() {
  function ejecutarFrame() {
    aplicarInputsATodosLosJugadores();
    verificarCondicionesDeVictoria();
    verificarJugadoresFueraDelMapa();
    requestAnimationFrame(ejecutarFrame);
  }
  requestAnimationFrame(ejecutarFrame);
}

function aplicarInputsATodosLosJugadores() {
  Object.entries(inputsDeJugadores).forEach(([idDelJugador, inputActual]) => {
    const cuerpo = jugadoresEnPantalla[idDelJugador];
    const jugadorTieneCuerpo = cuerpo !== undefined;
    if (!jugadorTieneCuerpo) return;

    aplicarMovimientoHorizontal(cuerpo, inputActual);
    aplicarSaltoSiCorresponde(cuerpo, inputActual);
    limitarVelocidadHorizontal(cuerpo);
  });
}

function aplicarMovimientoHorizontal(cuerpo, inputActual) {
  if (inputActual.izquierda) {
    Body.applyForce(cuerpo, cuerpo.position, {
      x: -VELOCIDAD_DE_MOVIMIENTO,
      y: 0,
    });
  }
  if (inputActual.derecha) {
    Body.applyForce(cuerpo, cuerpo.position, {
      x: VELOCIDAD_DE_MOVIMIENTO,
      y: 0,
    });
  }
}

function aplicarSaltoSiCorresponde(cuerpo, inputActual) {
  const estaEnElSuelo = verificarSiJugadorEstaEnSuelo(cuerpo);
  const puedeEjecutarSalto = inputActual.salto && estaEnElSuelo;

  if (puedeEjecutarSalto) {
    Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: -FUERZA_DE_SALTO });
    inputActual.salto = false; // Consumimos el salto para evitar salto infinito
  }
}

function limitarVelocidadHorizontal(cuerpo) {
  const velocidad = cuerpo.velocity;
  const superaElLimite = Math.abs(velocidad.x) > VELOCIDAD_MAXIMA_HORIZONTAL;

  if (superaElLimite) {
    Body.setVelocity(cuerpo, {
      x: Math.sign(velocidad.x) * VELOCIDAD_MAXIMA_HORIZONTAL,
      y: velocidad.y,
    });
  }
}

function verificarSiJugadorEstaEnSuelo(cuerpo) {
  return Math.abs(cuerpo.velocity.y) < UMBRAL_DE_VELOCIDAD_EN_SUELO;
}

function verificarJugadoresFueraDelMapa() {
  Object.keys(jugadoresEnPantalla).forEach((idDelJugador) => {
    const cuerpo = jugadoresEnPantalla[idDelJugador];
    const cayoFueraDelMapa = cuerpo.position.y > ALTO_DEL_CANVAS + 120;

    if (cayoFueraDelMapa) {
      Body.setPosition(cuerpo, { x: 120, y: ALTO_DEL_CANVAS - 100 });
      Body.setVelocity(cuerpo, { x: 0, y: 0 });

      const eraElPortador = jugadorQueCargarLaLlave === idDelJugador;
      if (eraElPortador) resetearLlave();
    }
  });
}

// =============================================================================
// NIVEL MEDIO — Sistema de llave con Constraint (ligadura)
//
// ¿Qué es un Constraint?
// Es una "cuerda" entre dos cuerpos. Cuando el jugador recoge la llave,
// creamos un Constraint entre ellos. Matter.js mueve la llave con el jugador
// automáticamente, sin que tengamos que calcular posiciones a mano.
// =============================================================================

function crearLigaduraDeLlaveConJugador(cuerpoDelPortador) {
  // Constraint.create une dos cuerpos con una cuerda virtual.
  // pointA: offset desde el centro del cuerpoA (el jugador)
  // pointB: offset desde el centro del cuerpoB (la llave)
  // stiffness: 1 = rígido (no hay elasticidad, sigue perfecto)
  // length: distancia fija entre los dos puntos
  const nuevaLigadura = Constraint.create({
    bodyA: cuerpoDelPortador,
    bodyB: llaveDelNivel,
    pointA: { x: 0, y: -DISTANCIA_DE_LIGADURA_DE_LLAVE }, // Arriba del jugador
    pointB: { x: 0, y: 0 }, // Centro de la llave
    stiffness: 1,
    length: 0,
    render: {
      visible: true,
      strokeStyle: "#f1c40f",
      lineWidth: 2,
    },
  });

  // La llave ya no debe ser estática: el Constraint la va a mover
  Body.setStatic(llaveDelNivel, false);

  World.add(mundoDeFisica, nuevaLigadura);
  ligaduraDeLlave = nuevaLigadura;
}

function resetearLlave() {
  // Eliminamos la ligadura antes de volver a fijar la llave
  if (ligaduraDeLlave !== null) {
    World.remove(mundoDeFisica, ligaduraDeLlave);
    ligaduraDeLlave = null;
  }

  jugadorQueCargarLaLlave = null;

  // Volvemos a hacer la llave estática y la regresamos a su posición inicial
  Body.setStatic(llaveDelNivel, true);
  Body.setPosition(llaveDelNivel, obtenerPosicionInicialDeLlave(nivelActual));
  Body.setVelocity(llaveDelNivel, { x: 0, y: 0 });

  actualizarIndicadorDeLlave(null);
}

function obtenerPosicionInicialDeLlave(numeroDeNivel) {
  const posicionesPorNivel = {
    1: { x: 640, y: 232 },
    2: { x: 640, y: 202 },
  };
  return posicionesPorNivel[numeroDeNivel] || { x: 640, y: 232 };
}

// =============================================================================
// NIVEL MEDIO — Eventos de colisión de Matter.js
//
// Events.on(motor, "collisionStart", callback) se dispara UNA vez
// cuando dos cuerpos se tocan por primera vez.
// Dentro del callback, "evento.pairs" es la lista de pares que colisionaron.
// =============================================================================

function escucharEventosDeFisica() {
  Events.on(motorDeFisica, "collisionStart", (evento) => {
    evento.pairs.forEach((par) => {
      procesarColision(par.bodyA, par.bodyB);
    });
  });
}

function procesarColision(cuerpoA, cuerpoB) {
  // Detectamos si alguno de los dos cuerpos es la llave
  const esColisionConLlave =
    cuerpoA.label === "llave" || cuerpoB.label === "llave";

  if (esColisionConLlave) {
    // Identificamos cuál es el jugador y cuál es la llave
    const cuerpoDelJugador = cuerpoA.label === "llave" ? cuerpoB : cuerpoA;
    intentarRecogerLlave(cuerpoDelJugador);
  }
}

function intentarRecogerLlave(cuerpoDelJugador) {
  // Solo puede haber un portador a la vez
  const yaHayPortador = jugadorQueCargarLaLlave !== null;
  if (yaHayPortador) return;

  // Buscamos el socketId que corresponde a este cuerpo físico
  const idDelJugador = Object.keys(jugadoresEnPantalla).find(
    (id) => jugadoresEnPantalla[id] === cuerpoDelJugador,
  );

  const esUnJugadorRegistrado = idDelJugador !== undefined;
  if (!esUnJugadorRegistrado) return;

  jugadorQueCargarLaLlave = idDelJugador;
  crearLigaduraDeLlaveConJugador(cuerpoDelJugador);
  actualizarIndicadorDeLlave(idDelJugador);

  console.log(`🗝️ Jugador recogió la llave`);
}

// =============================================================================
// NIVEL MEDIO — Condición de victoria
//
// La puerta se "abre" (nivel completo) cuando:
// 1. Alguien tiene la llave
// 2. TODOS los jugadores conectados están en la zona de salida
// =============================================================================

function verificarCondicionesDeVictoria() {
  if (elNivelYaTermino) return;

  const hayJugadores = Object.keys(jugadoresEnPantalla).length > 0;
  const hayElementos = llaveDelNivel !== null && zonaDeSalidaDelNivel !== null;
  if (!hayJugadores || !hayElementos) return;

  const alguienTieneLaLlave = jugadorQueCargarLaLlave !== null;
  const todosEstanEnLaSalida = verificarSiTodosEstanEnZonaDeSalida();

  if (alguienTieneLaLlave && todosEstanEnLaSalida) {
    elNivelYaTermino = true;
    activarPantallaDeVictoria();
  }
}

function verificarSiTodosEstanEnZonaDeSalida() {
  const ids = Object.keys(jugadoresEnPantalla);
  if (ids.length === 0) return false;

  // every() retorna true solo si TODOS los jugadores cumplen la condición
  return ids.every((id) => {
    const cuerpo = jugadoresEnPantalla[id];
    return verificarSiCuerpoEstaEnZona(cuerpo, zonaDeSalidaDelNivel);
  });
}

function verificarSiCuerpoEstaEnZona(cuerpo, zona) {
  // zona.bounds es el bounding box calculado por Matter.js automáticamente
  // min = esquina superior izquierda, max = esquina inferior derecha
  const limites = zona.bounds;
  return (
    cuerpo.position.x > limites.min.x &&
    cuerpo.position.x < limites.max.x &&
    cuerpo.position.y > limites.min.y &&
    cuerpo.position.y < limites.max.y
  );
}

function activarPantallaDeVictoria() {
  const pantalla = document.getElementById("pantalla-de-victoria");
  const esElUltimoNivel = nivelActual === CANTIDAD_TOTAL_DE_NIVELES;

  pantalla.classList.add("visible");

  document.getElementById("texto-de-victoria").textContent = esElUltimoNivel
    ? "🏆 ¡Juego completado!"
    : "🎉 ¡Nivel completado!";

  document.getElementById("boton-para-siguiente-nivel").textContent =
    esElUltimoNivel ? "Jugar de nuevo" : "Siguiente Nivel →";

  document.getElementById("boton-para-siguiente-nivel").onclick = () => {
    pantalla.classList.remove("visible");
    nivelActual = esElUltimoNivel ? 1 : nivelActual + 1;
    cargarNivel(nivelActual);
  };
}

// =============================================================================
// NIVEL MEDIO — Comunicación con el servidor
// =============================================================================

function escucharEventosDelServidor() {
  socketDelJuego.on("jugador_asignado", manejarAsignacionDeJugador);
  socketDelJuego.on(
    "actualizacion_de_jugadores",
    manejarActualizacionDeJugadores,
  );
  socketDelJuego.on("tick_del_juego", manejarTickDelJuego);
}

function manejarAsignacionDeJugador(datosDelJugador) {
  agregarJugadorAlMundo(
    datosDelJugador.id,
    datosDelJugador.color,
    datosDelJugador.indiceDeColor,
  );
}

function manejarActualizacionDeJugadores(jugadoresDelServidor) {
  const idsEnServidor = Object.keys(jugadoresDelServidor);
  const idsEnPantalla = Object.keys(jugadoresEnPantalla);

  idsEnServidor.forEach((id) => {
    const esNuevo = jugadoresEnPantalla[id] === undefined;
    if (esNuevo) {
      const datos = jugadoresDelServidor[id];
      agregarJugadorAlMundo(datos.id, datos.color, datos.indiceDeColor);
    }
  });

  idsEnPantalla.forEach((id) => {
    const seDesconecto = jugadoresDelServidor[id] === undefined;
    if (seDesconecto) eliminarJugadorDelMundo(id);
  });

  actualizarPanelDeJugadores(jugadoresDelServidor);
}

function manejarTickDelJuego(estadoDelJuego) {
  Object.keys(estadoDelJuego.jugadores).forEach((id) => {
    const inputDelServidor = estadoDelJuego.jugadores[id].input;
    if (!inputsDeJugadores[id]) return;

    inputsDeJugadores[id].izquierda = inputDelServidor.izquierda;
    inputsDeJugadores[id].derecha = inputDelServidor.derecha;

    // El salto se activa pero no se desactiva desde el servidor.
    // Lo consume aplicarSaltoSiCorresponde() para evitar salto infinito.
    if (inputDelServidor.salto) {
      inputsDeJugadores[id].salto = true;
    }
  });
}

// =============================================================================
// NIVEL BAJO — Actualización de UI
// =============================================================================

function actualizarPanelDeJugadores(jugadoresDelServidor) {
  const lista = document.getElementById("lista-de-jugadores");
  lista.innerHTML = "";

  Object.values(jugadoresDelServidor).forEach((datos, indice) => {
    const indicador = document.createElement("div");
    indicador.className = "indicador-de-jugador";
    indicador.innerHTML = `
      <span class="circulo-de-color-del-jugador"
            style="background-color:${datos.color}"></span>
      <span>Jugador ${indice + 1}</span>
    `;
    lista.appendChild(indicador);
  });
}

function actualizarTituloDelNivel(numeroDeNivel) {
  document.getElementById("titulo-del-nivel").textContent =
    TITULOS_DE_NIVELES[numeroDeNivel] || `Nivel ${numeroDeNivel}`;
}

function actualizarIndicadorDeLlave(idDelPortador) {
  const indicador = document.getElementById("indicador-de-llave");
  indicador.textContent =
    idDelPortador === null
      ? "🗝️  Nadie tiene la llave — ¡encuéntrenla!"
      : "🗝️  ¡Alguien tiene la llave! Todos a la salida 🟩";
}

// =============================================================================
// ARRANQUE
// =============================================================================
iniciarJuego();
