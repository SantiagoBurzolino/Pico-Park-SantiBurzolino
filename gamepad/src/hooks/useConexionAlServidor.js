import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// =============================================================================
// useConexionAlServidor — Hook de WebSocket
//
// Ahora también maneja:
// - votarNivel: el jugador vota por un nivel
// - solicitarInicio: cualquier jugador puede iniciar el juego
// - lobbyActivo: false cuando el juego ya empezó
// =============================================================================

const PUERTO_DEL_SERVIDOR = 3000;

export function useConexionAlServidor(ipDelServidor) {
  const referenciaAlSocket = useRef(null);

  const [estaConectado,   setEstaConectado]   = useState(false);
  const [colorAsignado,   setColorAsignado]   = useState(null);
  const [juegoLleno,      setJuegoLleno]      = useState(false);
  const [lobbyActivo,     setLobbyActivo]      = useState(true);
  // estadoDeVotos guarda { votos, nivelMasVotado, totalJugadores }
  const [estadoDeVotos,   setEstadoDeVotos]   = useState(null);

  useEffect(() => {
    const urlDelServidor = `http://${ipDelServidor}:${PUERTO_DEL_SERVIDOR}`;

    const socket = io(urlDelServidor, {
      timeout:    5000,
      transports: ["websocket"],
    });

    referenciaAlSocket.current = socket;

    // Al conectar nos identificamos como gamepad
    socket.on("connect", () => {
      socket.emit("identificarse", "gamepad");
    });

    socket.on("jugador_asignado", (datos) => {
      setColorAsignado(datos.color);
      setEstaConectado(true);
      setJuegoLleno(false);
      setLobbyActivo(true);
    });

    socket.on("juego_lleno", () => {
      setJuegoLleno(true);
      setEstaConectado(false);
    });

    // El servidor nos manda los votos actualizados cada vez que alguien vota
    socket.on("actualizacion_de_votos", (datos) => {
      setEstadoDeVotos(datos);
    });

    // El servidor nos avisa que el juego empezó → salimos del lobby
    socket.on("lobby_cerrado", () => {
      setLobbyActivo(false);
    });

    socket.on("disconnect", () => {
      setEstaConectado(false);
      setColorAsignado(null);
      setLobbyActivo(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [ipDelServidor]);

  // ── Funciones que expone el hook ─────────────────────────────────────────

  function enviarKeydown(tecla) {
    const socket    = referenciaAlSocket.current;
    const puedeEnviar = socket !== null && estaConectado;
    if (!puedeEnviar) return;
    socket.emit("keydown", tecla);
  }

  function enviarKeyup(tecla) {
    const socket    = referenciaAlSocket.current;
    const puedeEnviar = socket !== null && estaConectado;
    if (!puedeEnviar) return;
    socket.emit("keyup", tecla);
  }

  /**
   * Vota por un nivel (1 o 2).
   * El servidor actualiza el conteo y notifica a todos.
   */
  function votarNivel(numeroDeNivel) {
    const socket = referenciaAlSocket.current;
    if (socket === null || !estaConectado) return;
    socket.emit("votar_nivel", numeroDeNivel);
  }

  /**
   * Solicita al servidor que inicie el juego con el nivel más votado.
   * Cualquier jugador conectado puede hacerlo.
   */
  function solicitarInicio() {
    const socket = referenciaAlSocket.current;
    if (socket === null || !estaConectado) return;
    socket.emit("solicitar_inicio");
  }

  function desconectar() {
    const socket = referenciaAlSocket.current;
    if (socket !== null) socket.disconnect();
  }

  return {
    estaConectado,
    colorAsignado,
    juegoLleno,
    lobbyActivo,
    estadoDeVotos,
    enviarKeydown,
    enviarKeyup,
    votarNivel,
    solicitarInicio,
    desconectar,
  };
}