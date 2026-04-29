"use strict";

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");
const os      = require("os");

// =============================================================================
// CONSTANTES DE CONFIGURACIÓN
// Sin números mágicos: cada valor tiene nombre descriptivo.
// =============================================================================
const PUERTO_DEL_SERVIDOR          = 3000;
const CANTIDAD_MAXIMA_DE_JUGADORES = 4;
const ACTUALIZACIONES_POR_SEGUNDO  = 30;
const INTERVALO_DE_TICK_EN_MS      = 1000 / ACTUALIZACIONES_POR_SEGUNDO;

const COLORES_DE_JUGADORES = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

// Identificador que manda el gamepad para distinguirse del navegador.
// El navegador NO manda esto, así el servidor sabe quién es quién.
const TIPO_DE_CLIENTE_GAMEPAD = "gamepad";
const TIPO_DE_CLIENTE_JUEGO   = "juego";

// =============================================================================
// CONFIGURACIÓN DEL SERVIDOR
// =============================================================================
const aplicacionExpress  = express();
const servidorHttp       = http.createServer(aplicacionExpress);
const servidorDeWebSockets = new Server(servidorHttp, {
  cors: { origin: "*" },
});

// =============================================================================
// ESTADO GLOBAL
// jugadoresConectados solo guarda gamepads, nunca el navegador.
// =============================================================================
const jugadoresConectados = {};

// Servimos los archivos del juego desde la carpeta /game
aplicacionExpress.use(express.static(path.join(__dirname, "../game")));

// =============================================================================
// NIVEL ALTO — Orquestador de conexiones
// =============================================================================
servidorDeWebSockets.on("connection", (socketDelCliente) => {

  // El primer evento que manda cualquier cliente es "identificarse".
  // Si es el navegador (juego), lo registramos como espectador.
  // Si es el gamepad, lo procesamos como jugador.
  socketDelCliente.on("identificarse", (tipoDeCliente) => {

    const esUnGamepad = tipoDeCliente === TIPO_DE_CLIENTE_GAMEPAD;
    const esElJuego   = tipoDeCliente === TIPO_DE_CLIENTE_JUEGO;

    if (esElJuego) {
      manejarConexionDelJuego(socketDelCliente);
      return;
    }

    if (esUnGamepad) {
      manejarConexionDeGamepad(socketDelCliente);
      return;
    }
  });
});

// =============================================================================
// NIVEL MEDIO — Conexión del juego (navegador)
// El juego solo recibe datos, no genera jugadores.
// =============================================================================
function manejarConexionDelJuego(socketDelJuego) {
  console.log("🖥️  Juego conectado");

  // Le mandamos el estado actual por si el juego se reconecta
  socketDelJuego.emit("actualizacion_de_jugadores", jugadoresConectados);

  socketDelJuego.on("disconnect", () => {
    console.log("🖥️  Juego desconectado");
  });
}

