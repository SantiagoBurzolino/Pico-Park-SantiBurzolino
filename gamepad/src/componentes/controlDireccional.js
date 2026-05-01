import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from "react-native";

// =============================================================================
// ControlDireccional — Botones izquierda y derecha con soporte multi-touch
//
// PROBLEMA RESUELTO: TouchableOpacity no permite múltiples toques simultáneos.
// SOLUCIÓN: Usamos Pressable que sí soporta multi-touch nativo en Android.
// Esto permite presionar izquierda/derecha y salto al mismo tiempo.
// =============================================================================

const DIRECCIONES = {
  IZQUIERDA: "izquierda",
  DERECHA:   "derecha",
};

const ESCALA_AL_PRESIONAR   = 0.93;
const DURACION_DE_ANIMACION = 60;

export function ControlDireccional({ onPresionar, onSoltar, estaDeshabilitado }) {
  const escalaIzquierda = useRef(new Animated.Value(1)).current;
  const escalaDerecha   = useRef(new Animated.Value(1)).current;

  function animarBoton(escala, valor) {
    Animated.timing(escala, {
      toValue:         valor,
      duration:        DURACION_DE_ANIMACION,
      useNativeDriver: true,
    }).start();
  }

  function manejarPresionIzquierda() {
    if (estaDeshabilitado) return;
    animarBoton(escalaIzquierda, ESCALA_AL_PRESIONAR);
    onPresionar(DIRECCIONES.IZQUIERDA);
  }

  function manejarSueltaIzquierda() {
    if (estaDeshabilitado) return;
    animarBoton(escalaIzquierda, 1);
    onSoltar(DIRECCIONES.IZQUIERDA);
  }

  function manejarPresionDerecha() {
    if (estaDeshabilitado) return;
    animarBoton(escalaDerecha, ESCALA_AL_PRESIONAR);
    onPresionar(DIRECCIONES.DERECHA);
  }

  function manejarSueltaDerecha() {
    if (estaDeshabilitado) return;
    animarBoton(escalaDerecha, 1);
    onSoltar(DIRECCIONES.DERECHA);
  }

  return (
    <View style={estilos.contenedor}>

      {/* ── Botón Izquierda ────────────────────────────────────────────── */}
      <Animated.View style={[
        estilos.botonContenedor,
        { transform: [{ scale: escalaIzquierda }] },
      ]}>
        {/*
          Pressable con delayLongPress={100000} evita el menú contextual.
          accessible={false} evita que el lector de pantalla interfiera.
          El multi-touch funciona porque Pressable no bloquea otros toques.
        */}
        <Pressable
          style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresionIzquierda}
          onPressOut={manejarSueltaIzquierda}
          delayLongPress={100000}
          accessible={false}
        >
          <Text style={estilos.flecha}>◀</Text>
          <Text style={estilos.etiqueta}>IZQ</Text>
        </Pressable>
      </Animated.View>

      <View style={estilos.separador} />

      {/* ── Botón Derecha ──────────────────────────────────────────────── */}
      <Animated.View style={[
        estilos.botonContenedor,
        { transform: [{ scale: escalaDerecha }] },
      ]}>
        <Pressable
          style={[
            estilos.boton,
            estilos.botonDerecha,
            estaDeshabilitado && estilos.botonDeshabilitado,
          ]}
          onPressIn={manejarPresionDerecha}
          onPressOut={manejarSueltaDerecha}
          delayLongPress={100000}
          accessible={false}
        >
          <Text style={estilos.flecha}>▶</Text>
          <Text style={estilos.etiqueta}>DER</Text>
        </Pressable>
      </Animated.View>

    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:          1,
    flexDirection: "row",
    padding:       10,
    gap:           10,
  },
  botonContenedor: {
    flex: 1,
  },
  boton: {
    flex:            1,
    borderRadius:    16,
    backgroundColor: "#1e3a5f",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     2,
    borderColor:     "rgba(74,111,165,0.8)",
    elevation:       4,
  },
  botonDerecha: {
    backgroundColor: "#1a3a6f",
    borderColor:     "rgba(52,152,219,0.8)",
  },
  botonDeshabilitado: {
    backgroundColor: "#111",
    borderColor:     "rgba(255,255,255,0.05)",
    elevation:       0,
  },
  flecha: {
    color:    "#ffffff",
    fontSize: 52,
  },
  etiqueta: {
    color:      "rgba(255,255,255,0.5)",
    fontSize:   12,
    marginTop:  6,
    fontWeight: "600",
  },
  separador: {
    width: 8,
  },
});