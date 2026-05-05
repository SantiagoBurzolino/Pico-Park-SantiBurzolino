"use strict";

// =============================================================================
// CONSTANTES
// Manual: sin números mágicos sueltos. Cada valor tiene nombre descriptivo.
// =============================================================================
const ANCHO_DEL_CANVAS = window.innerWidth;
const ALTO_DEL_CANVAS = window.innerHeight;
const GROSOR_DE_PAREDES = 50;
const TAMANO_DEL_JUGADOR = 24;
const LADO_DEL_CUADRADO = TAMANO_DEL_JUGADOR * 2;
const VELOCIDAD_DE_MOVIMIENTO = 0.006;
// En el aire la fuerza es menor: saltar+moverse no da ventaja de velocidad
const VELOCIDAD_DE_MOVIMIENTO_EN_AIRE = 0.003;
const FUERZA_DE_SALTO = 0.028;
const UMBRAL_DE_VELOCIDAD_EN_SUELO = 0.4;
const VELOCIDAD_MAXIMA_HORIZONTAL = 5;
// Límite de velocidad en el aire (menor que en suelo para consistencia)
const VELOCIDAD_MAXIMA_EN_AIRE = 4;
const DISTANCIA_DE_LIGADURA_DE_LLAVE = TAMANO_DEL_JUGADOR + 18;
const CANTIDAD_TOTAL_DE_NIVELES = 2;
// La rúbrica exige 4 jugadores en la salida para ganar
const CANTIDAD_DE_JUGADORES_PARA_GANAR = 4;
const TIPO_DE_CLIENTE_JUEGO = "juego";
const COLORES_DE_JUGADORES = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const FUERZA_DE_EMPUJE_DE_CAJA = 0.003;

const TITULOS_DE_NIVELES = {
  1: "Nivel 1 — La llave perdida",
  2: "Nivel 2 — La Torre y la Caja",
};

// =============================================================================
// ALIASES DE MATTER.JS
// Destructuring: sacamos solo lo que vamos a usar del objeto global Matter.
// =============================================================================
const { Engine, Render, Runner, Bodies, Body, World, Events, Constraint } =
  Matter;

// =============================================================================
// ESTADO GLOBAL DEL JUEGO
// =============================================================================
let motorDeFisica;
let renderizador;
let ejecutorDeFisica;
let mundoDeFisica;

let nivelActual = 1;
let nivelSeleccionado = 1;
let jugadoresEnPantalla = {};
let inputsDeJugadores = {};
let llaveDelNivel = null;
let zonaDeSalidaDelNivel = null;
let cuerposDePuerta = [];
let cajaEmpujable = null;
let jugadorQueCargarLaLlave = null;
let ligaduraDeLlave = null;
let elNivelYaTermino = false;
let elJuegoEstaEnCurso = false;
let nivel1Completado = false;
// Evita crear dos loops paralelos si el juego se inicia dos veces
let elLoopFueIniciado = false;

// =============================================================================
// CONEXIÓN CON EL SERVIDOR
// El juego se identifica como "juego" para que el servidor NO lo trate
// como un gamepad y no genere un cuadrado extra en pantalla.
// =============================================================================
const socketDelJuego = io();

socketDelJuego.on("connect", () => {
  socketDelJuego.emit("identificarse", TIPO_DE_CLIENTE_JUEGO);
});

// =============================================================================
// ANIMACIÓN DE FONDO
// Cuadraditos flotantes puramente visuales en la pantalla de inicio.
// =============================================================================
const CANTIDAD_DE_CUADRADITOS_DE_FONDO = 14;
const cuadraditosDeAnimacion = [];

