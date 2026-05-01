import React, { useRef } from "react";
import {
  Text,
  StyleSheet,
  Animated,
  View,
  Pressable,
} from "react-native";

// =============================================================================
// BotonDeAccion — Botón A de salto con soporte multi-touch
//
// Usa Pressable igual que ControlDireccional para que funcione
// simultáneamente con los botones direccionales.
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
    <View style={estilos.contenedorExterno}>
      <Animated.View style={[
        estilos.contenedorAnimado,
        { transform: [{ scale: escalaAnimada }] },
      ]}>
        <Pressable
          style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresion}
          onPressOut={manejarSuelta}
          delayLongPress={100000}
          accessible={false}
        >
          <Text style={estilos.letraA}>A</Text>
          <Text style={estilos.etiqueta}>SALTO</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedorExterno: {
    flex:    1,
    padding: 10,
  },
  contenedorAnimado: {
    flex: 1,
  },
  boton: {
    flex:            1,
    borderRadius:    16,
    backgroundColor: "#c0392b",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     3,
    borderColor:     "#e74c3c",
    elevation:       8,
  },
  botonDeshabilitado: {
    backgroundColor: "#1a1a1a",
    borderColor:     "#333",
    elevation:       0,
  },
  letraA: {
    color:      "#ffffff",
    fontSize:   72,
    fontWeight: "bold",
    lineHeight: 78,
  },
  etiqueta: {
    color:         "rgba(255,255,255,0.6)",
    fontSize:      14,
    fontWeight:    "600",
    letterSpacing: 3,
    marginTop:     4,
  },
});