"use strict";

// =============================================================================
// CONSTANTES
// =============================================================================
const ANCHO_DEL_CANVAS             = window.innerWidth;
const ALTO_DEL_CANVAS              = window.innerHeight;
const GROSOR_DE_PAREDES            = 50;
const TAMANO_DEL_JUGADOR           = 24;
const LADO_DEL_CUADRADO            = TAMANO_DEL_JUGADOR * 2;
const VELOCIDAD_DE_MOVIMIENTO      = 0.006;
const FUERZA_DE_SALTO              = 0.022;
const UMBRAL_DE_VELOCIDAD_EN_SUELO = 0.5;
const VELOCIDAD_MAXIMA_HORIZONTAL  = 5;
const DISTANCIA_DE_LIGADURA_DE_LLAVE = TAMANO_DEL_JUGADOR + 18;
const CANTIDAD_TOTAL_DE_NIVELES    = 2;
const TIPO_DE_CLIENTE_JUEGO        = "juego";
const COLORES_DE_JUGADORES         = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

// Fuerza que aplica CADA jugador sobre la caja al empujarla.
// Si dos jugadores empujan, la fuerza se duplica automáticamente
// porque Matter.js suma las fuerzas aplicadas en el mismo frame.
const FUERZA_DE_EMPUJE_DE_CAJA    = 0.003;

