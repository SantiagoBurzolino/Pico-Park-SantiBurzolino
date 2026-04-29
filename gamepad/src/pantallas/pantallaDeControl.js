import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useConexionAlServidor }  from "../hooks/useConexionAlServidor";
import { ControlDireccional }     from "../componentes/controlDireccional";
import { BotonDeAccion }          from "../componentes/botonDeAccion";

// =============================================================================
// PantallaDeControl — Gamepad principal estilo TecoGamePad
//
// Responsabilidad: mostrar el control en landscape (horizontal),
// conectar los componentes con el hook de WebSocket y mantener
// la pantalla encendida mientras se juega.
//
// Layout:
//   Izquierda → D-Pad (izquierda / derecha)
//   Derecha   → Botón A (salto)
// =============================================================================

export function PantallaDeControl({ ipDelServidor, onDesconexion }) {
  const {
    estaConectado,
    colorAsignado,
    juegoLleno,
    enviarKeydown,
    enviarKeyup,
    desconectar,
  } = useConexionAlServidor(ipDelServidor);

  // Wake Lock: evita que la pantalla se apague mientras se juega.
  // Se activa al montar el componente y se desactiva al desmontarlo.
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => deactivateKeepAwake();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function manejarPresionDireccion(direccion) {
    enviarKeydown(direccion);
  }

  function manejarSueltaDireccion(direccion) {
    enviarKeyup(direccion);
  }

  function manejarPresionDeSalto() {
    enviarKeydown("salto");
  }

  function manejarSueltaDeSalto() {
    enviarKeyup("salto");
  }

  function manejarDesconexion() {
    desconectar();
    onDesconexion();
  }

  // ── Estado de conexión para el indicador visual ──────────────────────────────
  const colorDelIndicador = estaConectado ? "#2ecc71" : juegoLleno ? "#f39c12" : "#e74c3c";
  const textoDeEstado     = juegoLleno
    ? "⚠️ Juego lleno"
    : estaConectado
      ? "● Conectado"
      : "● Conectando...";

  return (
    <SafeAreaView style={estilos.contenedor}>

      {/* Ocultamos la barra de estado del sistema para más espacio */}
      <StatusBar hidden />

      {/* ── Barra superior de estado ────────────────────────────────────────── */}
      <View style={estilos.barraDeEstado}>

        {/* Indicador LED + texto */}
        <View style={estilos.seccionDeIndicador}>
          <View style={[estilos.ledDeConexion, { backgroundColor: colorDelIndicador }]} />
          <Text style={[estilos.textoDeEstado, { color: colorDelIndicador }]}>
            {textoDeEstado}
          </Text>
        </View>

        {/* IP del servidor */}
        <Text style={estilos.textoDeIp}>🖥️ {ipDelServidor}:3000</Text>

        {/* Color asignado al jugador */}
        {colorAsignado && (
          <View style={[estilos.circuloDeColorDelJugador, { backgroundColor: colorAsignado }]} />
        )}

        {/* Botón desconectar */}
        <TouchableOpacity onPress={manejarDesconexion} style={estilos.botonDeDesconectar}>
          <Text style={estilos.textoDeDesconectar}>✕</Text>
        </TouchableOpacity>

      </View>

      {/* ── Área principal del control ──────────────────────────────────────── */}
      {/* flex: 1 hace que ocupe todo el espacio restante debajo de la barra   */}
      <View style={estilos.areaDeControl}>

        {/* D-Pad a la izquierda */}
        <View style={estilos.seccionIzquierda}>
          <ControlDireccional
            onPresionar={manejarPresionDireccion}
            onSoltar={manejarSueltaDireccion}
            estaDeshabilitado={!estaConectado}
          />
        </View>

        {/* Botón A a la derecha */}
        <View style={estilos.seccionDerecha}>
          <BotonDeAccion
            onPresionar={manejarPresionDeSalto}
            onSoltar={manejarSueltaDeSalto}
            estaDeshabilitado={!estaConectado}
          />
        </View>

      </View>

      {/* ── Mensaje si el juego está lleno ─────────────────────────────────── */}
      {juegoLleno && (
        <View style={estilos.bannerDeLleno}>
          <Text style={estilos.textoDeLleno}>
            El juego está lleno — máximo 4 jugadores
          </Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// =============================================================================
// ESTILOS
// StyleSheet.create optimiza los estilos en React Native.
// Es como CSS pero en JavaScript con camelCase.
// =============================================================================
const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,                // Ocupa toda la pantalla
    backgroundColor: "#0d0d1a",        // Fondo oscuro tipo consola
    flexDirection:   "column",
  },

  // Barra superior fina con el estado de conexión
  barraDeEstado: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#16213e",
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  seccionDeIndicador: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flex:          1,           // Ocupa el espacio disponible empujando los demás a la derecha
  },

  // El "LED" circular que indica si está conectado (verde) o no (rojo)
  ledDeConexion: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },

  textoDeEstado: {
    fontSize:   13,
    fontWeight: "600",
  },

  textoDeIp: {
    color:    "rgba(255,255,255,0.4)",
    fontSize: 12,
  },

  // Círculo del color asignado al jugador (rojo, azul, verde, naranja)
  circuloDeColorDelJugador: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.3)",
  },

  botonDeDesconectar: {
    padding:      6,
    borderRadius: 6,
  },

  textoDeDesconectar: {
    color:      "#e74c3c",
    fontSize:   16,
    fontWeight: "bold",
  },

  // Área principal que divide pantalla en izquierda y derecha
  areaDeControl: {
    flex:           1,              // Ocupa todo el espacio restante
    flexDirection:  "row",          // Izquierda y derecha uno al lado del otro
    alignItems:     "center",
    paddingVertical: 20,
  },

  // Mitad izquierda: D-Pad
  seccionIzquierda: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingLeft:    24,
  },

  // Mitad derecha: botón A
  seccionDerecha: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingRight:   24,
  },

  bannerDeLleno: {
    backgroundColor: "rgba(231,76,60,0.15)",
    paddingVertical: 10,
    alignItems:      "center",
    borderTopWidth:  1,
    borderTopColor:  "#e74c3c",
  },

  textoDeLleno: {
    color:    "#e74c3c",
    fontSize: 13,
  },
});