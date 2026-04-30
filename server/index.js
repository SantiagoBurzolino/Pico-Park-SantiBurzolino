"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");
const os         = require("os");

// =============================================================================
// CONSTANTES
// =============================================================================
const PUERTO_DEL_SERVIDOR          = 3000;
const CANTIDAD_MAXIMA_DE_JUGADORES = 4;
const ACTUALIZACIONES_POR_SEGUNDO  = 30;
const INTERVALO_DE_TICK_EN_MS      = 1000 / ACTUALIZACIONES_POR_SEGUNDO;
const COLORES_DE_JUGADORES         = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const TIPO_DE_CLIENTE_GAMEPAD      = "gamepad";
const TIPO_DE_CLIENTE_JUEGO        = "juego";

// =============================================================================
// CONFIGURACIÓN DEL SERVIDOR
// =============================================================================
const aplicacionExpress    = express();
const servidorHttp         = http.createServer(aplicacionExpress);
const servidorDeWebSockets = new Server(servidorHttp, {
  cors: { origin: "*" },
});

aplicacionExpress.use(express.static(path.join(__dirname, "../game")));

// =============================================================================
// ESTADO GLOBAL DEL SERVIDOR
// =============================================================================
const jugadoresConectados = {};

// Votos de nivel: cada jugador puede votar por el nivel que quiere jugar.
// La estructura es { socketId: numeroDeNivel }
const votosDeNivel = {};

// Indica si el juego ya fue iniciado (para no iniciarlo dos veces)
let elJuegoFueIniciado = false;

// =============================================================================
// NIVEL ALTO — Orquestador de conexiones
// =============================================================================
servidorDeWebSockets.on("connection", (socketDelCliente) => {
  socketDelCliente.on("identificarse", (tipoDeCliente) => {
    if (tipoDeCliente === TIPO_DE_CLIENTE_JUEGO) {
      manejarConexionDelJuego(socketDelCliente);
      return;
    }
    if (tipoDeCliente === TIPO_DE_CLIENTE_GAMEPAD) {
      manejarConexionDeGamepad(socketDelCliente);
      return;
    }
  });
});

// =============================================================================
// NIVEL MEDIO — Conexión del juego (navegador PC)
// =============================================================================
function manejarConexionDelJuego(socketDelJuego) {
  console.log("🖥️  Juego conectado");
  socketDelJuego.emit("actualizacion_de_jugadores", jugadoresConectados);

  socketDelJuego.on("disconnect", () => {
    console.log("🖥️  Juego desconectado");
    elJuegoFueIniciado = false; // Permitimos reiniciar si el juego se cierra
  });
}

