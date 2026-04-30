import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";

// =============================================================================
// PantallaDeLobbby — Pantalla de espera antes de que empiece el juego
//
// Responsabilidad: mostrar quién está conectado, votar por un nivel
// y permitir iniciar el juego.
//
// Flujo:
// 1. El jugador se conecta → ve esta pantalla
// 2. Vota por nivel 1 o nivel 2 (puede cambiar el voto)
// 3. Cualquier jugador presiona "¡Jugar!" → el juego empieza para todos
// =============================================================================

const COLORES_DE_JUGADORES = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

export function PantallaDeLobbby({
  estaConectado,
  colorAsignado,
  juegoLleno,
  estadoDeVotos,
  onVotarNivel,
  onIniciarJuego,
  onDesconexion,
  ipDelServidor,
}) {
  // El nivel por el que votó este jugador (lo sacamos de estadoDeVotos si existe)
  const miVoto = estadoDeVotos?.votos
    ? Object.values(estadoDeVotos.votos)[0]  // simplificado
    : null;

  // Contamos cuántos votos tiene cada nivel
  const votosPorNivel1 = estadoDeVotos
    ? Object.values(estadoDeVotos.votos || {}).filter((v) => v === 1).length
    : 0;
  const votosPorNivel2 = estadoDeVotos
    ? Object.values(estadoDeVotos.votos || {}).filter((v) => v === 2).length
    : 0;

  const totalJugadores = estadoDeVotos?.totalJugadores || 0;

  return (
    <SafeAreaView style={estilos.contenedor}>
      <StatusBar hidden />

      {/* Barra superior */}
      <View style={estilos.barraDeEstado}>
        <View style={[
          estilos.led,
          { backgroundColor: estaConectado ? "#2ecc71" : "#e74c3c" },
        ]} />
        <Text style={[
          estilos.textoDeEstado,
          { color: estaConectado ? "#2ecc71" : "#e74c3c", flex: 1 },
        ]}>
          {juegoLleno ? "⚠️ Juego lleno" : estaConectado ? "● Conectado" : "● Conectando..."}
        </Text>
        <Text style={estilos.textoDeIp}>🖥️ {ipDelServidor}</Text>
        {colorAsignado && (
          <View style={[estilos.circuloDeColor, { backgroundColor: colorAsignado }]} />
        )}
        <TouchableOpacity onPress={onDesconexion}>
          <Text style={estilos.textoSalir}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Contenido principal del lobby */}
      <View style={estilos.contenidoPrincipal}>

        <Text style={estilos.titulo}>🎮 Pico Park</Text>
        <Text style={estilos.subtitulo}>Lobby — Esperando jugadores</Text>

        {/* Indicadores de jugadores conectados */}
        <View style={estilos.jugadoresConectados}>
          {COLORES_DE_JUGADORES.map((color, indice) => (
            <View
              key={indice}
              style={[
                estilos.cuadraditoDeJugador,
                { backgroundColor: color },
                indice >= totalJugadores && estilos.cuadraditoApagado,
              ]}
            />
          ))}
        </View>
        <Text style={estilos.textoJugadores}>
          {totalJugadores} de 4 jugadores conectados
        </Text>

        {/* Votación de niveles */}
        <Text style={estilos.tituloDeVotos}>Elegí el nivel:</Text>

        <View style={estilos.botonesDeNivel}>

          {/* Botón Nivel 1 */}
          <TouchableOpacity
            style={[
              estilos.botonDeNivel,
              { borderColor: "#2ecc71" },
            ]}
            onPress={() => onVotarNivel(1)}
            disabled={!estaConectado}
          >
            <Text style={estilos.numeroDeNivel}>1</Text>
            <Text style={estilos.nombreDeNivel}>La Llave</Text>
            <View style={estilos.contadorDeVotos}>
              <Text style={estilos.textoDeVotos}>{votosPorNivel1} votos</Text>
            </View>
          </TouchableOpacity>

          {/* Botón Nivel 2 */}
          <TouchableOpacity
            style={[
              estilos.botonDeNivel,
              { borderColor: "#8e44ad" },
            ]}
            onPress={() => onVotarNivel(2)}
            disabled={!estaConectado}
          >
            <Text style={estilos.numeroDeNivel}>2</Text>
            <Text style={estilos.nombreDeNivel}>La Torre</Text>
            <View style={estilos.contadorDeVotos}>
              <Text style={estilos.textoDeVotos}>{votosPorNivel2} votos</Text>
            </View>
          </TouchableOpacity>

        </View>

        {/* Nivel más votado */}
        {estadoDeVotos && (
          <Text style={estilos.nivelMasVotado}>
            Nivel elegido: {estadoDeVotos.nivelMasVotado === 1 ? "🟢 Nivel 1" : "🟣 Nivel 2"}
          </Text>
        )}

        {/* Botón de inicio */}
        <TouchableOpacity
          style={[
            estilos.botonDeInicio,
            !estaConectado && estilos.botonDeshabilitado,
          ]}
          onPress={onIniciarJuego}
          disabled={!estaConectado}
        >
          <Text style={estilos.textoDeInicio}>▶ ¡Jugar!</Text>
        </TouchableOpacity>

        <Text style={estilos.ayuda}>
          Cualquier jugador puede iniciar la partida
        </Text>

      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: "#0d0d1a",
  },
  barraDeEstado: {
    flexDirection:     "row",
    alignItems:        "center",
    backgroundColor:   "#16213e",
    paddingHorizontal: 16,
    paddingVertical:   10,
    gap:               10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  led: {
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
    fontSize: 11,
  },
  circuloDeColor: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.3)",
  },
  textoSalir: {
    color:      "#e74c3c",
    fontSize:   16,
    fontWeight: "bold",
    padding:    4,
  },
  contenidoPrincipal: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    padding:        24,
    gap:            16,
  },
  titulo: {
    fontSize:   36,
    fontWeight: "bold",
    color:      "#ffffff",
  },
  subtitulo: {
    fontSize: 14,
    color:    "#a0a0b0",
  },
  jugadoresConectados: {
    flexDirection: "row",
    gap:           12,
    marginTop:     8,
  },
  cuadraditoDeJugador: {
    width:        40,
    height:       40,
    borderRadius: 8,
    borderWidth:  2,
    borderColor:  "rgba(255,255,255,0.4)",
  },
  cuadraditoApagado: {
    opacity: 0.2,
  },
  textoJugadores: {
    color:    "#a0a0b0",
    fontSize: 13,
  },
  tituloDeVotos: {
    color:      "#ffffff",
    fontSize:   16,
    fontWeight: "600",
    marginTop:  8,
  },
  botonesDeNivel: {
    flexDirection: "row",
    gap:           16,
    width:         "100%",
  },
  botonDeNivel: {
    flex:           1,
    borderWidth:    2,
    borderRadius:   16,
    padding:        20,
    alignItems:     "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap:            8,
  },
  numeroDeNivel: {
    fontSize:   42,
    fontWeight: "bold",
    color:      "#ffffff",
  },
  nombreDeNivel: {
    fontSize: 14,
    color:    "#a0a0b0",
  },
  contadorDeVotos: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  textoDeVotos: {
    color:    "#ffffff",
    fontSize: 12,
  },
  nivelMasVotado: {
    color:      "#ffffff",
    fontSize:   15,
    fontWeight: "600",
  },
  botonDeInicio: {
    backgroundColor:   "#e94560",
    paddingVertical:   18,
    paddingHorizontal: 60,
    borderRadius:      14,
    marginTop:         8,
    width:             "100%",
    alignItems:        "center",
  },
  botonDeshabilitado: {
    backgroundColor: "#333",
  },
  textoDeInicio: {
    color:      "#ffffff",
    fontSize:   22,
    fontWeight: "bold",
  },
  ayuda: {
    color:    "#555",
    fontSize: 12,
  },
});