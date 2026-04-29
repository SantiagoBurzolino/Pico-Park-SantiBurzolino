"use strict";

// =============================================================================
// CONSTANTES
// =============================================================================
const ANCHO_DEL_CANVAS            = 1280;
const ALTO_DEL_CANVAS             = 720;
const GROSOR_DE_PAREDES           = 50;
const TAMANO_DEL_JUGADOR          = 24;
const VELOCIDAD_DE_MOVIMIENTO     = 0.006;
const FUERZA_DE_SALTO             = 0.02;      // Aumentada para saltar obstáculos
const VELOCIDAD_MAXIMA_HORIZONTAL = 5;
const UMBRAL_DE_VELOCIDAD_EN_SUELO = 1.2;      // Más permisivo para detectar suelo
const NIVEL_INICIAL               = 1;
const CANTIDAD_TOTAL_DE_NIVELES   = 2;
const DISTANCIA_DE_LIGADURA_DE_LLAVE = TAMANO_DEL_JUGADOR + 18;
const TIPO_DE_CLIENTE_JUEGO       = "juego";   // Mismo valor que en server/index.js

const TITULOS_DE_NIVELES = {
  1: "Nivel 1 — Alcanzá la Llave",
  2: "Nivel 2 — La Torre Humana",
};

// =============================================================================
// ALIASES DE MATTER.JS
// =============================================================================
const { Engine, Render, Runner, Bodies, Body, World, Events, Constraint } = Matter;

// =============================================================================
// ESTADO GLOBAL
// =============================================================================
let motorDeFisica;
let renderizador;
let ejecutorDeFisica;
let mundoDeFisica;

let nivelActual              = NIVEL_INICIAL;
let jugadoresEnPantalla      = {};
let inputsDeJugadores        = {};
let llaveDelNivel            = null;
let zonaDeSalidaDelNivel     = null;
let jugadorQueCargarLaLlave  = null;
let ligaduraDeLlave          = null;
let elNivelYaTermino         = false;
let elJuegoEstaEnCurso       = false; // false = pantalla de inicio visible

// =============================================================================
// CONEXIÓN CON EL SERVIDOR
// El juego se identifica como "juego" para que el servidor NO lo trate
// como un gamepad y no genere un cuadrado extra en pantalla.
// =============================================================================
const socketDelJuego = io();

socketDelJuego.on("connect", () => {
  // Apenas conecta, le decimos al servidor que somos el juego, no un gamepad
  socketDelJuego.emit("identificarse", TIPO_DE_CLIENTE_JUEGO);
});

// =============================================================================
// NIVEL ALTO — Punto de entrada
// =============================================================================
function iniciarJuego() {
  inicializarMotorDeFisica();
  inicializarRenderizador();
  escucharEventosDeFisica();
  escucharEventosDelServidor();
  escucharBotonDeInicio();
  Runner.run(ejecutorDeFisica, motorDeFisica);
  Render.run(renderizador);
  // NO llamamos cargarNivel todavía — esperamos que el usuario presione inicio
}

// =============================================================================
// NIVEL MEDIO — Pantalla de inicio
// =============================================================================

/**
 * Escucha el botón de inicio en el HTML.
 * Cuando el usuario lo presiona, ocultamos la pantalla de inicio
 * y cargamos el primer nivel.
 */
function escucharBotonDeInicio() {
  const botonDeInicio = document.getElementById("boton-de-inicio");
  botonDeInicio.addEventListener("click", () => {
    ocultarPantallaDeInicio();
    elJuegoEstaEnCurso = true;
    iniciarLoopPrincipal();
    cargarNivel(nivelActual);
  });
}

function ocultarPantallaDeInicio() {
  const pantallaDeInicio = document.getElementById("pantalla-de-inicio");
  pantallaDeInicio.classList.remove("visible");
}

function mostrarPantallaDeInicio() {
  const pantallaDeInicio = document.getElementById("pantalla-de-inicio");
  pantallaDeInicio.classList.add("visible");
}

// =============================================================================
// NIVEL MEDIO — Motor y renderizador
// =============================================================================

