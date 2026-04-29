import React, { useState } from "react";
import { PantallaDeConexion } from "./src/pantallas/pantallaDeConexion";
import { PantallaDeControl }  from "./src/pantallas/pantallaDeControl";

// =============================================================================
// App.js — Punto de entrada de la aplicación
//
// Responsabilidad única: decidir qué pantalla mostrar según
// si el jugador ya ingresó la IP o no.
// =============================================================================

export default function App() {
  // Guarda la IP que escribió el usuario. null = no conectado todavía.
  const [direccionIpDelServidor, setDireccionIpDelServidor] = useState(null);

  function manejarConexionExitosa(ipIngresada) {
    setDireccionIpDelServidor(ipIngresada);
  }

  function manejarDesconexion() {
    setDireccionIpDelServidor(null);
  }

  const estaConectado = direccionIpDelServidor !== null;

  if (!estaConectado) {
    return (
      <PantallaDeConexion onConexionExitosa={manejarConexionExitosa} />
    );
  }

  return (
    <PantallaDeControl
      ipDelServidor={direccionIpDelServidor}
      onDesconexion={manejarDesconexion}
    />
  );
}