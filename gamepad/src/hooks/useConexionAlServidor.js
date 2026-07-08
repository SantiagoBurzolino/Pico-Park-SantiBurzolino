import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const PUERTO_DEL_SERVIDOR = 3005;

export function useConexionAlServidor(ipDelServidor) {
  const referenciaAlSocket = useRef(null);

  const [estaConectado, setEstaConectado] = useState(false);
  const [colorAsignado, setColorAsignado] = useState(null);
  const [juegoLleno,    setJuegoLleno]    = useState(false);

  useEffect(() => {
    const urlDelServidor = `http://${ipDelServidor}:${PUERTO_DEL_SERVIDOR}`;

    const socket = io(urlDelServidor, {
      timeout:    5000,
      transports: ["websocket"],
    });

    referenciaAlSocket.current = socket;

    socket.on("connect", () => {
      socket.emit("identificarse", "gamepad");
    });

    socket.on("jugador_asignado", (datos) => {
      setColorAsignado(datos.color);
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

    return () => {
      socket.disconnect();
    };
  }, [ipDelServidor]);

  function enviarKeydown(tecla) {
    const socket = referenciaAlSocket.current;
    if (socket === null || !estaConectado) return;
    socket.emit("keydown", tecla);
  }

  function enviarKeyup(tecla) {
    const socket = referenciaAlSocket.current;
    if (socket === null || !estaConectado) return;
    socket.emit("keyup", tecla);
  }

  /**
   * Le pide al servidor que inicie el juego.
   * El servidor manda "juego_iniciado" al navegador (PC)
   * y el juego carga el nivel 1 automáticamente.
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
    enviarKeydown,
    enviarKeyup,
    solicitarInicio,
    desconectar,
  };
}