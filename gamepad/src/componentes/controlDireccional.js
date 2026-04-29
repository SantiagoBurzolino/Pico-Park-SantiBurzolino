import React, { useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
} from "react-native";

// =============================================================================
// ControlDireccional — D-Pad con botones izquierda y derecha
//
// Responsabilidad: mostrar los dos botones direccionales con animación
// y comunicar al padre cuándo se presiona/suelta cada dirección.
//
// Cada botón tiene su propia animación de escala independiente.
// =============================================================================

// Constante de dominio: nombres que coinciden exactamente con lo que
// espera el servidor en server/index.js
const DIRECCIONES = {
  IZQUIERDA: "izquierda",
  DERECHA:   "derecha",
};

// Cuánto se achica el botón al presionar (0.88 = 88% del tamaño original)
const ESCALA_AL_PRESIONAR    = 0.88;
const DURACION_DE_ANIMACION  = 70; // milisegundos

export function ControlDireccional({ onPresionar, onSoltar, estaDeshabilitado }) {
  // Cada botón tiene su propia Animated.Value para escala independiente
  const escalaIzquierda = useRef(new Animated.Value(1)).current;
  const escalaDerecha   = useRef(new Animated.Value(1)).current;

  /**
   * Anima un botón achicándolo al presionar o agrandándolo al soltar.
   * escalaAnimada: el Animated.Value del botón
   * haciaValor: 0.88 al presionar, 1 al soltar
   */
  function animarBoton(escalaAnimada, haciaValor) {
    Animated.timing(escalaAnimada, {
      toValue:         haciaValor,
      duration:        DURACION_DE_ANIMACION,
      useNativeDriver: true,  // Corre en el hilo nativo → más fluido
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

      {/* ── Botón Izquierda ── */}
      <Animated.View style={{ transform: [{ scale: escalaIzquierda }] }}>
        <TouchableOpacity
          style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresionIzquierda}
          onPressOut={manejarSueltaIzquierda}
          activeOpacity={1}   // Sin opacidad porque ya tenemos animación
        >
          <Text style={estilos.flecha}>◀</Text>
          <Text style={estilos.etiquetaBoton}>IZQ</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Espacio entre los dos botones */}
      <View style={estilos.espaciado} />

      {/* ── Botón Derecha ── */}
      <Animated.View style={{ transform: [{ scale: escalaDerecha }] }}>
        <TouchableOpacity
          style={[estilos.boton, estaDeshabilitado && estilos.botonDeshabilitado]}
          onPressIn={manejarPresionDerecha}
          onPressOut={manejarSueltaDerecha}
          activeOpacity={1}
        >
          <Text style={estilos.flecha}>▶</Text>
          <Text style={estilos.etiquetaBoton}>DER</Text>
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flexDirection: "row",   // Los dos botones uno al lado del otro
    alignItems:    "center",
  },

  boton: {
    width:           110,
    height:          110,
    borderRadius:    16,
    backgroundColor: "#1e3a5f",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     2,
    borderColor:     "rgba(74,111,165,0.6)",
    // Sombra en Android
    elevation:       6,
    // Sombra en iOS
    shadowColor:     "#4a6fa5",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.4,
    shadowRadius:    6,
  },

  botonDeshabilitado: {
    backgroundColor: "#111",
    borderColor:     "rgba(255,255,255,0.05)",
    elevation:       0,
    shadowOpacity:   0,
  },

  flecha: {
    color:    "#ffffff",
    fontSize: 36,
  },

  etiquetaBoton: {
    color:      "rgba(255,255,255,0.5)",
    fontSize:   10,
    marginTop:  2,
    fontWeight: "600",
  },

  espaciado: {
    width: 20,
  },
});