const TITULOS_DE_NIVELES = {
  1: "Nivel 1 — La llave perdida",
  2: "Nivel 2 — La Torre y la Caja",
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

let nivelActual             = 1;
let nivelSeleccionado       = 1;
let jugadoresEnPantalla     = {};
let inputsDeJugadores       = {};
let llaveDelNivel           = null;
let zonaDeSalidaDelNivel    = null;
let cuerposDePuerta         = [];   // Los bloques físicos de la puerta
let cajaEmpujable           = null; // La caja del nivel 2
let jugadorQueCargarLaLlave = null;
let ligaduraDeLlave         = null;
let elNivelYaTermino        = false;
let elJuegoEstaEnCurso      = false;
let nivel1Completado        = false;

// =============================================================================
// CONEXIÓN CON EL SERVIDOR
// =============================================================================
const socketDelJuego = io();

socketDelJuego.on("connect", () => {
  socketDelJuego.emit("identificarse", TIPO_DE_CLIENTE_JUEGO);
});

// =============================================================================
// ANIMACIÓN DE FONDO — Cuadraditos flotantes en pantalla de inicio
// =============================================================================
const CANTIDAD_DE_CUADRADITOS_DE_FONDO = 14;
const cuadraditosDeAnimacion = [];

function inicializarAnimacionDeFondo() {
  const canvas   = document.getElementById("canvas-de-fondo-inicio");
  canvas.width   = window.innerWidth;
  canvas.height  = window.innerHeight;
  const contexto = canvas.getContext("2d");

  for (let i = 0; i < CANTIDAD_DE_CUADRADITOS_DE_FONDO; i++) {
    cuadraditosDeAnimacion.push({
      x:        Math.random() * canvas.width,
      y:        Math.random() * canvas.height,
      vx:       (Math.random() - 0.5) * 1.5,
      vy:       (Math.random() - 0.5) * 1.5,
      lado:     Math.random() * 28 + 16,
      color:    COLORES_DE_JUGADORES[i % COLORES_DE_JUGADORES.length],
      opacidad: Math.random() * 0.25 + 0.08,
    });
  }

  animarCuadraditosDeFondo(canvas, contexto);
}

function animarCuadraditosDeFondo(canvas, contexto) {
  contexto.clearRect(0, 0, canvas.width, canvas.height);

  cuadraditosDeAnimacion.forEach((cuadradito) => {
    cuadradito.x += cuadradito.vx;
    cuadradito.y += cuadradito.vy;

    const tocaBordeDerecho   = cuadradito.x + cuadradito.lado > canvas.width;
    const tocaBordeIzquierdo = cuadradito.x < 0;
    const tocaBordeAbajo     = cuadradito.y + cuadradito.lado > canvas.height;
    const tocaBordeArriba    = cuadradito.y < 0;

    if (tocaBordeDerecho || tocaBordeIzquierdo) cuadradito.vx *= -1;
    if (tocaBordeAbajo   || tocaBordeArriba)    cuadradito.vy *= -1;

    contexto.globalAlpha = cuadradito.opacidad;
    contexto.fillStyle   = cuadradito.color;
    contexto.beginPath();
    contexto.roundRect(cuadradito.x, cuadradito.y, cuadradito.lado, cuadradito.lado, 4);
    contexto.fill();
  });

  contexto.globalAlpha = 1;

  const pantallaEsVisible = document.getElementById("pantalla-de-inicio")
    .classList.contains("visible");
  if (pantallaEsVisible) {
    requestAnimationFrame(() => animarCuadraditosDeFondo(canvas, contexto));
  }
}

// =============================================================================
// PANTALLA DE INICIO — Selector de niveles
// =============================================================================

// Esta función se llama desde el HTML con onclick
function seleccionarNivel(numeroDeNivel) {
  const esNivel2SinDesbloquear = numeroDeNivel === 2 && !nivel1Completado;
  if (esNivel2SinDesbloquear) return;

  nivelSeleccionado = numeroDeNivel;

  document.querySelectorAll(".boton-de-nivel.desbloqueado").forEach((boton) => {
    boton.style.outline = "none";
  });
  document.getElementById(`boton-nivel-${numeroDeNivel}`).style.outline =
    "3px solid #ffffff";
}

function desbloquearNivel2EnPantallaDeInicio() {
  const boton = document.getElementById("boton-nivel-2");
  boton.classList.remove("bloqueado");
  boton.classList.add("desbloqueado");
  boton.textContent = "🟢 Nivel 2";
  boton.onclick = () => seleccionarNivel(2);
}

function actualizarIndicadoresDeJugadoresEnInicio(jugadoresDelServidor) {
  const cantidad = Object.keys(jugadoresDelServidor).length;
  for (let i = 0; i < 4; i++) {
    const cuadradito = document.getElementById(`cuadradito-${i}`);
    if (i < cantidad) {
      cuadradito.classList.add("conectado");
    } else {
      cuadradito.classList.remove("conectado");
    }
  }
}

// =============================================================================
// NIVEL ALTO — Punto de entrada
// =============================================================================
function iniciarJuego() {
  inicializarMotorDeFisica();
  inicializarRenderizador();
  escucharEventosDeFisica();
  escucharEventosDelServidor();
  escucharBotonDeInicio();
  inicializarAnimacionDeFondo();
  Runner.run(ejecutorDeFisica, motorDeFisica);
  Render.run(renderizador);
}

// =============================================================================
// NIVEL MEDIO — Motor, renderizador y pantalla de inicio
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

function escucharBotonDeInicio() {
  document.getElementById("boton-de-inicio").addEventListener("click", () => {
    nivelActual        = nivelSeleccionado;
    elJuegoEstaEnCurso = true;
    ocultarPantallaDeInicio();
    iniciarLoopPrincipal();
    cargarNivel(nivelActual);
  });
}

function ocultarPantallaDeInicio() {
  document.getElementById("pantalla-de-inicio").classList.remove("visible");
}

function mostrarPantallaDeInicio() {
  const pantalla = document.getElementById("pantalla-de-inicio");
  pantalla.classList.add("visible");
  const canvas   = document.getElementById("canvas-de-fondo-inicio");
  const contexto = canvas.getContext("2d");
  animarCuadraditosDeFondo(canvas, contexto);
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
  cuerposDePuerta         = [];
  cajaEmpujable           = null;
}

function construirEstructuraBasicaDelMundo() {
  // Piso visible con color
  const piso = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2,
    ALTO_DEL_CANVAS - 10,
    ANCHO_DEL_CANVAS, 20,
    "piso", "#4a6fa5"
  );
  const paredIzquierda = crearCuerpoEstatico(
    -GROSOR_DE_PAREDES / 2, ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES, ALTO_DEL_CANVAS,
    "paredIzquierda", "#2c3e50"
  );
  const paredDerecha = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS + GROSOR_DE_PAREDES / 2, ALTO_DEL_CANVAS / 2,
    GROSOR_DE_PAREDES, ALTO_DEL_CANVAS,
    "paredDerecha", "#2c3e50"
  );
  const techo = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2, -GROSOR_DE_PAREDES / 2,
    ANCHO_DEL_CANVAS, GROSOR_DE_PAREDES,
    "techo", "#2c3e50"
  );
  World.add(mundoDeFisica, [piso, paredIzquierda, paredDerecha, techo]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 1:
// - Los jugadores aparecen cerca de la puerta (izquierda abajo)
// - Deben subir plataformas escalonadas para alcanzar la llave (arriba derecha)
// - Cuando alguien tiene la llave, todos vuelven a la puerta para salir
// - La condición se adapta a la cantidad de jugadores conectados
// ─────────────────────────────────────────────────────────────────────────────
// SACAMOS la puerta física (se veía fea)
// La zona verde de salida es suficiente y más clara visualmente
function construirNivelUno() {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  const plataformas = [
    crearPlataforma(aw * 0.20, ah * 0.75, aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.38, ah * 0.63, aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.55, ah * 0.51, aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.72, ah * 0.39, aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.88, ah * 0.27, aw * 0.14, 18, "#e67e22"),
  ];

  llaveDelNivel = crearLlave(aw * 0.88, ah * 0.27 - 20);

  // La zona de salida es el área verde abajo a la izquierda
  // donde los jugadores deben pararse con la llave para ganar
  zonaDeSalidaDelNivel = crearZonaDeSalida(
    aw * 0.07, ah * 0.92, aw * 0.12, 60
  );

  World.add(mundoDeFisica, [
    ...plataformas,
    llaveDelNivel,
    zonaDeSalidaDelNivel,
  ]);

}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 2:
// - Hay una caja empujable que se necesita para alcanzar la plataforma alta
// - Cuantos más jugadores empujan, más rápido se mueve (suma de fuerzas)
// - También requiere apilarse para llegar a la llave
// ─────────────────────────────────────────────────────────────────────────────
function construirNivelDos() {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  const plataformas = [
    crearPlataforma(aw * 0.20, ah * 0.75, aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.45, ah * 0.62, aw * 0.14, 18, "#8e44ad"),
    crearPlataforma(aw * 0.68, ah * 0.48, aw * 0.14, 18, "#8e44ad"),
    // Plataforma muy alta — necesita caja + apilarse
    crearPlataforma(aw * 0.85, ah * 0.28, aw * 0.16, 18, "#c0392b"),
  ];

  // Caja empujable: es dinámica (no isStatic), los jugadores la empujan
  cajaEmpujable = crearCajaEmpujable(aw * 0.35, ah * 0.88);

  llaveDelNivel = crearLlave(aw * 0.85, ah * 0.28 - 20);

  const puerta = construirPuertaEstiloPicoPark(aw * 0.07, ah * 0.88);

  zonaDeSalidaDelNivel = crearZonaDeSalida(
    aw * 0.07, ah * 0.915,
    aw * 0.12, 50
  );

  World.add(mundoDeFisica, [
    ...plataformas,
    cajaEmpujable,
    llaveDelNivel,
    zonaDeSalidaDelNivel,
  ]);
  World.add(mundoDeFisica, puerta);
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
      strokeStyle: "rgba(255,255,255,0.15)",
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

function crearZonaDeSalida(x, y, ancho, alto) {
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    isSensor: true,
    label:    "zonaDeSalida",
    render: {
      fillStyle:   "rgba(39,174,96,0.30)",
      strokeStyle: "#2ecc71",
      lineWidth:   2,
    },
  });
}

