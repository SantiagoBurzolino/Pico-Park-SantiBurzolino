import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

// =============================================================================
// PantallaDeConexion — El usuario ingresa la IP del servidor
//
// Responsabilidad: capturar y validar la IP. No maneja WebSockets.
// =============================================================================

const FORMATO_DE_IP_VALIDO = /^(\d{1,3}\.){3}\d{1,3}$/;

export function PantallaDeConexion({ onConexionExitosa }) {
  const [ipIngresada,    setIpIngresada]    = useState("");
  const [estaIntentando, setEstaIntentando] = useState(false);

  function validarFormatoDeIp(ip) {
    return FORMATO_DE_IP_VALIDO.test(ip.trim());
  }

  function manejarIntentoDeConexion() {
    const ipLimpia             = ipIngresada.trim();
    const tieneFormatoCorrecto = validarFormatoDeIp(ipLimpia);

    if (!tieneFormatoCorrecto) {
      Alert.alert(
        "IP inválida",
        "Ingresá una IP con formato correcto.\nEjemplo: 192.168.1.15"
      );
      return;
    }

    setEstaIntentando(true);
    onConexionExitosa(ipLimpia);
  }

  return (
    <KeyboardAvoidingView
      style={estilos.contenedor}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={estilos.tarjeta}>

        <Text style={estilos.titulo}>🎮 Pico Park</Text>
        <Text style={estilos.subtitulo}>Ingresá la IP del servidor</Text>
        <Text style={estilos.descripcion}>
          La IP aparece en la pantalla del juego (PC)
        </Text>

        <TextInput
          style={estilos.campoDeTexto}
          value={ipIngresada}
          onChangeText={setIpIngresada}
          placeholder="192.168.1.15"
          placeholderTextColor="#666"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
        />

        <TouchableOpacity
          style={[
            estilos.botonDeConexion,
            estaIntentando && estilos.botonDeshabilitado,
          ]}
          onPress={manejarIntentoDeConexion}
          disabled={estaIntentando}
        >
          <Text style={estilos.textoDelBoton}>
            {estaIntentando ? "Conectando..." : "Conectar al juego"}
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: "#1a1a2e",
    justifyContent:  "center",
    alignItems:      "center",
    padding:         24,
  },
  tarjeta: {
    backgroundColor: "#16213e",
    borderRadius:    16,
    padding:         32,
    width:           "100%",
    maxWidth:        380,
    alignItems:      "center",
    gap:             16,
  },
  titulo: {
    fontSize:   36,
    fontWeight: "bold",
    color:      "#ffffff",
  },
  subtitulo: {
    fontSize:   18,
    color:      "#a0a0b0",
    fontWeight: "600",
  },
  descripcion: {
    fontSize:  13,
    color:     "#666",
    textAlign: "center",
  },
  campoDeTexto: {
    width:         "100%",
    backgroundColor: "#0f3460",
    color:         "#ffffff",
    fontSize:      22,
    padding:       14,
    borderRadius:  10,
    textAlign:     "center",
    letterSpacing: 2,
    marginTop:     8,
  },
  botonDeConexion: {
    backgroundColor:  "#e94560",
    paddingVertical:  14,
    paddingHorizontal: 40,
    borderRadius:     10,
    marginTop:        8,
    width:            "100%",
    alignItems:       "center",
  },
  botonDeshabilitado: {
    backgroundColor: "#555",
  },
  textoDelBoton: {
    color:      "#ffffff",
    fontSize:   18,
    fontWeight: "bold",
  },
});