function inicializarMotorDeFisica() {
  motorDeFisica    = Engine.create();
  mundoDeFisica    = motorDeFisica.world;
  ejecutorDeFisica = Runner.create();
}

function inicializarRenderizador() {
  renderizador = Render.create({
    element: document.body,
    engine:  motorDeFisica,
    options: {
      width:      ANCHO_DEL_CANVAS,
      height:     ALTO_DEL_CANVAS,
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
  if (ligaduraDeLlave !== null) {
    World.remove(mundoDeFisica, ligaduraDeLlave);
    ligaduraDeLlave = null;
  }
  World.clear(mundoDeFisica);
  Engine.clear(motorDeFisica);
  llaveDelNivel           = null;
  zonaDeSalidaDelNivel    = null;
  jugadorQueCargarLaLlave = null;
}

function construirEstructuraBasicaDelMundo() {
  const piso = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2,
    ALTO_DEL_CANVAS + GROSOR_DE_PAREDES / 2,
    ANCHO_DEL_CANVAS, GROSOR_DE_PAREDES, "piso", "#2c3e50"
  );
  const paredIzquierda = crearCuerpoEstatico(
    -GROSOR_DE_PAREDES / 2, ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES, ALTO_DEL_CANVAS, "paredIzquierda", "#2c3e50"
  );
  const paredDerecha = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS + GROSOR_DE_PAREDES / 2, ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES, ALTO_DEL_CANVAS, "paredDerecha", "#2c3e50"
  );
  const techo = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2, -GROSOR_DE_PAREDES / 2,
    ANCHO_DEL_CANVAS, GROSOR_DE_PAREDES, "techo", "#2c3e50"
  );
  World.add(mundoDeFisica, [piso, paredIzquierda, paredDerecha, techo]);
}

function construirNivelUno() {
  const plataformas = [
    crearPlataforma(160,  630, 260, 20, "#4a6fa5"),
    crearPlataforma(480,  530, 200, 20, "#4a6fa5"),
    crearPlataforma(760,  430, 200, 20, "#4a6fa5"),
    crearPlataforma(640,  270, 240, 20, "#e67e22"),
    crearPlataforma(1050, 530, 200, 20, "#4a6fa5"),
    crearPlataforma(1100, 370, 180, 20, "#4a6fa5"),
  ];
  llaveDelNivel        = crearLlave(640, 232);
  const puerta         = crearDecoracionDePuerta(1185, 298);
  zonaDeSalidaDelNivel = crearZonaDeSalida(1110, 315, 190, 95);
  World.add(mundoDeFisica, [...plataformas, llaveDelNivel, puerta, zonaDeSalidaDelNivel]);
}

function construirNivelDos() {
  const plataformas = [
    crearPlataforma(200,  630, 280, 20, "#4a6fa5"),
    crearPlataforma(640,  630, 280, 20, "#4a6fa5"),
    crearPlataforma(1080, 630, 280, 20, "#4a6fa5"),
    crearPlataforma(420,  460, 160, 20, "#8e44ad"),
    crearPlataforma(860,  460, 160, 20, "#8e44ad"),
    crearPlataforma(640,  240, 220, 20, "#c0392b"),
  ];
  llaveDelNivel        = crearLlave(640, 202);
  const puerta         = crearDecoracionDePuerta(1190, 565);
  zonaDeSalidaDelNivel = crearZonaDeSalida(1110, 580, 190, 95);
  World.add(mundoDeFisica, [...plataformas, llaveDelNivel, puerta, zonaDeSalidaDelNivel]);
}

// =============================================================================
// NIVEL BAJO — Constructores de objetos físicos
// =============================================================================

function crearCuerpoEstatico(x, y, ancho, alto, etiqueta, color) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    label:    etiqueta,
    render:   { fillStyle: color },
  });
}

function crearPlataforma(x, y, ancho, alto, color) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    label:    "plataforma",
    friction: 0.8,
    render: {
      fillStyle:   color,
      strokeStyle: "rgba(255,255,255,0.12)",
      lineWidth:   1,
    },
  });
}

function crearLlave(x, y) {
  return Bodies.rectangle(x, y, 34, 14, {
    isStatic: true,
    isSensor: true,
    label:    "llave",
    render: {
      fillStyle:   "#f1c40f",
      strokeStyle: "#f39c12",
      lineWidth:   3,
    },
  });
}

