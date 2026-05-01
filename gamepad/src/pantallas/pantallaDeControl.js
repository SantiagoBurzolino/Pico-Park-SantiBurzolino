import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import { useConexionAlServidor } from "../hooks/useConexionAlServidor";
import { ControlDireccional }    from "../componentes/controlDireccional";
import { BotonDeAccion }         from "../componentes/botonDeAccion";

// =============================================================================
// PantallaDeControl — Gamepad en landscape
//
// Layout:
// ┌─────────────────────────────────────────────────────────┐
// │ ●Conectado   192.168.x.x  [COLOR] [INICIAR]        [✕] │
// ├──────────────────────────┬──────────────────────────────┤
// │   [◀ IZQ]   [DER ▶]     │           [  A  ]            │
// │                          │          SALTO               │
// └──────────────────────────┴──────────────────────────────┘
//
// El botón INICIAR le dice al servidor que empiece el juego.
// El botón ✕ está en la barra superior, siempre accesible.
// =============================================================================

export function PantallaDeControl({ ipDelServidor, onDesconexion }) {
  const {
    estaConectado,
    colorAsignado,
    juegoLleno,
    enviarKeydown,
    enviarKeyup,
    desconectar,
    solicitarInicio,
  } = useConexionAlServidor(ipDelServidor);

  useEffect(() => {
    // Forzamos landscape al entrar y liberamos al salir
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    activateKeepAwakeAsync();

    return () => {
      ScreenOrientation.unlockAsync();
      deactivateKeepAwake();
    };
  }, []);

  function manejarDesconexion() {
    desconectar();
    onDesconexion();
  }

  const colorDelIndicador = estaConectado ? "#2ecc71" : juegoLleno ? "#f39c12" : "#e74c3c";
  const textoDeEstado     = juegoLleno
    ? "⚠️ Lleno"
    : estaConectado
      ? "● Conectado"
      : "● Conectando...";

  return (
    <View style={estilos.contenedor}>
      <StatusBar hidden />

      {/* ── Barra superior con todos los controles ────────────────────── */}
      <View style={estilos.barraDeEstado}>

        {/* LED + texto de estado */}
        <View style={estilos.seccionDeEstado}>
          <View style={[estilos.led, { backgroundColor: colorDelIndicador }]} />
          <Text style={[estilos.textoDeEstado, { color: colorDelIndicador }]}>
            {textoDeEstado}
          </Text>
        </View>

        {/* IP */}
        <Text style={estilos.textoDeIp}>🖥️ {ipDelServidor}</Text>

        {/* Color del jugador */}
        {colorAsignado && (
          <View style={[estilos.circuloDeColor, { backgroundColor: colorAsignado }]} />
        )}

        {/* Botón INICIAR — le dice al servidor que empiece el juego */}
        <TouchableOpacity
          style={[
            estilos.botonDeInicio,
            !estaConectado && estilos.botonDeshabilitado,
          ]}
          onPress={solicitarInicio}
          disabled={!estaConectado}
        >
          <Text style={estilos.textoDeInicio}>▶ INICIAR</Text>
        </TouchableOpacity>

        {/* Botón ✕ para desconectarse — siempre visible en la barra */}
        <TouchableOpacity
          style={estilos.botonDeDesconectar}
          onPress={manejarDesconexion}
        >
          <Text style={estilos.textoDeDesconectar}>✕</Text>
        </TouchableOpacity>

      </View>

      {/* ── Área de control ───────────────────────────────────────────── */}
      <View style={estilos.areaDeControl}>

        <View style={estilos.mitadIzquierda}>
          <ControlDireccional
            onPresionar={(dir) => enviarKeydown(dir)}
            onSoltar={(dir)    => enviarKeyup(dir)}
            estaDeshabilitado={!estaConectado}
          />
        </View>

        <View style={estilos.divisorVertical} />

        <View style={estilos.mitadDerecha}>
          <BotonDeAccion
            onPresionar={() => enviarKeydown("salto")}
            onSoltar={()    => enviarKeyup("salto")}
            estaDeshabilitado={!estaConectado}
          />
        </View>

      </View>

      {juegoLleno && (
        <View style={estilos.bannerDeLleno}>
          <Text style={estilos.textoDeLleno}>
            Sala llena — máximo 4 jugadores
          </Text>
        </View>
      )}

    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: "#0d0d1a",
    flexDirection:   "column",
  },

  barraDeEstado: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#16213e",
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               12,
    height:            48,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },

  seccionDeEstado: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flex:          1,
  },

  led: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },

  textoDeEstado: {
    fontSize:   12,
    fontWeight: "600",
  },

  textoDeIp: {
    color:    "rgba(255,255,255,0.4)",
    fontSize: 11,
  },

  circuloDeColor: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.4)",
  },

  // Botón INICIAR en la barra superior — siempre accesible
  botonDeInicio: {
    backgroundColor:   "#2ecc71",
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      8,
  },

  botonDeshabilitado: {
    backgroundColor: "#333",
  },

  textoDeInicio: {
    color:      "#ffffff",
    fontSize:   12,
    fontWeight: "bold",
  },

  // El botón ✕ ahora está en la barra → siempre tocable
  botonDeDesconectar: {
    paddingHorizontal: 8,
    paddingVertical:   4,
  },

  textoDeDesconectar: {
    color:      "#e74c3c",
    fontSize:   18,
    fontWeight: "bold",
  },

  areaDeControl: {
    flex:          1,
    flexDirection: "row",
  },

  mitadIzquierda: {
    flex:            1,
    backgroundColor: "#0a0a16",
  },

  divisorVertical: {
    width:           1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  mitadDerecha: {
    flex:            1,
    backgroundColor: "#0d0a16",
  },

  bannerDeLleno: {
    backgroundColor: "rgba(231,76,60,0.15)",
    paddingVertical: 6,
    alignItems:      "center",
    borderTopWidth:  1,
    borderTopColor:  "#e74c3c",
  },

  textoDeLleno: {
    color:    "#e74c3c",
    fontSize: 12,
  },
});