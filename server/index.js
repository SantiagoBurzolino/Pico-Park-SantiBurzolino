"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");
const os         = require("os");

// =============================================================================
// CONSTANTES
// Manual: sin números mágicos sueltos en el código.
// =============================================================================
const PUERTO_DEL_SERVIDOR          = 3000;
const CANTIDAD_MAXIMA_DE_JUGADORES = 4;
const ACTUALIZACIONES_POR_SEGUNDO  = 30;
const INTERVALO_DE_TICK_EN_MS      = 1000 / ACTUALIZACIONES_POR_SEGUNDO;
const COLORES_DE_JUGADORES         = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
const TIPO_DE_CLIENTE_GAMEPAD      = "gamepad";
const TIPO_DE_CLIENTE_JUEGO        = "juego";

// =============================================================================
// CONFIGURACIÓN
// =============================================================================
const aplicacionExpress    = express();
const servidorHttp         = http.createServer(aplicacionExpress);
const servidorDeWebSockets = new Server(servidorHttp, {
  cors: { origin: "*" },
});

aplicacionExpress.use(express.static(path.join(__dirname, "../game")));

const jugadoresConectados = {};

// =============================================================================
// NIVEL ALTO — Orquestador
// =============================================================================
servidorDeWebSockets.on("connection", (socketDelCliente) => {
  socketDelCliente.on("identificarse", (tipoDeCliente) => {
    if (tipoDeCliente === TIPO_DE_CLIENTE_JUEGO) {
      manejarConexionDelJuego(socketDelCliente);
    } else if (tipoDeCliente === TIPO_DE_CLIENTE_GAMEPAD) {
      manejarConexionDeGamepad(socketDelCliente);
    }
  });
});

// =============================================================================
// NIVEL MEDIO — Juego (navegador PC)
// El juego solo escucha, no genera jugadores.
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
// NIVEL MEDIO — Gamepad (celular)
// =============================================================================
function manejarConexionDeGamepad(socketDelJugador) {
  if (verificarSiElJuegoEstaLleno()) {
    rechazarConexionPorJuegoLleno(socketDelJugador);
    return;
  }

  registrarNuevoJugador(socketDelJugador);
  escucharInputsDelJugador(socketDelJugador);
  escucharSolicitudDeInicio(socketDelJugador);
  escucharDesconexionDelJugador(socketDelJugador);
}

// =============================================================================
// NIVEL MEDIO — Gestión de jugadores
// =============================================================================

function verificarSiElJuegoEstaLleno() {
  return Object.keys(jugadoresConectados).length >= CANTIDAD_MAXIMA_DE_JUGADORES;
}

function rechazarConexionPorJuegoLleno(socketDelJugador) {
  console.log("⚠️  Sala llena — conexión rechazada");
  socketDelJugador.emit("juego_lleno");
  socketDelJugador.disconnect();
}

function registrarNuevoJugador(socketDelJugador) {
  const nuevoJugador = construirDatosDelJugador(socketDelJugador.id);
  jugadoresConectados[socketDelJugador.id] = nuevoJugador;

  // Le decimos al gamepad su color e ID asignados
  socketDelJugador.emit("jugador_asignado", {
    id:            nuevoJugador.id,
    color:         nuevoJugador.color,
    indiceDeColor: nuevoJugador.indiceDeColor,
  });

  // Notificamos a TODOS (juego + gamepads) que la lista cambió
  notificarActualizacionDeJugadores();

  console.log(`✅ Jugador conectado | Color: ${nuevoJugador.color}`);
}

function construirDatosDelJugador(idDelSocket) {
  // Buscamos qué índices de colores ya están ocupados por los conectados
  const indicesEnUso = Object.values(jugadoresConectados).map(j => j.indiceDeColor);
  
  // Buscamos el primer número del 0 al 3 que esté libre
  let indiceLibre = 0;
  for (let i = 0; i < CANTIDAD_MAXIMA_DE_JUGADORES; i++) {
    if (!indicesEnUso.includes(i)) {
      indiceLibre = i;
      break;
    }
  }

  return {
    id:            idDelSocket,
    color:         COLORES_DE_JUGADORES[indiceLibre],
    indiceDeColor: indiceLibre,
    input: {
      izquierda: false,
      derecha:   false,
      salto:     false,
    },
  };
}

function notificarActualizacionDeJugadores() {
  servidorDeWebSockets.emit("actualizacion_de_jugadores", jugadoresConectados);
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

  // Validamos que la tecla sea una de las permitidas (seguridad básica)
  const esTeclaValida = ["izquierda", "derecha", "salto"].includes(tecla);
  if (!esTeclaValida) return;

  jugadoresConectados[idDelJugador].input[tecla] = estaPresionada;
}

// =============================================================================
// NIVEL MEDIO — Inicio del juego desde el gamepad
// Cualquier jugador puede tocar "Iniciar" en su celular.
// El servidor le avisa al juego (PC) que arranque.
// =============================================================================
function escucharSolicitudDeInicio(socketDelJugador) {
  socketDelJugador.on("solicitar_inicio", () => {
    const hayJugadores = Object.keys(jugadoresConectados).length >= 1;
    if (!hayJugadores) return;

    // Le avisamos al juego (PC) que inicie con los jugadores conectados
    servidorDeWebSockets.emit("juego_iniciado", {
      cantidadDeJugadores: Object.keys(jugadoresConectados).length,
    });

    console.log(`🎮 Juego iniciado por un jugador`);
  });
}

// =============================================================================
// NIVEL MEDIO — Desconexión
// =============================================================================
function escucharDesconexionDelJugador(socketDelJugador) {
  socketDelJugador.on("disconnect", () => {
    delete jugadoresConectados[socketDelJugador.id];
    notificarActualizacionDeJugadores();
    console.log(`❌ Jugador desconectado | ID: ${socketDelJugador.id}`);
  });
}

// =============================================================================
// LOOP — 30 ticks por segundo
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