// =============================================================================
// NIVEL MEDIO — Conexión de gamepad (celular)
// =============================================================================
function manejarConexionDeGamepad(socketDelJugador) {
  const estaElJuegoLleno = verificarSiElJuegoEstaLleno();

  if (estaElJuegoLleno) {
    rechazarConexionPorJuegoLleno(socketDelJugador);
    return;
  }

  registrarNuevoJugador(socketDelJugador);
  escucharInputsDelJugador(socketDelJugador);
  escucharDesconexionDelJugador(socketDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Funciones de jugador
// =============================================================================

function verificarSiElJuegoEstaLleno() {
  const cantidadActual = Object.keys(jugadoresConectados).length;
  return cantidadActual >= CANTIDAD_MAXIMA_DE_JUGADORES;
}

function rechazarConexionPorJuegoLleno(socketDelJugador) {
  console.log("⚠️  Conexión rechazada: juego lleno");
  socketDelJugador.emit("juego_lleno");
  socketDelJugador.disconnect();
}

function registrarNuevoJugador(socketDelJugador) {
  const nuevoJugador = construirDatosDelJugador(socketDelJugador.id);
  guardarJugadorEnEstado(nuevoJugador);
  notificarAlJugadorSuAsignacion(socketDelJugador, nuevoJugador);
  notificarATodosLaActualizacionDeJugadores();

  console.log(`✅ Jugador conectado | Color: ${nuevoJugador.color}`);
}

function construirDatosDelJugador(idDelSocket) {
  const indiceDeColor = Object.keys(jugadoresConectados).length;
  return {
    id:           idDelSocket,
    color:        COLORES_DE_JUGADORES[indiceDeColor],
    indiceDeColor: indiceDeColor,
    input: {
      izquierda: false,
      derecha:   false,
      salto:     false,
    },
  };
}

function guardarJugadorEnEstado(datosDelJugador) {
  jugadoresConectados[datosDelJugador.id] = datosDelJugador;
}

function notificarAlJugadorSuAsignacion(socketDelJugador, datosDelJugador) {
  socketDelJugador.emit("jugador_asignado", {
    id:           datosDelJugador.id,
    color:        datosDelJugador.color,
    indiceDeColor: datosDelJugador.indiceDeColor,
  });
}

function notificarATodosLaActualizacionDeJugadores() {
  servidorDeWebSockets.emit("actualizacion_de_jugadores", jugadoresConectados);
}

function escucharInputsDelJugador(socketDelJugador) {
  socketDelJugador.on("keydown", (teclaPresionada) => {
    actualizarInputDelJugador(socketDelJugador.id, teclaPresionada, true);
  });
  socketDelJugador.on("keyup", (teclaPresionada) => {
    actualizarInputDelJugador(socketDelJugador.id, teclaPresionada, false);
  });
}

function actualizarInputDelJugador(idDelJugador, teclaPresionada, estaPresionada) {
  const jugadorExiste = jugadoresConectados[idDelJugador] !== undefined;
  if (!jugadorExiste) return;

  const esTeclaValida = ["izquierda", "derecha", "salto"].includes(teclaPresionada);
  if (!esTeclaValida) return;

  jugadoresConectados[idDelJugador].input[teclaPresionada] = estaPresionada;
}

function escucharDesconexionDelJugador(socketDelJugador) {
  socketDelJugador.on("disconnect", () => {
    eliminarJugadorDelEstado(socketDelJugador.id);
    notificarATodosLaActualizacionDeJugadores();
    console.log(`❌ Jugador desconectado | ID: ${socketDelJugador.id}`);
  });
}

function eliminarJugadorDelEstado(idDelJugador) {
  delete jugadoresConectados[idDelJugador];
}

// =============================================================================
// LOOP PRINCIPAL — Game tick 30 veces por segundo
// =============================================================================
function iniciarLoopDelJuego() {
  setInterval(() => {
    servidorDeWebSockets.emit("tick_del_juego", {
      jugadores: jugadoresConectados,
    });
  }, INTERVALO_DE_TICK_EN_MS);
}

// =============================================================================
// UTILIDADES
// =============================================================================
function obtenerIpLocalDeLaComputadora() {
  try {
    const interfacesDeRed = os.networkInterfaces();
    for (const nombre of Object.keys(interfacesDeRed)) {
      for (const interfaz of interfacesDeRed[nombre]) {
        const esIpv4Externa = interfaz.family === "IPv4" && !interfaz.internal;
        if (esIpv4Externa) return interfaz.address;
      }
    }
    return "localhost";
  } catch (error) {
    console.error("No se pudo obtener la IP:", error.message);
    return "localhost";
  }
}

function mostrarInformacionDeConexion() {
  const ipLocal = obtenerIpLocalDeLaComputadora();
  console.log("═══════════════════════════════════════");
  console.log("🎮  PICO PARK — Servidor iniciado");
  console.log("═══════════════════════════════════════");
  console.log(`🖥️   Juego (PC):  http://${ipLocal}:${PUERTO_DEL_SERVIDOR}`);
  console.log(`📱   Gamepad:     IP → ${ipLocal}`);
  console.log(`👥   Jugadores:   máximo ${CANTIDAD_MAXIMA_DE_JUGADORES}`);
  console.log(`⚡   Tick rate:   ${ACTUALIZACIONES_POR_SEGUNDO} FPS`);
  console.log("═══════════════════════════════════════");
}

// =============================================================================
// ARRANQUE
// =============================================================================
servidorHttp.listen(PUERTO_DEL_SERVIDOR, () => {
  mostrarInformacionDeConexion();
  iniciarLoopDelJuego();
});