function crearDecoracionDePuerta(x, y) {
  return Bodies.rectangle(x, y, 24, 90, {
    isStatic: true,
    isSensor: true,
    label:    "puerta",
    render: {
      fillStyle:   "#27ae60",
      strokeStyle: "#1e8449",
      lineWidth:   2,
    },
  });
}

function crearZonaDeSalida(x, y, ancho, alto) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    isSensor: true,
    label:    "zonaDeSalida",
    render: {
      fillStyle:   "rgba(39,174,96,0.20)",
      strokeStyle: "#2ecc71",
      lineWidth:   2,
    },
  });
}

// =============================================================================
// NIVEL MEDIO — Gestión de jugadores (cuadrados apilables)
// =============================================================================

function agregarJugadorAlMundo(idDelJugador, colorDelJugador, indiceDeColor) {
  const jugadorYaExiste = jugadoresEnPantalla[idDelJugador] !== undefined;
  if (jugadorYaExiste) return;

  const posicionInicialX = 80 + indiceDeColor * 75;
  const posicionInicialY = ALTO_DEL_CANVAS - 80;
  const ladoDelCuadrado  = TAMANO_DEL_JUGADOR * 2;

  const cuerpoDelJugador = Bodies.rectangle(
    posicionInicialX, posicionInicialY,
    ladoDelCuadrado, ladoDelCuadrado,
    {
      label:       `jugador_${idDelJugador}`,
      frictionAir: 0.08,
      friction:    0.6,
      restitution: 0.0,
      inertia:     Infinity, // Sin rotación al chocar
      render: {
        fillStyle:   colorDelJugador,
        strokeStyle: "rgba(255,255,255,0.5)",
        lineWidth:   3,
      },
    }
  );

  jugadoresEnPantalla[idDelJugador] = cuerpoDelJugador;
  inputsDeJugadores[idDelJugador]   = {
    izquierda: false,
    derecha:   false,
    salto:     false,
  };
  World.add(mundoDeFisica, cuerpoDelJugador);
}

function eliminarJugadorDelMundo(idDelJugador) {
  const cuerpoDelJugador = jugadoresEnPantalla[idDelJugador];
  if (cuerpoDelJugador === undefined) return;

  const eraElPortador = jugadorQueCargarLaLlave === idDelJugador;
  if (eraElPortador) resetearLlave();

  World.remove(mundoDeFisica, cuerpoDelJugador);
  delete jugadoresEnPantalla[idDelJugador];
  delete inputsDeJugadores[idDelJugador];
}

function reposicionarJugadoresExistentes() {
  Object.keys(jugadoresEnPantalla).forEach((idDelJugador, indice) => {
    const cuerpo = jugadoresEnPantalla[idDelJugador];
    Body.setPosition(cuerpo, { x: 80 + indice * 75, y: ALTO_DEL_CANVAS - 80 });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });
  });
}

// =============================================================================
// NIVEL MEDIO — Loop principal
// Solo inicia cuando el usuario presiona "Jugar" en la pantalla de inicio.
// =============================================================================

function iniciarLoopPrincipal() {
  function ejecutarFrame() {
    if (!elJuegoEstaEnCurso) return;
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
    if (cuerpo === undefined) return;

    aplicarMovimientoHorizontal(cuerpo, inputActual);
    aplicarSaltoSiCorresponde(cuerpo, inputActual);
    limitarVelocidadHorizontal(cuerpo);
  });
}

function aplicarMovimientoHorizontal(cuerpo, inputActual) {
  if (inputActual.izquierda) {
    Body.applyForce(cuerpo, cuerpo.position, { x: -VELOCIDAD_DE_MOVIMIENTO, y: 0 });
  }
  if (inputActual.derecha) {
    Body.applyForce(cuerpo, cuerpo.position, { x: VELOCIDAD_DE_MOVIMIENTO, y: 0 });
  }
}

