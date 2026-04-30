import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";

// =============================================================================
// ControlDireccional — Botones izquierda y derecha grandes
//
// Ocupan toda la mitad izquierda de la pantalla verticalmente.
// Cada botón tiene su propia animación independiente.
// =============================================================================

const DIRECCIONES = {
  IZQUIERDA: "izquierda",
  DERECHA:   "derecha",
};

const ESCALA_AL_PRESIONAR   = 0.92;
const DURACION_DE_ANIMACION = 60;

// Calculamos el alto disponible para los botones
const ALTO_DE_PANTALLA = Dimensions.get("window").height;
// Cada botón ocupa casi la mitad del alto disponible
const ALTO_DE_BOTON    = (ALTO_DE_PANTALLA - 60) / 2;

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
    // Los dos botones van UNO ARRIBA DEL OTRO (column)
    // izquierda arriba, derecha abajo
    <View style={estilos.contenedor}>

      <Animated.View style={[
        estilos.botonContenedor,
        { transform: [{ scale: escalaIzquierda }] },
      ]}>
        <TouchableOpacity
          style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresionIzquierda}
          onPressOut={manejarSueltaIzquierda}
          activeOpacity={1}
        >
          <Text style={estilos.flecha}>◀</Text>
          <Text style={estilos.etiqueta}>IZQ</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={estilos.separador} />

      <Animated.View style={[
        estilos.botonContenedor,
        { transform: [{ scale: escalaDerecha }] },
      ]}>
        <TouchableOpacity
          style={[estilos.boton, estilos.botonDerecha, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresionDerecha}
          onPressOut={manejarSueltaDerecha}
          activeOpacity={1}
        >
          <Text style={estilos.flecha}>▶</Text>
          <Text style={estilos.etiqueta}>DER</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:          1,
    flexDirection: "column", // Arriba izquierda, abajo derecha
    padding:       8,
    gap:           8,
  },
  botonContenedor: {
    flex: 1, // Cada botón ocupa la mitad del espacio
  },
  boton: {
    flex:            1,
    borderRadius:    20,
    backgroundColor: "#1e3a5f",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     2,
    borderColor:     "rgba(74,111,165,0.7)",
    elevation:       6,
  },
  botonDerecha: {
    backgroundColor: "#1a3a6f",
    borderColor:     "rgba(52,152,219,0.7)",
  },
  botonDeshabilitado: {
    backgroundColor: "#111",
    borderColor:     "rgba(255,255,255,0.05)",
    elevation:       0,
  },
  flecha: {
    color:    "#ffffff",
    fontSize: 48,
  },
  etiqueta: {
    color:      "rgba(255,255,255,0.5)",
    fontSize:   12,
    marginTop:  4,
    fontWeight: "600",
  },
  separador: {
    height: 4,
  },
});