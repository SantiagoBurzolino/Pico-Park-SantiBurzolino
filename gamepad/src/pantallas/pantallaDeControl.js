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
import { useConexionAlServidor } from "../hooks/useConexionAlServidor";
import { ControlDireccional }    from "../componentes/controlDireccional";
import { BotonDeAccion }         from "../componentes/botonDeAccion";
import { PantallaDeLobbby }      from "./pantallaDeLobby";

// =============================================================================
// PantallaDeControl — Orquestador del gamepad
//
// Responsabilidad: decidir qué mostrar según el estado de conexión:
// - Si está en lobby → muestra PantallaDeLobbby (votación + inicio)
// - Si el juego empezó → muestra los controles (D-Pad + botón A)
// =============================================================================

export function PantallaDeControl({ ipDelServidor, onDesconexion }) {
  const {
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
  } = useConexionAlServidor(ipDelServidor);

  // Wake Lock: pantalla siempre encendida mientras se juega
  useEffect(() => {
    activateKeepAwakeAsync();
    return () => deactivateKeepAwake();
  }, []);

  function manejarDesconexion() {
    desconectar();
    onDesconexion();
  }

  // Si el lobby está activo, mostramos la pantalla de votación
  if (lobbyActivo) {
    return (
      <PantallaDeLobbby
        estaConectado={estaConectado}
        colorAsignado={colorAsignado}
        juegoLleno={juegoLleno}
        estadoDeVotos={estadoDeVotos}
        onVotarNivel={votarNivel}
        onIniciarJuego={solicitarInicio}
        onDesconexion={manejarDesconexion}
        ipDelServidor={ipDelServidor}
      />
    );
  }

  // Si el juego ya empezó, mostramos los controles
  return (
    <VistaDeControl
      estaConectado={estaConectado}
      colorAsignado={colorAsignado}
      enviarKeydown={enviarKeydown}
      enviarKeyup={enviarKeyup}
      onDesconexion={manejarDesconexion}
    />
  );
}

// =============================================================================
// VistaDeControl — Los botones del gamepad durante el juego
// Botones grandes que ocupan toda la pantalla dividida en dos mitades.
// =============================================================================

function VistaDeControl({
  estaConectado,
  colorAsignado,
  enviarKeydown,
  enviarKeyup,
  onDesconexion,
}) {
  const colorDelIndicador = estaConectado ? "#2ecc71" : "#e74c3c";

  return (
    <SafeAreaView style={estilosDeControl.contenedor}>
      <StatusBar hidden />

      {/* Barra de estado mínima */}
      <View style={estilosDeControl.barraDeEstado}>
        <View style={[
          estilosDeControl.led,
          { backgroundColor: colorDelIndicador },
        ]} />
        <Text style={[estilosDeControl.textoEstado, { color: colorDelIndicador }]}>
          {estaConectado ? "● En juego" : "● Desconectado"}
        </Text>
        {colorAsignado && (
          <View style={[
            estilosDeControl.circuloDeColor,
            { backgroundColor: colorAsignado },
          ]} />
        )}
        <TouchableOpacity onPress={onDesconexion} style={estilosDeControl.botonSalir}>
          <Text style={estilosDeControl.textoSalir}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Área de control: ocupa todo el espacio restante */}
      <View style={estilosDeControl.areaDeControl}>

        {/* Mitad izquierda: botones direccionales grandes */}
        <View style={estilosDeControl.mitadIzquierda}>
          <ControlDireccional
            onPresionar={(dir) => enviarKeydown(dir)}
            onSoltar={(dir) => enviarKeyup(dir)}
            estaDeshabilitado={!estaConectado}
          />
        </View>

        {/* Mitad derecha: botón A grande */}
        <View style={estilosDeControl.mitadDerecha}>
          <BotonDeAccion
            onPresionar={() => enviarKeydown("salto")}
            onSoltar={() => enviarKeyup("salto")}
            estaDeshabilitado={!estaConectado}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}

const estilosDeControl = StyleSheet.create({
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
    gap:               10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  led: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  textoEstado: {
    fontSize:   13,
    fontWeight: "600",
    flex:       1,
  },
  circuloDeColor: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.3)",
  },
  botonSalir: {
    padding: 4,
  },
  textoSalir: {
    color:      "#e74c3c",
    fontSize:   16,
    fontWeight: "bold",
  },
  areaDeControl: {
    flex:          1,
    flexDirection: "row",
  },
  mitadIzquierda: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  mitadDerecha: {
    flex:           1,
    justifyContent: "center",
    alignItems:     "center",
  },
});