function inicializarAnimacionDeFondo() {
  const canvas = document.getElementById("canvas-de-fondo-inicio");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const contexto = canvas.getContext("2d");

  for (let i = 0; i < CANTIDAD_DE_CUADRADITOS_DE_FONDO; i++) {
    cuadraditosDeAnimacion.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      lado: Math.random() * 28 + 16,
      color: COLORES_DE_JUGADORES[i % COLORES_DE_JUGADORES.length],
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

    const tocaBordeDerecho = cuadradito.x + cuadradito.lado > canvas.width;
    const tocaBordeIzquierdo = cuadradito.x < 0;
    const tocaBordeAbajo = cuadradito.y + cuadradito.lado > canvas.height;
    const tocaBordeArriba = cuadradito.y < 0;

    if (tocaBordeDerecho || tocaBordeIzquierdo) cuadradito.vx *= -1;
    if (tocaBordeAbajo || tocaBordeArriba) cuadradito.vy *= -1;

    contexto.globalAlpha = cuadradito.opacidad;
    contexto.fillStyle = cuadradito.color;
    contexto.beginPath();
    contexto.roundRect(
      cuadradito.x,
      cuadradito.y,
      cuadradito.lado,
      cuadradito.lado,
      4,
    );
    contexto.fill();
  });

  contexto.globalAlpha = 1;

  const pantallaEsVisible = document
    .getElementById("pantalla-de-inicio")
    .classList.contains("visible");
  if (pantallaEsVisible) {
    requestAnimationFrame(() => animarCuadraditosDeFondo(canvas, contexto));
  }
}

// =============================================================================
// PANTALLA DE INICIO — Selector de niveles
// =============================================================================

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
    if (!cuadradito) continue;
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
// NIVEL MEDIO — Pantalla de inicio
// =============================================================================

function escucharBotonDeInicio() {
  document.getElementById("boton-de-inicio").addEventListener("click", () => {
    iniciarPartida(nivelSeleccionado);
  });
}

/**
 * Centraliza el inicio del juego.
 * Se llama desde el botón de la PC.
 * elLoopFueIniciado evita crear dos loops paralelos.
 */
function iniciarPartida(numeroDeNivel) {
  if (elJuegoEstaEnCurso) return;

  nivelActual = numeroDeNivel;
  elJuegoEstaEnCurso = true;

  ocultarPantallaDeInicio();

  if (!elLoopFueIniciado) {
    elLoopFueIniciado = true;
    iniciarLoopPrincipal();
  }

  cargarNivel(nivelActual);
}

function ocultarPantallaDeInicio() {
  document.getElementById("pantalla-de-inicio").classList.remove("visible");
}

function mostrarPantallaDeInicio() {
  document.getElementById("pantalla-de-inicio").classList.add("visible");
  const canvas = document.getElementById("canvas-de-fondo-inicio");
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
  llaveDelNivel = null;
  zonaDeSalidaDelNivel = null;
  jugadorQueCargarLaLlave = null;
  cuerposDePuerta = [];
  cajaEmpujable = null;
}