function aplicarSaltoSiCorresponde(cuerpo, inputActual) {
  const estaEnElSuelo      = verificarSiJugadorEstaEnSuelo(cuerpo);
  const puedeEjecutarSalto = inputActual.salto && estaEnElSuelo;

  if (puedeEjecutarSalto) {
    Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: -FUERZA_DE_SALTO });
    inputActual.salto = false;
  }
}

function limitarVelocidadHorizontal(cuerpo) {
  const velocidad      = cuerpo.velocity;
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
    const cuerpo         = jugadoresEnPantalla[idDelJugador];
    const cayoFueraDelMapa = cuerpo.position.y > ALTO_DEL_CANVAS + 120;
    if (!cayoFueraDelMapa) return;

    Body.setPosition(cuerpo, { x: 120, y: ALTO_DEL_CANVAS - 100 });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });

    const eraElPortador = jugadorQueCargarLaLlave === idDelJugador;
    if (eraElPortador) resetearLlave();
  });
}

// =============================================================================
// NIVEL MEDIO — Sistema de llave con Constraint
// =============================================================================

function crearLigaduraDeLlaveConJugador(cuerpoDelPortador) {
  const nuevaLigadura = Constraint.create({
    bodyA:     cuerpoDelPortador,
    bodyB:     llaveDelNivel,
    pointA:    { x: 0, y: -DISTANCIA_DE_LIGADURA_DE_LLAVE },
    pointB:    { x: 0, y: 0 },
    stiffness: 1,
    length:    0,
    render: {
      visible:     true,
      strokeStyle: "#f1c40f",
      lineWidth:   2,
    },
  });
  Body.setStatic(llaveDelNivel, false);
  World.add(mundoDeFisica, nuevaLigadura);
  ligaduraDeLlave = nuevaLigadura;
}

function resetearLlave() {
  if (ligaduraDeLlave !== null) {
    World.remove(mundoDeFisica, ligaduraDeLlave);
    ligaduraDeLlave = null;
  }
  jugadorQueCargarLaLlave = null;
  Body.setStatic(llaveDelNivel, true);
  Body.setPosition(llaveDelNivel, obtenerPosicionInicialDeLlave(nivelActual));
  Body.setVelocity(llaveDelNivel, { x: 0, y: 0 });
  actualizarIndicadorDeLlave(null);
}

function obtenerPosicionInicialDeLlave(numeroDeNivel) {
  const posiciones = { 1: { x: 640, y: 232 }, 2: { x: 640, y: 202 } };
  return posiciones[numeroDeNivel] || { x: 640, y: 232 };
}

// =============================================================================
// NIVEL MEDIO — Eventos de colisión
// =============================================================================

function escucharEventosDeFisica() {
  Events.on(motorDeFisica, "collisionStart", (evento) => {
    evento.pairs.forEach((par) => procesarColision(par.bodyA, par.bodyB));
  });
}

function procesarColision(cuerpoA, cuerpoB) {
  const involucraLlave = cuerpoA.label === "llave" || cuerpoB.label === "llave";
  if (!involucraLlave) return;

  const cuerpoDelJugador = cuerpoA.label === "llave" ? cuerpoB : cuerpoA;
  intentarRecogerLlave(cuerpoDelJugador);
}

