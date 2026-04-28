// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// Traemos las librerías necesarias. Las nativas de Node (http, path, os) no
// requieren instalación. Express y Socket.io sí (ya las instalaste con npm).
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const os = require("os");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE CONFIGURACIÓN
// Siguiendo la pauta: sin "números mágicos" sueltos en el código.
// Cada valor tiene un nombre que explica QUÉ representa.
// ─────────────────────────────────────────────────────────────────────────────
const PUERTO_DEL_SERVIDOR = 3000;
const CANTIDAD_MAXIMA_DE_JUGADORES = 4;
const ACTUALIZACIONES_POR_SEGUNDO = 30;
const INTERVALO_DE_TICK_EN_MS = 1000 / ACTUALIZACIONES_POR_SEGUNDO; // ~33ms

// Colores asignados a cada jugador según el orden de conexión.
// Son constantes de dominio: representan la identidad visual de cada jugador.
const COLORES_DE_JUGADORES = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];
// Rojo=jugador1, Azul=jugador2, Verde=jugador3, Naranja=jugador4

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL SERVIDOR
// ─────────────────────────────────────────────────────────────────────────────
const aplicacionExpress = express();
const servidorHttp = http.createServer(aplicacionExpress);

// Socket.io envuelve el servidor HTTP para agregar soporte de WebSockets.
// cors: origin "*" permite conexiones desde cualquier IP de la red local (los celulares).
const servidorDeWebSockets = new Server(servidorHttp, {
  cors: { origin: "*" },
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO GLOBAL DEL JUEGO
// jugadoresConectados es el "cerebro" del servidor.
// Estructura: { [socketId]: { id, color, indiceDeColor, input } }
// ─────────────────────────────────────────────────────────────────────────────
const jugadoresConectados = {};

// ─────────────────────────────────────────────────────────────────────────────
// SERVIR LOS ARCHIVOS ESTÁTICOS DEL JUEGO
// Cuando alguien abre el navegador en http://IP:3000, Express le manda
// automáticamente el index.html de la carpeta /game
// ─────────────────────────────────────────────────────────────────────────────
aplicacionExpress.use(express.static(path.join(__dirname, "../game")));

// =============================================================================
// CAPA DE RED — WEBSOCKETS
// Aquí definimos todos los eventos de comunicación en tiempo real.
// Separamos cada responsabilidad en su propia función (principio SRP).
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL ALTO: Orquestador principal de conexiones
// Esta función solo coordina. No sabe los detalles de cómo se crea un jugador.
// ─────────────────────────────────────────────────────────────────────────────
servidorDeWebSockets.on("connection", (socketDelJugador) => {
  const estaElJuegoLleno = verificarSiElJuegoEstaLleno();

  if (estaElJuegoLleno) {
    rechazarConexionPorJuegoLleno(socketDelJugador);
    return;
  }

  registrarNuevoJugador(socketDelJugador);
  escucharInputsDelJugador(socketDelJugador);
  escucharDesconexionDelJugador(socketDelJugador);
});

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL MEDIO: Funciones de proceso
// Cada una tiene UNA responsabilidad clara.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si ya se alcanzó el límite de jugadores permitidos.
 * Retorna verdadero si el juego está lleno.
 */
function verificarSiElJuegoEstaLleno() {
  const cantidadDeJugadoresActuales = Object.keys(jugadoresConectados).length;
  return cantidadDeJugadoresActuales >= CANTIDAD_MAXIMA_DE_JUGADORES;
}

/**
 * Avisa al celular que el juego está lleno y cierra la conexión.
 * Separamos esto del orquestador para no mezclar lógica de negocio con red.
 */
function rechazarConexionPorJuegoLleno(socketDelJugador) {
  console.log(
    `⚠️  Conexión rechazada: juego lleno (${CANTIDAD_MAXIMA_DE_JUGADORES} jugadores)`,
  );
  socketDelJugador.emit("juego_lleno");
  socketDelJugador.disconnect();
}

/**
 * Crea el jugador en el estado global y notifica a todos los clientes.
 * Orquesta: construir → guardar → notificar.
 */
function registrarNuevoJugador(socketDelJugador) {
  const nuevoJugador = construirDatosDelJugador(socketDelJugador.id);
  guardarJugadorEnEstado(nuevoJugador);
  notificarAlJugadorSuAsignacion(socketDelJugador, nuevoJugador);
  notificarATodosLaActualizacionDeJugadores();

  console.log(
    `✅ Jugador conectado | ID: ${socketDelJugador.id} | Color: ${nuevoJugador.color}`,
  );
}

/**
 * Construye el objeto de datos de un jugador nuevo.
 * El color se asigna según cuántos jugadores hay en ese momento.
 */
function construirDatosDelJugador(idDelSocket) {
  const indiceDeColor = Object.keys(jugadoresConectados).length;
  const colorAsignado = COLORES_DE_JUGADORES[indiceDeColor];

  return {
    id: idDelSocket,
    color: colorAsignado,
    indiceDeColor: indiceDeColor,
    // El input representa el estado actual del control del celular.
    // false = tecla no presionada, true = tecla presionada.
    input: {
      izquierda: false,
      derecha: false,
      salto: false,
    },
  };
}

/**
 * Persiste el jugador en el estado global del servidor.
 */
function guardarJugadorEnEstado(datosDelJugador) {
  jugadoresConectados[datosDelJugador.id] = datosDelJugador;
}

/**
 * Le envía al celular recién conectado su ID y color asignado.
 * Este es el "handshake" de identificación del jugador.
 */
function notificarAlJugadorSuAsignacion(socketDelJugador, datosDelJugador) {
  socketDelJugador.emit("jugador_asignado", {
    id: datosDelJugador.id,
    color: datosDelJugador.color,
    indiceDeColor: datosDelJugador.indiceDeColor,
  });
}

/**
 * Emite el estado completo de jugadores a TODOS los clientes conectados
 * (tanto el juego en la PC como todos los celulares).
 */
function notificarATodosLaActualizacionDeJugadores() {
  servidorDeWebSockets.emit("actualizacion_de_jugadores", jugadoresConectados);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL MEDIO: Escucha de inputs del control (celular)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra los listeners de input para un jugador específico.
 * "keydown" = tecla presionada, "keyup" = tecla soltada.
 */
function escucharInputsDelJugador(socketDelJugador) {
  socketDelJugador.on("keydown", (teclaPresionada) => {
    actualizarInputDelJugador(socketDelJugador.id, teclaPresionada, true);
  });

  socketDelJugador.on("keyup", (teclaPresionada) => {
    actualizarInputDelJugador(socketDelJugador.id, teclaPresionada, false);
  });
}

/**
 * Modifica el estado del input de un jugador concreto.
 * estaPresionada: true si se apretó la tecla, false si se soltó.
 */
function actualizarInputDelJugador(
  idDelJugador,
  teclaPresionada,
  estaPresionada,
) {
  const jugadorExiste = jugadoresConectados[idDelJugador] !== undefined;

  if (!jugadorExiste) return; // Protección: ignoramos inputs de jugadores ya desconectados

  jugadoresConectados[idDelJugador].input[teclaPresionada] = estaPresionada;
}

// ─────────────────────────────────────────────────────────────────────────────
// NIVEL MEDIO: Manejo de desconexión
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escucha el evento de desconexión y limpia el estado del jugador.
 */
function escucharDesconexionDelJugador(socketDelJugador) {
  socketDelJugador.on("disconnect", () => {
    eliminarJugadorDelEstado(socketDelJugador.id);
    notificarATodosLaActualizacionDeJugadores();

    console.log(`❌ Jugador desconectado | ID: ${socketDelJugador.id}`);
  });
}

/**
 * Elimina al jugador del estado global cuando se desconecta.
 * Esto evita que el juego siga intentando mover un personaje sin control.
 */
function eliminarJugadorDelEstado(idDelJugador) {
  delete jugadoresConectados[idDelJugador];
}

// =============================================================================
// LOOP PRINCIPAL DEL JUEGO (Game Tick)
// Envía el estado actual de todos los inputs 30 veces por segundo al juego.
// Es el "latido" del servidor: la PC lo usa para mover los personajes.
// =============================================================================
function iniciarLoopDelJuego() {
  setInterval(() => {
    servidorDeWebSockets.emit("tick_del_juego", {
      jugadores: jugadoresConectados,
    });
  }, INTERVALO_DE_TICK_EN_MS);
}

// =============================================================================
// UTILIDADES DE RED
// =============================================================================

/**
 * Lee las interfaces de red del sistema operativo y retorna la IP local.
 * La IP local es la que los celulares usan para conectarse al servidor.
 * Filtramos "loopback" (127.0.0.1) porque esa solo funciona en la misma PC.
 */
function obtenerIpLocalDeLaComputadora() {
  try {
    const interfacesDeRed = os.networkInterfaces();

    for (const nombreDeInterfaz of Object.keys(interfacesDeRed)) {
      for (const configuracionDeInterfaz of interfacesDeRed[nombreDeInterfaz]) {
        const esIpv4 = configuracionDeInterfaz.family === "IPv4";
        const esInterfazExterna = !configuracionDeInterfaz.internal;

        if (esIpv4 && esInterfazExterna) {
          return configuracionDeInterfaz.address;
        }
      }
    }
    return "localhost"; // Fallback si no encuentra ninguna interfaz externa
  } catch (error) {
    console.error("No se pudo obtener la IP local:", error.message);
    return "localhost";
  }
}

/**
 * Muestra en consola la información de conexión de forma clara.
 */
function mostrarInformacionDeConexion() {
  const ipLocal = obtenerIpLocalDeLaComputadora();

  console.log("═══════════════════════════════════════");
  console.log("🎮  PICO PARK — Servidor iniciado");
  console.log("═══════════════════════════════════════");
  console.log(`🖥️   Juego (PC):   http://${ipLocal}:${PUERTO_DEL_SERVIDOR}`);
  console.log(
    `📱   Gamepad:      IP → ${ipLocal}  |  Puerto → ${PUERTO_DEL_SERVIDOR}`,
  );
  console.log(`👥   Jugadores:    máximo ${CANTIDAD_MAXIMA_DE_JUGADORES}`);
  console.log(`⚡   Tick rate:    ${ACTUALIZACIONES_POR_SEGUNDO} FPS`);
  console.log("═══════════════════════════════════════");
}

// =============================================================================
// ARRANQUE DEL SERVIDOR
// Un único punto de entrada que orquesta todo el inicio.
// =============================================================================
servidorHttp.listen(PUERTO_DEL_SERVIDOR, () => {
  mostrarInformacionDeConexion();
  iniciarLoopDelJuego();
});