function construirEstructuraBasicaDelMundo() {
  const piso = crearCuerpoEstatico(
    ANCHO_DEL_CANVAS / 2,
    ALTO_DEL_CANVAS - 10,
    ANCHO_DEL_CANVAS,
    20,
    "piso",
    "#4a6fa5",
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
// NIVEL 1
// Plataformas escalonadas. Cada escalón sube ~13% de la pantalla,
// saltable con FUERZA_DE_SALTO = 0.028.
// La llave está arriba a la derecha (plataforma naranja).
// La zona de salida (verde) está abajo a la izquierda.
// ─────────────────────────────────────────────────────────────────────────────
function construirNivelUno() {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  const plataformas = [
    crearPlataforma(aw * 0.18, ah * 0.8, aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.35, ah * 0.67, aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.52, ah * 0.54, aw * 0.14, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.69, ah * 0.41, aw * 0.14, 18, "#4a6fa5"),
    // Plataforma naranja — aquí está la llave
    crearPlataforma(aw * 0.84, ah * 0.28, aw * 0.16, 18, "#e67e22"),
  ];

  llaveDelNivel = crearLlave(aw * 0.84, ah * 0.28 - 22);

  zonaDeSalidaDelNivel = crearZonaDeSalida(aw * 0.08, ah * 0.91, aw * 0.13, 55);

  World.add(mundoDeFisica, [
    ...plataformas,
    llaveDelNivel,
    zonaDeSalidaDelNivel,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL 2
// Caja empujable: más jugadores empujando = más fuerzas = se mueve más rápido.
// Plataforma alta que requiere apilarse para llegar.
// ─────────────────────────────────────────────────────────────────────────────
function construirNivelDos() {
  const aw = ANCHO_DEL_CANVAS;
  const ah = ALTO_DEL_CANVAS;

  const plataformas = [
    crearPlataforma(aw * 0.2, ah * 0.75, aw * 0.16, 18, "#4a6fa5"),
    crearPlataforma(aw * 0.45, ah * 0.62, aw * 0.14, 18, "#8e44ad"),
    crearPlataforma(aw * 0.68, ah * 0.48, aw * 0.14, 18, "#8e44ad"),
    // Plataforma roja alta — necesita caja + apilarse
    crearPlataforma(aw * 0.85, ah * 0.28, aw * 0.16, 18, "#c0392b"),
  ];

  cajaEmpujable = crearCajaEmpujable(aw * 0.35, ah * 0.88);
  llaveDelNivel = crearLlave(aw * 0.85, ah * 0.28 - 22);

  zonaDeSalidaDelNivel = crearZonaDeSalida(aw * 0.08, ah * 0.91, aw * 0.13, 55);

  World.add(mundoDeFisica, [
    ...plataformas,
    cajaEmpujable,
    llaveDelNivel,
    zonaDeSalidaDelNivel,
  ]);
}

// =============================================================================
// NIVEL BAJO — Constructores de objetos físicos
// Cada función crea UN solo tipo de objeto (Principio SRP).
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
      strokeStyle: "rgba(255,255,255,0.15)",
      lineWidth: 1,
    },
  });
}

function crearLlave(x, y) {
  // isSensor: true → detecta colisiones pero no bloquea físicamente
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

function crearZonaDeSalida(x, y, ancho, alto) {
  // isSensor: true → los jugadores pueden entrar sin ser bloqueados
  return Bodies.rectangle(x, y, ancho, alto, {
    isStatic: true,
    isSensor: true,
    label: "zonaDeSalida",
    render: {
      fillStyle: "rgba(39,174,96,0.30)",
      strokeStyle: "#2ecc71",
      lineWidth: 2,
    },
  });
}

/**
 * Crea la caja empujable del nivel 2.
 * isStatic: false → puede moverse.
 * density: 0.003 → más densa que los jugadores, cuesta moverla sola.
 * inertia: Infinity → no rota al ser golpeada.
 */
function crearCajaEmpujable(x, y) {
  const LADO_DE_LA_CAJA = 60;
  return Bodies.rectangle(x, y, LADO_DE_LA_CAJA, LADO_DE_LA_CAJA, {
    label: "cajaEmpujable",
    isStatic: false,
    friction: 0.8,
    restitution: 0.1,
    density: 0.003,
    inertia: Infinity,
    render: {
      fillStyle: "#795548",
      strokeStyle: "#5d4037",
      lineWidth: 3,
    },
  });
}

// =============================================================================
// NIVEL MEDIO — Gestión de jugadores
// =============================================================================

/**
 * Crea el cuerpo físico del jugador y lo agrega al mundo.
 * Se llama apenas conecta el gamepad, sin esperar a que inicie el juego.
 * El jugador es visible en pantalla desde que conecta.
 */
function agregarJugadorAlMundo(idDelJugador, colorDelJugador, indiceDeColor) {
  if (jugadoresEnPantalla[idDelJugador] !== undefined) return;

  const posicionInicialX = 80 + indiceDeColor * (LADO_DEL_CUADRADO + 20);
  const posicionInicialY = ALTO_DEL_CANVAS - 60;

  const cuerpoDelJugador = Bodies.rectangle(
    posicionInicialX,
    posicionInicialY,
    LADO_DEL_CUADRADO,
    LADO_DEL_CUADRADO,
    {
      label: `jugador_${idDelJugador}`,
      frictionAir: 0.08,
      friction: 0.6,
      restitution: 0.0,
      // inertia Infinity: no rota al chocar → se apilan como bloques
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
      x: 80 + indice * (LADO_DEL_CUADRADO + 20),
      y: ALTO_DEL_CANVAS - 60,
    });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });
    
    // NUEVO: Volvemos a agregar el cuerpo al mundo físico porque limpiarMundoActual() lo había borrado
    World.add(mundoDeFisica, cuerpo); 
  });
}