function intentarRecogerLlave(cuerpoDelJugador) {
  const yaHayPortador = jugadorQueCargarLaLlave !== null;
  if (yaHayPortador) return;

  const idDelJugador = Object.keys(jugadoresEnPantalla).find(
    (id) => jugadoresEnPantalla[id] === cuerpoDelJugador
  );
  if (idDelJugador === undefined) return;

  jugadorQueCargarLaLlave = idDelJugador;
  crearLigaduraDeLlaveConJugador(cuerpoDelJugador);
  actualizarIndicadorDeLlave(idDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Condición de victoria
// =============================================================================

function verificarCondicionesDeVictoria() {
  if (elNivelYaTermino) return;
  if (Object.keys(jugadoresEnPantalla).length === 0) return;
  if (llaveDelNivel === null || zonaDeSalidaDelNivel === null) return;

  const alguienTieneLaLlave  = jugadorQueCargarLaLlave !== null;
  const todosEstanEnLaSalida = verificarSiTodosEstanEnZonaDeSalida();

  if (alguienTieneLaLlave && todosEstanEnLaSalida) {
    elNivelYaTermino = true;
    activarPantallaDeVictoria();
  }
}

function verificarSiTodosEstanEnZonaDeSalida() {
  const ids = Object.keys(jugadoresEnPantalla);
  if (ids.length === 0) return false;
  return ids.every((id) =>
    verificarSiCuerpoEstaEnZona(jugadoresEnPantalla[id], zonaDeSalidaDelNivel)
  );
}

function verificarSiCuerpoEstaEnZona(cuerpo, zona) {
  const limites = zona.bounds;
  return (
    cuerpo.position.x > limites.min.x &&
    cuerpo.position.x < limites.max.x &&
    cuerpo.position.y > limites.min.y &&
    cuerpo.position.y < limites.max.y
  );
}

function activarPantallaDeVictoria() {
  const pantalla        = document.getElementById("pantalla-de-victoria");
  const esElUltimoNivel = nivelActual === CANTIDAD_TOTAL_DE_NIVELES;

  pantalla.classList.add("visible");

  document.getElementById("texto-de-victoria").textContent =
    esElUltimoNivel ? "🏆 ¡Juego completado!" : "🎉 ¡Nivel completado!";

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
  socketDelJuego.on("jugador_asignado",          manejarAsignacionDeJugador);
  socketDelJuego.on("actualizacion_de_jugadores", manejarActualizacionDeJugadores);
  socketDelJuego.on("tick_del_juego",            manejarTickDelJuego);
}

function manejarAsignacionDeJugador(datosDelJugador) {
  agregarJugadorAlMundo(
    datosDelJugador.id,
    datosDelJugador.color,
    datosDelJugador.indiceDeColor
  );
}

function manejarActualizacionDeJugadores(jugadoresDelServidor) {
  const idsEnServidor = Object.keys(jugadoresDelServidor);
  const idsEnPantalla = Object.keys(jugadoresEnPantalla);

  idsEnServidor.forEach((id) => {
    if (jugadoresEnPantalla[id] !== undefined) return;
    const datos = jugadoresDelServidor[id];
    agregarJugadorAlMundo(datos.id, datos.color, datos.indiceDeColor);
  });

  idsEnPantalla.forEach((id) => {
    if (jugadoresDelServidor[id] === undefined) eliminarJugadorDelMundo(id);
  });

  actualizarPanelDeJugadores(jugadoresDelServidor);
}

function manejarTickDelJuego(estadoDelJuego) {
  Object.keys(estadoDelJuego.jugadores).forEach((id) => {
    const inputDelServidor = estadoDelJuego.jugadores[id].input;
    if (!inputsDeJugadores[id]) return;

    inputsDeJugadores[id].izquierda = inputDelServidor.izquierda;
    inputsDeJugadores[id].derecha   = inputDelServidor.derecha;
    if (inputDelServidor.salto) inputsDeJugadores[id].salto = true;
  });
}

// =============================================================================
// NIVEL BAJO — UI
// =============================================================================

function actualizarPanelDeJugadores(jugadoresDelServidor) {
  const lista = document.getElementById("lista-de-jugadores");
  lista.innerHTML = "";
  Object.values(jugadoresDelServidor).forEach((datos, indice) => {
    const div       = document.createElement("div");
    div.className   = "indicador-de-jugador";
    div.innerHTML   = `
      <span class="circulo-de-color-del-jugador"
            style="background-color:${datos.color}"></span>
      <span>Jugador ${indice + 1}</span>
    `;
    lista.appendChild(div);
  });
}

function actualizarTituloDelNivel(numeroDeNivel) {
  document.getElementById("titulo-del-nivel").textContent =
    TITULOS_DE_NIVELES[numeroDeNivel] || `Nivel ${numeroDeNivel}`;
}

function actualizarIndicadorDeLlave(idDelPortador) {
  document.getElementById("indicador-de-llave").textContent =
    idDelPortador === null
      ? "🗝️ Nadie tiene la llave — ¡encuéntrenla!"
      : "🗝️ ¡Alguien tiene la llave! Todos a la salida 🟩";
}

// =============================================================================
// ARRANQUE
// =============================================================================
iniciarJuego();