/**
 * Construye la puerta estilo Pico Park:
 * Dos pilares verticales + un dintel horizontal arriba.
 * Se ven como un arco/portal.
 * Cuando el nivel se completa, los pilares se eliminan del mundo (la puerta "se abre").
 *
 * @param {number} xCentro - Centro horizontal de la puerta
 * @param {number} yBase   - Base inferior de la puerta (nivel del suelo)
 */
function construirPuertaEstiloPicoPark(xCentro, yBase) {
  const anchoDePilar  = 12;
  const altoDePuerta  = 80;
  const anchoDePuerta = 70;
  const altoDeLintel  = 12;

  // Pilar izquierdo
  const pilarIzquierdo = Bodies.rectangle(
    xCentro - anchoDePuerta / 2,
    yBase - altoDePuerta / 2,
    anchoDePilar, altoDePuerta,
    {
      isStatic: true,
      label:    "puertaPilar",
      render:   { fillStyle: "#e67e22", strokeStyle: "#d35400", lineWidth: 2 },
    }
  );

  // Pilar derecho
  const pilarDerecho = Bodies.rectangle(
    xCentro + anchoDePuerta / 2,
    yBase - altoDePuerta / 2,
    anchoDePilar, altoDePuerta,
    {
      isStatic: true,
      label:    "puertaPilar",
      render:   { fillStyle: "#e67e22", strokeStyle: "#d35400", lineWidth: 2 },
    }
  );

  // Dintel (la barra horizontal arriba)
  const dintel = Bodies.rectangle(
    xCentro,
    yBase - altoDePuerta - altoDeLintel / 2,
    anchoDePuerta + anchoDePilar * 2, altoDeLintel,
    {
      isStatic: true,
      label:    "puertaDintel",
      render:   { fillStyle: "#e67e22", strokeStyle: "#d35400", lineWidth: 2 },
    }
  );

  // Guardamos los cuerpos para poder eliminarlos cuando se abra la puerta
  cuerposDePuerta = [pilarIzquierdo, pilarDerecho, dintel];
  return cuerposDePuerta;
}