// =============================================================================
// NIVEL MEDIO — Loop principal
// =============================================================================

function iniciarLoopPrincipal() {
  function ejecutarFrame() {
    // El loop corre siempre pero solo aplica física si el juego está en curso
    if (elJuegoEstaEnCurso) {
      aplicarInputsATodosLosJugadores();
      aplicarFuerzasEnCaja();
      verificarCondicionesDeVictoria();
      verificarJugadoresFueraDelMapa();
    }
    requestAnimationFrame(ejecutarFrame);
  }
  requestAnimationFrame(ejecutarFrame);
}

function aplicarInputsATodosLosJugadores() {
  // NUEVO: Si el nivel terminó, ignoramos los botones del gamepad
  if (elNivelYaTermino) return;

  Object.entries(inputsDeJugadores).forEach(([id, inputActual]) => {
    const cuerpo = jugadoresEnPantalla[id];
    if (cuerpo === undefined) return;

    aplicarMovimientoHorizontal(cuerpo, inputActual);
    aplicarSaltoSiCorresponde(cuerpo, inputActual);
    limitarVelocidadHorizontal(cuerpo);
  });
}

/**
 * Aplica fuerza horizontal.
 * En el aire la fuerza es VELOCIDAD_DE_MOVIMIENTO_EN_AIRE (la mitad).
 * Esto evita que saltar+moverse sea más rápido que solo moverse.
 */
function aplicarMovimientoHorizontal(cuerpo, inputActual) {
  const estaEnElAire = !verificarSiJugadorEstaEnSuelo(cuerpo);
  const fuerzaAplicar = estaEnElAire
    ? VELOCIDAD_DE_MOVIMIENTO_EN_AIRE
    : VELOCIDAD_DE_MOVIMIENTO;

  if (inputActual.izquierda) {
    Body.applyForce(cuerpo, cuerpo.position, { x: -fuerzaAplicar, y: 0 });
  }
  if (inputActual.derecha) {
    Body.applyForce(cuerpo, cuerpo.position, { x: fuerzaAplicar, y: 0 });
  }
}

/**
 * Aplica el salto UNA SOLA VEZ por presión.
 * inputActual.salto = false evita salto infinito al mantener presionado.
 * El movimiento horizontal funciona simultáneamente sin conflicto.
 */
function aplicarSaltoSiCorresponde(cuerpo, inputActual) {
  const estaEnElSuelo = verificarSiJugadorEstaEnSuelo(cuerpo);
  const puedeEjecutarSalto = inputActual.salto && estaEnElSuelo;
  if (!puedeEjecutarSalto) return;

  Body.applyForce(cuerpo, cuerpo.position, { x: 0, y: -FUERZA_DE_SALTO });
  // Consumimos el salto para evitar salto infinito
  inputActual.salto = false;
}

/**
 * Limita la velocidad horizontal máxima.
 * En el aire el límite es VELOCIDAD_MAXIMA_EN_AIRE (menor).
 * Consistente con la fuerza reducida en el aire.
 */
