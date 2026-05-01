import React, { useState } from "react";
import { PantallaDeConexion } from "./src/pantallas/pantallaDeConexion";
import { PantallaDeControl }  from "./src/pantallas/pantallaDeControl";

// =============================================================================
// App.js — Punto de entrada
//
// Responsabilidad única: decidir qué pantalla mostrar.
// Sin IP → pantalla de conexión
// Con IP → pantalla de control (gamepad)
// =============================================================================

export default function App() {
  const [direccionIpDelServidor, setDireccionIpDelServidor] = useState(null);

  function manejarConexionExitosa(ipIngresada) {
    setDireccionIpDelServidor(ipIngresada);
  }

  function manejarDesconexion() {
    setDireccionIpDelServidor(null);
  }

  const estaConectado = direccionIpDelServidor !== null;

  if (!estaConectado) {
    return <PantallaDeConexion onConexionExitosa={manejarConexionExitosa} />;
  }

  return (
    <PantallaDeControl
      ipDelServidor={direccionIpDelServidor}
      onDesconexion={manejarDesconexion}
    />
  );
}