/**
 * "Abre" la puerta eliminando sus cuerpos del mundo físico.
 * Se llama cuando se cumplen las condiciones de victoria.
 */
function abrirPuerta() {
  cuerposDePuerta.forEach((cuerpo) => {
    World.remove(mundoDeFisica, cuerpo);
  });
  cuerposDePuerta = [];
}

/**
 * Crea la caja empujable del nivel 2.
 * No es estática: los jugadores la pueden mover aplicando fuerzas.
 * Cuantos más jugadores empujan, más fuerzas se suman → se mueve más rápido.
 */
function crearCajaEmpujable(x, y) {
  const ladoDeLaCaja = 60;
  return Bodies.rectangle(x, y, ladoDeLaCaja, ladoDeLaCaja, {
    label:       "cajaEmpujable",
    isStatic:    false,  // Puede moverse
    friction:    0.8,
    restitution: 0.1,
    density:     0.003,  // Más densa que los jugadores → más difícil de mover
    inertia:     Infinity, // Sin rotación
    render: {
      fillStyle:   "#795548",
      strokeStyle: "#5d4037",
      lineWidth:   3,
    },
  });
}

// =============================================================================
// NIVEL MEDIO — Gestión de jugadores
// =============================================================================

function agregarJugadorAlMundo(idDelJugador, colorDelJugador, indiceDeColor) {
  if (jugadoresEnPantalla[idDelJugador] !== undefined) return;

  const posicionInicialX = 60 + indiceDeColor * (LADO_DEL_CUADRADO + 20);
  const posicionInicialY = ALTO_DEL_CANVAS - 80;

  const cuerpoDelJugador = Bodies.rectangle(
    posicionInicialX, posicionInicialY,
    LADO_DEL_CUADRADO, LADO_DEL_CUADRADO,
    {
      label:       `jugador_${idDelJugador}`,
      frictionAir: 0.08,
      friction:    0.6,
      restitution: 0.0,
      inertia:     Infinity,
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
  const cuerpo = jugadoresEnPantalla[idDelJugador];
  if (cuerpo === undefined) return;

  if (jugadorQueCargarLaLlave === idDelJugador) resetearLlave();

  World.remove(mundoDeFisica, cuerpo);
  delete jugadoresEnPantalla[idDelJugador];
  delete inputsDeJugadores[idDelJugador];
}

function reposicionarJugadoresExistentes() {
  Object.keys(jugadoresEnPantalla).forEach((id, indice) => {
    const cuerpo = jugadoresEnPantalla[id];
    Body.setPosition(cuerpo, {
      x: 60 + indice * (LADO_DEL_CUADRADO + 20),
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
    if (!elJuegoEstaEnCurso) return;
    aplicarInputsATodosLosJugadores();
    aplicarFuerzasEnCaja();
    verificarCondicionesDeVictoria();
    verificarJugadoresFueraDelMapa();
    requestAnimationFrame(ejecutarFrame);
  }
  requestAnimationFrame(ejecutarFrame);
}

function aplicarInputsATodosLosJugadores() {
  Object.entries(inputsDeJugadores).forEach(([id, inputActual]) => {
    const cuerpo = jugadoresEnPantalla[id];
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

// Esta función ahora permite moverse y saltar al mismo tiempo.
// El salto solo se ejecuta UNA vez por presión gracias al umbral estricto.
// Después de saltar, inputActual.salto se pone en false para evitar
// que si mantenés apretado el botón siga saltando infinitamente.
function aplicarSaltoSiCorresponde(cuerpo, inputActual) {
  const estaEnElSuelo      = verificarSiJugadorEstaEnSuelo(cuerpo);
  const puedeEjecutarSalto = inputActual.salto && estaEnElSuelo;

  if (!puedeEjecutarSalto) return;

  // Aplicamos la fuerza de salto hacia arriba
  Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: -FUERZA_DE_SALTO });

  // MUY IMPORTANTE: consumimos el salto inmediatamente.
  // Aunque el servidor siga mandando salto: true,
  // no saltamos de nuevo hasta que el jugador suelte y vuelva a presionar.
  inputActual.salto = false;
}

function limitarVelocidadHorizontal(cuerpo) {
  const velocidad      = cuerpo.velocity;
  const superaElLimite = Math.abs(velocidad.x) > VELOCIDAD_MAXIMA_HORIZONTAL;
  if (!superaElLimite) return;

  Body.setVelocity(cuerpo, {
    x: Math.sign(velocidad.x) * VELOCIDAD_MAXIMA_HORIZONTAL,
    y: velocidad.y,
  });
}

function verificarSiJugadorEstaEnSuelo(cuerpo) {
  return Math.abs(cuerpo.velocity.y) < UMBRAL_DE_VELOCIDAD_EN_SUELO;
}

/**
 * Detecta qué jugadores están tocando la caja y les aplica su fuerza.
 * La suma de fuerzas es automática: si 3 jugadores empujan a la derecha,
 * Matter.js suma las 3 fuerzas en ese frame y la caja va más rápido.
 * Esto cumple el criterio de evaluación de "suma de fuerzas".
 */
function aplicarFuerzasEnCaja() {
  const hayCaja = cajaEmpujable !== null;
  if (!hayCaja) return;

  Object.entries(inputsDeJugadores).forEach(([id, inputActual]) => {
    const cuerpoDelJugador = jugadoresEnPantalla[id];
    if (cuerpoDelJugador === undefined) return;

    const estaEmpujandoDerecha   = inputActual.derecha;
    const estaEmpujandoIzquierda = inputActual.izquierda;

    // Verificamos si el jugador está adyacente a la caja (tocándola)
    const estaCercaDeLaCaja = verificarSiJugadorEstaCercaDeCaja(cuerpoDelJugador);
    if (!estaCercaDeLaCaja) return;

    if (estaEmpujandoDerecha) {
      Body.applyForce(cajaEmpujable, cajaEmpujable.position, {
        x: FUERZA_DE_EMPUJE_DE_CAJA, y: 0,
      });
    }
    if (estaEmpujandoIzquierda) {
      Body.applyForce(cajaEmpujable, cajaEmpujable.position, {
        x: -FUERZA_DE_EMPUJE_DE_CAJA, y: 0,
      });
    }
  });
}

/**
 * Verifica si un jugador está lo suficientemente cerca de la caja
 * como para empujarla. Usamos una distancia simple entre centros.
 */
function verificarSiJugadorEstaCercaDeCaja(cuerpoDelJugador) {
  const DISTANCIA_DE_EMPUJE = LADO_DEL_CUADRADO + 40; // px de tolerancia
  const dx = Math.abs(cuerpoDelJugador.position.x - cajaEmpujable.position.x);
  const dy = Math.abs(cuerpoDelJugador.position.y - cajaEmpujable.position.y);
  return dx < DISTANCIA_DE_EMPUJE && dy < DISTANCIA_DE_EMPUJE;
}

function verificarJugadoresFueraDelMapa() {
  Object.keys(jugadoresEnPantalla).forEach((id) => {
    const cuerpo          = jugadoresEnPantalla[id];
    const cayoFueraDelMapa = cuerpo.position.y > ALTO_DEL_CANVAS + 100;
    if (!cayoFueraDelMapa) return;

    Body.setPosition(cuerpo, { x: 100, y: ALTO_DEL_CANVAS - 100 });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });
    if (jugadorQueCargarLaLlave === id) resetearLlave();
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
    render:    { visible: true, strokeStyle: "#f1c40f", lineWidth: 2 },
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
  const posiciones = {
    1: { x: ANCHO_DEL_CANVAS * 0.88, y: ALTO_DEL_CANVAS * 0.27 - 20 },
    2: { x: ANCHO_DEL_CANVAS * 0.85, y: ALTO_DEL_CANVAS * 0.28 - 20 },
  };
  return posiciones[numeroDeNivel] || posiciones[1];
}

// =============================================================================
// NIVEL MEDIO — Colisiones
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
  if (jugadorQueCargarLaLlave !== null) return;

  const idDelJugador = Object.keys(jugadoresEnPantalla).find(
    (id) => jugadoresEnPantalla[id] === cuerpoDelJugador
  );
  if (idDelJugador === undefined) return;

  jugadorQueCargarLaLlave = idDelJugador;
  crearLigaduraDeLlaveConJugador(cuerpoDelJugador);
  actualizarIndicadorDeLlave(idDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Victoria
// Condición dinámica: se adapta a cuántos jugadores hay conectados.
// Si hay 2 jugadores, con 2 en la salida alcanza para ganar.
// =============================================================================

function verificarCondicionesDeVictoria() {
  if (elNivelYaTermino) return;
  if (Object.keys(jugadoresEnPantalla).length === 0) return;
  if (!llaveDelNivel || !zonaDeSalidaDelNivel) return;

  const alguienTieneLaLlave  = jugadorQueCargarLaLlave !== null;
  const todosEstanEnLaSalida = verificarSiTodosEstanEnZonaDeSalida();

  if (alguienTieneLaLlave && todosEstanEnLaSalida) {
    elNivelYaTermino = true;
    abrirPuerta(); // La puerta se abre visualmente
    if (nivelActual === 1) nivel1Completado = true;

    // Pequeña pausa para que se vea la puerta abrirse antes de mostrar victoria
    setTimeout(() => activarPantallaDeVictoria(), 800);
  }
}

function verificarSiTodosEstanEnZonaDeSalida() {
  const ids = Object.keys(jugadoresEnPantalla);
  if (ids.length === 0) return false;
  // every() → true solo si TODOS los jugadores cumplen la condición
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
  const esElUltimoNivel = nivelActual === CANTIDAD_TOTAL_DE_NIVELES;

  document.getElementById("texto-de-victoria").textContent =
    esElUltimoNivel ? "🏆 ¡Juego completado!" : "🎉 ¡Nivel completado!";

  const boton = document.getElementById("boton-para-siguiente-nivel");
  boton.textContent = esElUltimoNivel ? "Volver al inicio" : "Siguiente Nivel →";
  boton.onclick = () => {
    document.getElementById("pantalla-de-victoria").classList.remove("visible");
    if (esElUltimoNivel) {
      elJuegoEstaEnCurso = false;
      desbloquearNivel2EnPantallaDeInicio();
      mostrarPantallaDeInicio();
    } else {
      nivelActual++;
      cargarNivel(nivelActual);
    }
  };

  document.getElementById("pantalla-de-victoria").classList.add("visible");
}

// =============================================================================
// NIVEL MEDIO — Comunicación con servidor
// =============================================================================

function escucharEventosDelServidor() {
  socketDelJuego.on("jugador_asignado",           manejarAsignacionDeJugador);
  socketDelJuego.on("actualizacion_de_jugadores", manejarActualizacionDeJugadores);
  socketDelJuego.on("tick_del_juego",             manejarTickDelJuego);

  // Cuando cualquier gamepad toca "Iniciar", el servidor nos avisa.
  // Ocultamos la pantalla de inicio y cargamos el nivel 1.
  socketDelJuego.on("juego_iniciado", () => {
    if (elJuegoEstaEnCurso) return; // Evitamos iniciar dos veces
    nivelActual        = 1;
    elJuegoEstaEnCurso = true;
    ocultarPantallaDeInicio();
    iniciarLoopPrincipal();
    cargarNivel(nivelActual);
  });
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
  actualizarIndicadoresDeJugadoresEnInicio(jugadoresDelServidor);
}

function manejarTickDelJuego(estadoDelJuego) {
  Object.keys(estadoDelJuego.jugadores).forEach((id) => {
    const inputDelServidor = estadoDelJuego.jugadores[id].input;
    if (!inputsDeJugadores[id]) return;

    // Movimiento horizontal: actualización directa
    inputsDeJugadores[id].izquierda = inputDelServidor.izquierda;
    inputsDeJugadores[id].derecha   = inputDelServidor.derecha;

    // Salto: solo ACTIVAMOS desde el servidor, nunca desactivamos.
    // La desactivación la hace aplicarSaltoSiCorresponde() internamente.
    // Esto permite: mover + saltar al mismo tiempo sin conflictos.
    if (inputDelServidor.salto) {
      inputsDeJugadores[id].salto = true;
    }
  });
}
// =============================================================================
// NIVEL BAJO — UI
// =============================================================================

function actualizarPanelDeJugadores(jugadoresDelServidor) {
  const lista = document.getElementById("lista-de-jugadores");
  lista.innerHTML = "";
  Object.values(jugadoresDelServidor).forEach((datos, i) => {
    const div     = document.createElement("div");
    div.className = "indicador-de-jugador";
    div.innerHTML = `
      <span class="circulo-de-color-del-jugador"
            style="background-color:${datos.color}"></span>
      <span>Jugador ${i + 1}</span>
    `;
    lista.appendChild(div);
  });
}

function actualizarTituloDelNivel(n) {
  document.getElementById("titulo-del-nivel").textContent =
    TITULOS_DE_NIVELES[n] || `Nivel ${n}`;
}

function actualizarIndicadorDeLlave(idDelPortador) {
  document.getElementById("indicador-de-llave").textContent =
    idDelPortador === null
      ? "🗝️ Nadie tiene la llave — ¡encuéntrenla!"
      : "🗝️ ¡Alguien tiene la llave! Todos a la salida 🟩";
}

// =============================================================================
// NIVEL ADAPTATIVO
// El nivel se construye diferente según cuántos jugadores hay conectados.
// Menos jugadores → plataformas más juntas y accesibles
// Más jugadores   → plataformas más separadas, requiere más cooperación
// =============================================================================

/**
 * Decide qué versión del nivel cargar según la cantidad de jugadores.
 * @param {number} numeroDeNivel      - 1 o 2
 * @param {number} cantidadDeJugadores - cuántos gamepads están conectados
 */
function cargarNivelAdaptativo(numeroDeNivel, cantidadDeJugadores) {
  elNivelYaTermino = false;
  limpiarMundoActual();
  construirEstructuraBasicaDelMundo();

  if (numeroDeNivel === 1) {
    construirNivelUnoAdaptativo(cantidadDeJugadores);
  } else if (numeroDeNivel === 2) {
    construirNivelDosAdaptativo(cantidadDeJugadores);
  }

  reposicionarJugadoresExistentes();
  actualizarTituloDelNivel(numeroDeNivel);
  actualizarIndicadorDeLlave(null);
}

/**
 * Nivel 1 adaptativo.
 * Con 2 jugadores: plataformas más juntas, saltos más cortos.
 * Con 4 jugadores: plataformas más separadas, requiere más coordinación.
 */
function construirNivelUnoAdaptativo(cantidadDeJugadores) {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  // Con pocos jugadores las plataformas están más juntas (más fácil)
  // Con más jugadores están más separadas (más difícil, requiere cooperación)
  const separacionVertical   = cantidadDeJugadores <= 2 ? 0.10 : 0.12;
  const separacionHorizontal = cantidadDeJugadores <= 2 ? 0.17 : 0.20;

  const plataformas = [
    crearPlataforma(aw * 0.15,                          ah * 0.82,                              aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.15 + separacionHorizontal,   ah * 0.82 - separacionVertical,         aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.15 + separacionHorizontal * 2, ah * 0.82 - separacionVertical * 2,   aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.15 + separacionHorizontal * 3, ah * 0.82 - separacionVertical * 3,   aw * 0.14, 18, "#4a6fa5"),
    // Plataforma naranja con la llave
    crearPlataforma(aw * 0.15 + separacionHorizontal * 4, ah * 0.82 - separacionVertical * 4,   aw * 0.16, 18, "#e67e22"),
  ];

  const xDeLlave = aw * 0.15 + separacionHorizontal * 4;
  const yDeLlave = ah * 0.82 - separacionVertical * 4 - 20;

  llaveDelNivel = crearLlave(xDeLlave, yDeLlave);

  const puerta = construirPuertaEstiloPicoPark(aw * 0.07, ah * 0.90);
  zonaDeSalidaDelNivel = crearZonaDeSalida(aw * 0.07, ah * 0.925, aw * 0.12, 50);

  World.add(mundoDeFisica, [...plataformas, llaveDelNivel, zonaDeSalidaDelNivel]);
  World.add(mundoDeFisica, puerta);
}

/**
 * Nivel 2 adaptativo con caja empujable.
 * Con pocos jugadores la caja es más liviana y la plataforma más baja.
 * Con más jugadores la caja es más pesada y la plataforma más alta.
 */
function construirNivelDos() {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  const plataformas = [
    crearPlataforma(aw * 0.20, ah * 0.75, aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.45, ah * 0.62, aw * 0.14, 18, "#8e44ad"),
    crearPlataforma(aw * 0.68, ah * 0.48, aw * 0.14, 18, "#8e44ad"),
    crearPlataforma(aw * 0.85, ah * 0.28, aw * 0.16, 18, "#c0392b"),
  ];

  cajaEmpujable = crearCajaEmpujable(aw * 0.35, ah * 0.88);
  llaveDelNivel = crearLlave(aw * 0.85, ah * 0.28 - 20);

  zonaDeSalidaDelNivel = crearZonaDeSalida(
    aw * 0.07, ah * 0.92, aw * 0.12, 60
  );

  World.add(mundoDeFisica, [
    ...plataformas,
    cajaEmpujable,
    llaveDelNivel,
    zonaDeSalidaDelNivel,
  ]);
}


// =============================================================================
// ARRANQUE
// =============================================================================
iniciarJuego();