function limitarVelocidadHorizontal(cuerpo) {
  const velocidad = cuerpo.velocity;
  const estaEnElAire = !verificarSiJugadorEstaEnSuelo(cuerpo);
  const limiteActual = estaEnElAire
    ? VELOCIDAD_MAXIMA_EN_AIRE
    : VELOCIDAD_MAXIMA_HORIZONTAL;

  const superaElLimite = Math.abs(velocidad.x) > limiteActual;
  if (!superaElLimite) return;

  Body.setVelocity(cuerpo, {
    x: Math.sign(velocidad.x) * limiteActual,
    y: velocidad.y,
  });
}

/**
 * Verifica si el jugador está en el suelo.
 * UMBRAL_DE_VELOCIDAD_EN_SUELO = 0.4: muy estricto.
 * Solo permite saltar si la velocidad vertical es casi cero.
 */
function verificarSiJugadorEstaEnSuelo(cuerpo) {
  return Math.abs(cuerpo.velocity.y) < UMBRAL_DE_VELOCIDAD_EN_SUELO;
}

function verificarJugadoresFueraDelMapa() {
  Object.keys(jugadoresEnPantalla).forEach((id) => {
    const cuerpo = jugadoresEnPantalla[id];
    const cayoFueraDelMapa = cuerpo.position.y > ALTO_DEL_CANVAS + 100;
    if (!cayoFueraDelMapa) return;

    Body.setPosition(cuerpo, { x: 100, y: ALTO_DEL_CANVAS - 100 });
    Body.setVelocity(cuerpo, { x: 0, y: 0 });
    if (jugadorQueCargarLaLlave === id) resetearLlave();
  });
}

// =============================================================================
// NIVEL MEDIO — Caja empujable (Nivel 2)
// Suma de fuerzas: si N jugadores empujan, Body.applyForce se llama N veces
// en el mismo frame. Matter.js las acumula → la caja va N veces más rápido.
// =============================================================================

function aplicarFuerzasEnCaja() {
  if (cajaEmpujable === null) return;

  Object.entries(inputsDeJugadores).forEach(([id, inputActual]) => {
    const cuerpoDelJugador = jugadoresEnPantalla[id];
    if (cuerpoDelJugador === undefined) return;

    const estaCercaDeLaCaja =
      verificarSiJugadorEstaCercaDeCaja(cuerpoDelJugador);
    if (!estaCercaDeLaCaja) return;

    if (inputActual.derecha) {
      Body.applyForce(cajaEmpujable, cajaEmpujable.position, {
        x: FUERZA_DE_EMPUJE_DE_CAJA,
        y: 0,
      });
    }
    if (inputActual.izquierda) {
      Body.applyForce(cajaEmpujable, cajaEmpujable.position, {
        x: -FUERZA_DE_EMPUJE_DE_CAJA,
        y: 0,
      });
    }
  });
}

function verificarSiJugadorEstaCercaDeCaja(cuerpoDelJugador) {
  const DISTANCIA_MAXIMA_DE_EMPUJE = LADO_DEL_CUADRADO + 40;
  const diferenciaEnX = Math.abs(
    cuerpoDelJugador.position.x - cajaEmpujable.position.x,
  );
  const diferenciaEnY = Math.abs(
    cuerpoDelJugador.position.y - cajaEmpujable.position.y,
  );
  return (
    diferenciaEnX < DISTANCIA_MAXIMA_DE_EMPUJE &&
    diferenciaEnY < DISTANCIA_MAXIMA_DE_EMPUJE
  );
}

// =============================================================================
// NIVEL MEDIO — Sistema de llave con Constraint (ligadura)
// =============================================================================