// =============================================================================
// NIVEL MEDIO — Conexión de gamepad (celular)
// =============================================================================
function manejarConexionDeGamepad(socketDelJugador) {
  if (verificarSiElJuegoEstaLleno()) {
    rechazarConexionPorJuegoLleno(socketDelJugador);
    return;
  }

  registrarNuevoJugador(socketDelJugador);
  escucharInputsDelJugador(socketDelJugador);
  escucharVotoDeNivel(socketDelJugador);
  escucharSolicitudDeInicio(socketDelJugador);
  escucharDesconexionDelJugador(socketDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Registro de jugador
// =============================================================================

function verificarSiElJuegoEstaLleno() {
  return Object.keys(jugadoresConectados).length >= CANTIDAD_MAXIMA_DE_JUGADORES;
}

function rechazarConexionPorJuegoLleno(socketDelJugador) {
  console.log("⚠️  Conexión rechazada: juego lleno");
  socketDelJugador.emit("juego_lleno");
  socketDelJugador.disconnect();
}

function registrarNuevoJugador(socketDelJugador) {
  const nuevoJugador = construirDatosDelJugador(socketDelJugador.id);
  jugadoresConectados[socketDelJugador.id] = nuevoJugador;

  // Le decimos al jugador su color y ID
  socketDelJugador.emit("jugador_asignado", {
    id:            nuevoJugador.id,
    color:         nuevoJugador.color,
    indiceDeColor: nuevoJugador.indiceDeColor,
  });

  // Notificamos a todos (juego + gamepads) la lista actualizada
  notificarActualizacionDeJugadores();
  // También enviamos los votos actuales para que el nuevo jugador los vea
  notificarActualizacionDeVotos();

  console.log(`✅ Jugador conectado | Color: ${nuevoJugador.color}`);
}

function construirDatosDelJugador(idDelSocket) {
  const indiceDeColor = Object.keys(jugadoresConectados).length;
  return {
    id:            idDelSocket,
    color:         COLORES_DE_JUGADORES[indiceDeColor],
    indiceDeColor: indiceDeColor,
    input: { izquierda: false, derecha: false, salto: false },
  };
}

// =============================================================================
// NIVEL MEDIO — Sistema de votación de nivel
// Cada gamepad puede votar por el nivel que quiere jugar.
// La PC muestra los votos en tiempo real.
// =============================================================================

/**
 * Escucha cuando un jugador vota por un nivel.
 * El gamepad manda el evento "votar_nivel" con el número de nivel.
 */
function escucharVotoDeNivel(socketDelJugador) {
  socketDelJugador.on("votar_nivel", (numeroDeNivel) => {
    const esNivelValido = numeroDeNivel === 1 || numeroDeNivel === 2;
    if (!esNivelValido) return;

    votosDeNivel[socketDelJugador.id] = numeroDeNivel;
    notificarActualizacionDeVotos();

    console.log(`🗳️  Jugador votó nivel ${numeroDeNivel}`);
  });
}

/**
 * Calcula cuál es el nivel más votado.
 * En caso de empate, gana el nivel 1 (el más simple).
 */
function calcularNivelMasVotado() {
  const conteoDeVotos = { 1: 0, 2: 0 };

  Object.values(votosDeNivel).forEach((voto) => {
    conteoDeVotos[voto]++;
  });

  return conteoDeVotos[2] > conteoDeVotos[1] ? 2 : 1;
}

/**
 * Notifica a todos los clientes el estado actual de los votos.
 */
function notificarActualizacionDeVotos() {
  const nivelMasVotado      = calcularNivelMasVotado();
  const cantidadDeJugadores = Object.keys(jugadoresConectados).length;

  servidorDeWebSockets.emit("actualizacion_de_votos", {
    votos:           votosDeNivel,
    nivelMasVotado:  nivelMasVotado,
    totalJugadores:  cantidadDeJugadores,
  });
}

// =============================================================================
// NIVEL MEDIO — Inicio del juego desde el gamepad
// Cualquier jugador conectado puede iniciar el juego.
// El servidor calcula el nivel ganador y se lo manda al juego (PC).
// =============================================================================

function escucharSolicitudDeInicio(socketDelJugador) {
  socketDelJugador.on("solicitar_inicio", () => {
    const hayJugadoresSuficientes = Object.keys(jugadoresConectados).length >= 1;
    if (!hayJugadoresSuficientes || elJuegoFueIniciado) return;

    elJuegoFueIniciado = true;

    const nivelElegido        = calcularNivelMasVotado();
    const cantidadDeJugadores = Object.keys(jugadoresConectados).length;

    // Le mandamos al juego (PC) el nivel elegido y cuántos jugadores hay
    // para que construya el nivel adaptado
    servidorDeWebSockets.emit("juego_iniciado", {
      nivelElegido:      nivelElegido,
      cantidadDeJugadores: cantidadDeJugadores,
    });

    // Le avisamos a todos los gamepads que el juego empezó
    servidorDeWebSockets.emit("lobby_cerrado");

    console.log(`🎮 Juego iniciado | Nivel: ${nivelElegido} | Jugadores: ${cantidadDeJugadores}`);
  });
}

// =============================================================================
// NIVEL MEDIO — Inputs del control
// =============================================================================

function escucharInputsDelJugador(socketDelJugador) {
  socketDelJugador.on("keydown", (tecla) => {
    actualizarInputDelJugador(socketDelJugador.id, tecla, true);
  });
  socketDelJugador.on("keyup", (tecla) => {
    actualizarInputDelJugador(socketDelJugador.id, tecla, false);
  });
}

function actualizarInputDelJugador(idDelJugador, tecla, estaPresionada) {
  const jugadorExiste = jugadoresConectados[idDelJugador] !== undefined;
  if (!jugadorExiste) return;

  const esTeclaValida = ["izquierda", "derecha", "salto"].includes(tecla);
  if (!esTeclaValida) return;

  jugadoresConectados[idDelJugador].input[tecla] = estaPresionada;
}

// =============================================================================
// NIVEL MEDIO — Desconexión
// =============================================================================

function escucharDesconexionDelJugador(socketDelJugador) {
  socketDelJugador.on("disconnect", () => {
    delete jugadoresConectados[socketDelJugador.id];
    delete votosDeNivel[socketDelJugador.id];

    // Si todos se desconectaron, permitimos reiniciar el juego
    const quedanJugadores = Object.keys(jugadoresConectados).length > 0;
    if (!quedanJugadores) elJuegoFueIniciado = false;

    notificarActualizacionDeJugadores();
    notificarActualizacionDeVotos();

    console.log(`❌ Jugador desconectado | ID: ${socketDelJugador.id}`);
  });
}

function notificarActualizacionDeJugadores() {
  servidorDeWebSockets.emit("actualizacion_de_jugadores", jugadoresConectados);
}

// =============================================================================
// LOOP — Game tick 30 veces por segundo
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
function obtenerIpLocal() {
  try {
    const interfaces = os.networkInterfaces();
    for (const nombre of Object.keys(interfaces)) {
      for (const interfaz of interfaces[nombre]) {
        if (interfaz.family === "IPv4" && !interfaz.internal) {
          return interfaz.address;
        }
      }
    }
    return "localhost";
  } catch (error) {
    console.error("No se pudo obtener la IP:", error.message);
    return "localhost";
  }
}

function mostrarInformacionDeConexion() {
  const ip = obtenerIpLocal();
  console.log("═══════════════════════════════════════");
  console.log("🎮  PICO PARK — Servidor iniciado");
  console.log("═══════════════════════════════════════");
  console.log(`🖥️   Juego (PC):  http://${ip}:${PUERTO_DEL_SERVIDOR}`);
  console.log(`📱   Gamepad:     IP → ${ip}`);
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