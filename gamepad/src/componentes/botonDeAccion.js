import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from "react-native";

// =============================================================================
// BotonDeAccion — Botón grande de salto (botón "A")
//
// Responsabilidad: detectar presión/suelta, dar feedback visual
// animado y avisar al padre con onPresionar/onSoltar.
// =============================================================================

const ESCALA_AL_PRESIONAR   = 0.85;
const DURACION_DE_ANIMACION = 70;

export function BotonDeAccion({ onPresionar, onSoltar, estaDeshabilitado }) {
  const escalaAnimada = useRef(new Animated.Value(1)).current;

  function animarPresion() {
    Animated.timing(escalaAnimada, {
      toValue:         ESCALA_AL_PRESIONAR,
      duration:        DURACION_DE_ANIMACION,
      useNativeDriver: true,
    }).start();
  }

  function animarSuelta() {
    Animated.timing(escalaAnimada, {
      toValue:         1,
      duration:        DURACION_DE_ANIMACION,
      useNativeDriver: true,
    }).start();
  }

  function manejarPresion() {
    if (estaDeshabilitado) return;
    animarPresion();
    onPresionar();
  }

  function manejarSuelta() {
    if (estaDeshabilitado) return;
    animarSuelta();
    onSoltar();
  }

  return (
    <Animated.View style={[
      estilos.contenedor,
      { transform: [{ scale: escalaAnimada }] },
    ]}>
      <TouchableOpacity
        style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
        onPressIn={manejarPresion}
        onPressOut={manejarSuelta}
        activeOpacity={1}
      >
        <Text style={estilos.letraA}>A</Text>
        <Text style={estilos.etiqueta}>SALTO</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    // La sombra va en el Animated.View para que también se anime
    shadowColor:   "#c0392b",
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius:  10,
    elevation:     10,
  },

  boton: {
    width:           120,
    height:          120,
    borderRadius:    60,            // Perfecto círculo
    backgroundColor: "#c0392b",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     3,
    borderColor:     "#e74c3c",
  },

  botonDeshabilitado: {
    backgroundColor: "#1a1a1a",
    borderColor:     "#333",
  },

  letraA: {
    color:      "#ffffff",
    fontSize:   42,
    fontWeight: "bold",
    lineHeight: 46,
  },

  etiqueta: {
    color:      "rgba(255,255,255,0.6)",
    fontSize:   10,
    fontWeight: "600",
    letterSpacing: 1,
  },
});