function crearLigaduraDeLlaveConJugador(cuerpoDelPortador) {
  const nuevaLigadura = Constraint.create({
    bodyA: cuerpoDelPortador,
    bodyB: llaveDelNivel,
    pointA: { x: 0, y: -DISTANCIA_DE_LIGADURA_DE_LLAVE },
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
    render: { visible: true, strokeStyle: "#f1c40f", lineWidth: 2 },
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
  const posicionesPorNivel = {
    1: { x: ANCHO_DEL_CANVAS * 0.84, y: ALTO_DEL_CANVAS * 0.28 - 22 },
    2: { x: ANCHO_DEL_CANVAS * 0.85, y: ALTO_DEL_CANVAS * 0.28 - 22 },
  };
  return posicionesPorNivel[numeroDeNivel] || posicionesPorNivel[1];
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
    (id) => jugadoresEnPantalla[id] === cuerpoDelJugador,
  );
  if (idDelJugador === undefined) return;

  jugadorQueCargarLaLlave = idDelJugador;
  crearLigaduraDeLlaveConJugador(cuerpoDelJugador);
  actualizarIndicadorDeLlave(idDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Condición de victoria
// La rúbrica exige que los 4 jugadores estén en la zona de salida.
// CANTIDAD_DE_JUGADORES_PARA_GANAR = 4.
// =============================================================================

// =============================================================================
// NIVEL MEDIO — Condición de victoria
// =============================================================================

function verificarCondicionesDeVictoria() {
  if (elNivelYaTermino) return;

  // Guardamos la cantidad de jugadores actuales
  const cantidadDeJugadores = Object.keys(jugadoresEnPantalla).length;
  if (cantidadDeJugadores === 0) return; // Si no hay nadie, no se puede ganar

  if (!llaveDelNivel || !zonaDeSalidaDelNivel) return;

  const alguienTieneLaLlave = jugadorQueCargarLaLlave !== null;
  const todosEstanEnLaSalida = verificarSiTodosEstanEnZonaDeSalida();

  if (alguienTieneLaLlave && todosEstanEnLaSalida) {
    elNivelYaTermino = true;

    // NUEVO: Frenamos a todos a cero para que no sigan de largo
    Object.values(jugadoresEnPantalla).forEach((cuerpo) => {
      Matter.Body.setVelocity(cuerpo, { x: 0, y: 0 });
    });

    if (nivelActual === 1) nivel1Completado = true;
    setTimeout(() => activarPantallaDeVictoria(), 600);
  }
}

/**
 * Verifica que TODOS los jugadores conectados estén en la salida.
 * Ahora es dinámico: si hay 2 jugando, pide que los 2 estén adentro.
 */
function verificarSiTodosEstanEnZonaDeSalida() {
  const ids = Object.keys(jugadoresEnPantalla);

  // Verificamos que absolutamente todos los IDs conectados estén tocando la zona
  return ids.every((id) =>
    verificarSiCuerpoEstaEnZona(jugadoresEnPantalla[id], zonaDeSalidaDelNivel),
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

  document.getElementById("texto-de-victoria").textContent = esElUltimoNivel
    ? "🏆 ¡Juego completado!"
    : "🎉 ¡Nivel completado!";

  const boton = document.getElementById("boton-para-siguiente-nivel");
  boton.textContent = esElUltimoNivel
    ? "Volver al inicio"
    : "Siguiente Nivel →";

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

/**
 * Recibe el tick del servidor 30 veces por segundo.
 * Actualiza izquierda/derecha directamente.
 * Para el salto: solo activamos, nunca desactivamos desde aquí.
 * La desactivación la hace aplicarSaltoSiCorresponde() para evitar salto infinito.
 */
function manejarTickDelJuego(estadoDelJuego) {
  Object.keys(estadoDelJuego.jugadores).forEach((id) => {
    const inputDelServidor = estadoDelJuego.jugadores[id].input;
    if (!inputsDeJugadores[id]) return;

    inputsDeJugadores[id].izquierda = inputDelServidor.izquierda;
    inputsDeJugadores[id].derecha = inputDelServidor.derecha;

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
    const div = document.createElement("div");
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
// ARRANQUE
// =============================================================================
iniciarJuego();
