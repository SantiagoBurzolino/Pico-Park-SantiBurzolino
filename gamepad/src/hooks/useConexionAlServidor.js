import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// =============================================================================
// useConexionAlServidor — Hook personalizado de WebSocket
//
// Responsabilidad: manejar TODA la lógica de conexión con el servidor.
// Los componentes no saben nada de socket.io, solo usan este hook.
// =============================================================================

const PUERTO_DEL_SERVIDOR = 3000;

export function useConexionAlServidor(ipDelServidor) {
  // useRef guarda el socket sin provocar re-renders innecesarios
  const referenciaAlSocket = useRef(null);

  const [estaConectado, setEstaConectado] = useState(false);
  const [colorAsignado, setColorAsignado] = useState(null);
  const [juegoLleno, setJuegoLleno] = useState(false);

  useEffect(() => {
    const urlDelServidor = `http://${ipDelServidor}:${PUERTO_DEL_SERVIDOR}`;

    const socket = io(urlDelServidor, {
      timeout: 5000,
      transports: ["websocket"],
    });

    referenciaAlSocket.current = socket;

    // Dentro del useEffect, después de crear el socket,
    // reemplazá el bloque de eventos por este:

    socket.on("connect", () => {
      // Le decimos al servidor que somos un gamepad, no el juego
      socket.emit("identificarse", "gamepad");
    });

    socket.on("jugador_asignado", (datosDelJugador) => {
      setColorAsignado(datosDelJugador.color);
      setEstaConectado(true);
      setJuegoLleno(false);
    });

    socket.on("juego_lleno", () => {
      setJuegoLleno(true);
      setEstaConectado(false);
    });

    socket.on("disconnect", () => {
      setEstaConectado(false);
      setColorAsignado(null);
    });

    // Limpieza: cuando el componente se desmonta, cerramos el socket
    return () => {
      socket.disconnect();
    };
  }, [ipDelServidor]);

  function enviarKeydown(tecla) {
    const socketActivo = referenciaAlSocket.current;
    const puedeEnviar = socketActivo !== null && estaConectado;
    if (!puedeEnviar) return;
    socketActivo.emit("keydown", tecla);
  }

  function enviarKeyup(tecla) {
    const socketActivo = referenciaAlSocket.current;
    const puedeEnviar = socketActivo !== null && estaConectado;
    if (!puedeEnviar) return;
    socketActivo.emit("keyup", tecla);
  }

  function desconectar() {
    const socketActivo = referenciaAlSocket.current;
    if (socketActivo !== null) socketActivo.disconnect();
  }

  return {
    estaConectado,
    colorAsignado,
    juegoLleno,
    enviarKeydown,
    enviarKeyup,
    desconectar,
  };
}
