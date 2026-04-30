import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from "react-native";

// =============================================================================
// BotonDeAccion — Botón A de salto que ocupa toda la mitad derecha
// =============================================================================

const ESCALA_AL_PRESIONAR   = 0.88;
const DURACION_DE_ANIMACION = 60;

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
    // El View exterior ocupa todo el espacio de la mitad derecha
    <View style={estilos.contenedorExterno}>
      <Animated.View style={[
        estilos.contenedorAnimado,
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
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedorExterno: {
    flex:    1,
    padding: 8,
  },
  contenedorAnimado: {
    flex: 1,
  },
  boton: {
    flex:            1,
    borderRadius:    20,
    backgroundColor: "#c0392b",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     3,
    borderColor:     "#e74c3c",
    elevation:       8,
    shadowColor:     "#c0392b",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.5,
    shadowRadius:    8,
  },
  botonDeshabilitado: {
    backgroundColor: "#1a1a1a",
    borderColor:     "#333",
    elevation:       0,
    shadowOpacity:   0,
  },
  letraA: {
    color:      "#ffffff",
    fontSize:   64,
    fontWeight: "bold",
    lineHeight: 70,
  },
  etiqueta: {
    color:         "rgba(255,255,255,0.6)",
    fontSize:      14,
    fontWeight:    "600",
    letterSpacing: 2,
  },
});