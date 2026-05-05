import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  PanResponder,
  Dimensions,
} from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import { useConexionAlServidor } from "../hooks/useConexionAlServidor";

// =============================================================================
// PantallaDeControl — Gamepad con multi-touch real
//
// SOLUCIÓN AL STALE CLOSURE:
// El PanResponder se crea una sola vez pero necesita acceder a funciones
// que cambian (enviarKeydown, enviarKeyup, estaConectado).
// La solución es guardar esas funciones en refs y acceder a ellas
// desde el PanResponder a través de las refs.
// Así el PanResponder siempre usa la versión más reciente.
//
// Layout en landscape:
// ┌──────────────────────────────────────────────────────┐
// │ ● Conectado    192.168.x.x    [COLOR]           [✕] │
// ├────────────────┬───────────────┬────────────────────┤
// │   [ ◀ IZQ ]   │   [ DER ▶ ]  │    [  A SALTO ]    │
// │   25% ancho    │   25% ancho  │    50% ancho        │
// └────────────────┴───────────────┴────────────────────┘
// =============================================================================

const ALTO_DE_BARRA_DE_ESTADO = 48;

export function PantallaDeControl({ ipDelServidor, onDesconexion }) {
  const {
    estaConectado,
    colorAsignado,
    juegoLleno,
    enviarKeydown,
    enviarKeyup,
    desconectar,
    // solicitarInicio eliminado — el juego inicia desde la PC
  } = useConexionAlServidor(ipDelServidor);

  // Guardamos el estado de las teclas sin provocar re-renders
  const estadoDeTeclas = useRef({
    izquierda: false,
    derecha:   false,
    salto:     false,
  });

  // Estado visual para el feedback de los botones al presionar
  const estadoVisual = useRef({
    izquierda: false,
    derecha:   false,
    salto:     false,
  });

  // ── Refs para evitar stale closures ──────────────────────────────────────
  // El PanResponder se crea una sola vez. Sin refs, usaría versiones
  // viejas de enviarKeydown/enviarKeyup → los botones no responderían.
  const enviarKeydownRef = useRef(enviarKeydown);
  const enviarKeyupRef   = useRef(enviarKeyup);
  const estaConectadoRef = useRef(estaConectado);

  // Actualizamos los refs cada vez que cambian los valores del hook
  useEffect(() => { enviarKeydownRef.current = enviarKeydown; }, [enviarKeydown]);
  useEffect(() => { enviarKeyupRef.current   = enviarKeyup;   }, [enviarKeyup]);
  useEffect(() => { estaConectadoRef.current = estaConectado; }, [estaConectado]);

  // Para forzar re-render cuando cambia el estado visual de los botones
  const [, forzarRender] = React.useState(0);
  const actualizarVista  = () => forzarRender((n) => n + 1);

  useEffect(() => {
    // Forzamos landscape al entrar al gamepad
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    // Wake Lock: evita que la pantalla se apague durante el juego
    activateKeepAwakeAsync();

    return () => {
      ScreenOrientation.unlockAsync();
      deactivateKeepAwake();
    };
  }, []);

  // ── Lógica de zonas táctiles ─────────────────────────────────────────────

  /**
   * Determina en qué zona cayó un toque según su posición X en pantalla.
   * 0-25%  → izquierda
   * 25-50% → derecha
   * 50-100% → salto
   */
  function obtenerZonaDeToque(toqueX) {
    const anchoDePantalla = Dimensions.get("window").width;
    const porcentajeX     = toqueX / anchoDePantalla;

    if (porcentajeX < 0.25) return "izquierda";
    if (porcentajeX < 0.50) return "derecha";
    return "salto";
  }

  /**
   * Procesa todos los dedos activos en pantalla.
   * Compara con el estado anterior y envía keydown/keyup solo cuando hay cambio.
   * Evita spam de eventos al servidor.
   */
  function procesarToquesActivos(evento) {
    if (!estaConectadoRef.current) return;

    const toques       = evento.nativeEvent.touches;
    const zonasActivas = { izquierda: false, derecha: false, salto: false };

    for (let i = 0; i < toques.length; i++) {
      const toque               = toques[i];
      // Ignoramos toques en la barra de estado superior
      const estaEnAreaDeControl = toque.pageY > ALTO_DE_BARRA_DE_ESTADO;
      if (!estaEnAreaDeControl) continue;

      const zona         = obtenerZonaDeToque(toque.pageX);
      zonasActivas[zona] = true;
    }

    const teclas         = ["izquierda", "derecha", "salto"];
    let huboCambioVisual = false;

    teclas.forEach((tecla) => {
      const estabaActiva = estadoDeTeclas.current[tecla];
      const estaActiva   = zonasActivas[tecla];

      if (!estabaActiva && estaActiva) {
        // Tecla recién presionada → keydown
        enviarKeydownRef.current(tecla);
        estadoVisual.current[tecla] = true;
        huboCambioVisual            = true;
      } else if (estabaActiva && !estaActiva) {
        // Tecla recién soltada → keyup
        enviarKeyupRef.current(tecla);
        estadoVisual.current[tecla] = false;
        huboCambioVisual            = true;
      }
    });

    estadoDeTeclas.current = zonasActivas;
    if (huboCambioVisual) actualizarVista();
  }

  /**
   * Suelta todas las teclas cuando se levantan todos los dedos.
   * También se llama si el sistema interrumpe el gesto (notificación, llamada).
   */
  function soltarTodasLasTeclas() {
    if (!estaConectadoRef.current) return;

    const teclas         = ["izquierda", "derecha", "salto"];
    let huboCambioVisual = false;

    teclas.forEach((tecla) => {
      if (estadoDeTeclas.current[tecla]) {
        enviarKeyupRef.current(tecla);
        estadoVisual.current[tecla] = false;
        huboCambioVisual            = true;
      }
    });

    estadoDeTeclas.current = { izquierda: false, derecha: false, salto: false };
    if (huboCambioVisual) actualizarVista();
  }

  // ── PanResponder ─────────────────────────────────────────────────────────
  // Patrón "ref de función": actualizamos .current en cada render
  // para que el PanResponder siempre llame a la versión más reciente.
  const refProcesarToques   = useRef(null);
  const refSoltarTeclas     = useRef(null);
  refProcesarToques.current = procesarToquesActivos;
  refSoltarTeclas.current   = soltarTodasLasTeclas;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onMoveShouldSetPanResponder:         () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     (evt) => refProcesarToques.current(evt),
      onPanResponderMove:      (evt) => refProcesarToques.current(evt),
      onPanResponderRelease:   ()    => refSoltarTeclas.current(),
      onPanResponderTerminate: ()    => refSoltarTeclas.current(),
    })
  ).current;

  // ── Estado visual de la barra ─────────────────────────────────────────────

  const colorDelIndicador = estaConectado ? "#2ecc71" : juegoLleno ? "#f39c12" : "#e74c3c";
  const textoDeEstado     = juegoLleno
    ? "⚠️ Lleno"
    : estaConectado
      ? "● Conectado"
      : "● Conectando...";

  function manejarDesconexion() {
    soltarTodasLasTeclas();
    desconectar();
    onDesconexion();
  }

  return (
    <View style={estilos.contenedor}>
      <StatusBar hidden />

      {/* ── Barra de estado superior ─────────────────────────────────── */}
      <View style={estilos.barraDeEstado}>

        {/* LED + texto de estado */}
        <View style={estilos.seccionDeEstado}>
          <View style={[estilos.led, { backgroundColor: colorDelIndicador }]} />
          <Text style={[estilos.textoDeEstado, { color: colorDelIndicador }]}>
            {textoDeEstado}
          </Text>
        </View>

        {/* IP del servidor */}
        <Text style={estilos.textoDeIp}>🖥️ {ipDelServidor}</Text>

        {/* Círculo con el color asignado al jugador */}
        {colorAsignado && (
          <View style={[estilos.circuloDeColor, { backgroundColor: colorAsignado }]} />
        )}

        {/* Botón ✕ para desconectarse — siempre visible en la barra */}
        <TouchableOpacity style={estilos.botonDeDesconectar} onPress={manejarDesconexion}>
          <Text style={estilos.textoDeDesconectar}>✕</Text>
        </TouchableOpacity>

      </View>

      {/* ── Área de control con PanResponder ─────────────────────────── */}
      {/*
        Un único View que cubre toda el área de juego.
        El PanResponder detecta TODOS los dedos simultáneamente.
        Los hijos tienen pointerEvents="none" para no interceptar toques.
      */}
      <View style={estilos.areaDeControl} {...panResponder.panHandlers}>

        {/* Zona IZQ — 25% del ancho */}
        <View style={estilos.zonaIzquierda} pointerEvents="none">
          <View style={[
            estilos.botonVisual,
            estadoVisual.current.izquierda && estilos.botonVisualPresionado,
          ]}>
            <Text style={estilos.flechaGrande}>◀</Text>
            <Text style={estilos.etiquetaBoton}>IZQ</Text>
          </View>
        </View>

        {/* Zona DER — 25% del ancho */}
        <View style={estilos.zonaMedio} pointerEvents="none">
          <View style={[
            estilos.botonVisual,
            estilos.botonVisualDerecha,
            estadoVisual.current.derecha && estilos.botonVisualPresionado,
          ]}>
            <Text style={estilos.flechaGrande}>▶</Text>
            <Text style={estilos.etiquetaBoton}>DER</Text>
          </View>
        </View>

        {/* Separador visual */}
        <View style={estilos.separadorVertical} pointerEvents="none" />

        {/* Zona SALTO — 50% del ancho */}
        <View style={estilos.zonaDerecha} pointerEvents="none">
          <View style={[
            estilos.botonVisualSalto,
            estadoVisual.current.salto && estilos.botonSaltoPresionado,
          ]}>
            <Text style={estilos.letraA}>A</Text>
            <Text style={estilos.etiquetaSalto}>SALTO</Text>
          </View>
        </View>

      </View>

      {/* Banner cuando la sala está llena */}
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

// =============================================================================
// ESTILOS
// =============================================================================
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
    height:            ALTO_DE_BARRA_DE_ESTADO,
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
  zonaIzquierda: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#0a0a16",
  },
  zonaMedio: {
    flex:            1,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#0a0a18",
  },
  separadorVertical: {
    width:           2,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  zonaDerecha: {
    flex:            2,
    justifyContent:  "center",
    alignItems:      "center",
    backgroundColor: "#0d0a16",
  },
  botonVisual: {
    width:           "80%",
    aspectRatio:     1,
    borderRadius:    16,
    backgroundColor: "#1e3a5f",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     2,
    borderColor:     "rgba(74,111,165,0.7)",
  },
  botonVisualDerecha: {
    backgroundColor: "#1a3a6f",
    borderColor:     "rgba(52,152,219,0.7)",
  },
  botonVisualPresionado: {
    backgroundColor: "#2a5a9f",
    borderColor:     "#ffffff",
    transform:       [{ scale: 0.92 }],
  },
  flechaGrande: {
    color:    "#ffffff",
    fontSize: 40,
  },
  etiquetaBoton: {
    color:      "rgba(255,255,255,0.5)",
    fontSize:   11,
    marginTop:  4,
    fontWeight: "600",
  },
  botonVisualSalto: {
    width:           "70%",
    aspectRatio:     1,
    borderRadius:    999,
    backgroundColor: "#c0392b",
    justifyContent:  "center",
    alignItems:      "center",
    borderWidth:     3,
    borderColor:     "#e74c3c",
    elevation:       6,
  },
  botonSaltoPresionado: {
    backgroundColor: "#e74c3c",
    borderColor:     "#ffffff",
    transform:       [{ scale: 0.88 }],
  },
  letraA: {
    color:      "#ffffff",
    fontSize:   60,
    fontWeight: "bold",
    lineHeight: 66,
  },
  etiquetaSalto: {
    color:         "rgba(255,255,255,0.7)",
    fontSize:      13,
    fontWeight:    "600",
    letterSpacing: 2,
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