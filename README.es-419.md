[English](./README.md) | [日本語](./README.ja.md) | Español (Latinoamérica)

# @mapconductor/js-sdk-react

Componentes de React compartidos del SDK de MapConductor: marcadores, formas, burbujas de información y capas de superposición que se renderizan dentro de cualquier vista de mapa de proveedor (`react-for-googlemaps`, `react-for-maplibre`, `react-for-here`, …). Los mismos componentes funcionan en la web y — mediante el punto de entrada de React Native del paquete y los módulos nativos de Android/iOS incluidos — en React Native.

## Instalación

Instalar cualquier paquete de proveedor lo incluye automáticamente. Instálalo explícitamente cuando importes directamente de él (lo que hace el código de aplicación típico) o con el `node_modules` estricto (aislado) de pnpm:

```shell
npm install @mapconductor/js-sdk-react
```

## Inicio rápido

Los componentes son independientes del proveedor y se renderizan como hijos de una vista de mapa; el ejemplo usa MapLibre, pero al cambiar los imports del proveedor los hijos quedan sin cambios:

```tsx
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { Circle, Marker } from '@mapconductor/js-sdk-react';
import {
  MapLibreDesign,
  MapLibreMapView2D,
  useMapLibreViewState,
} from '@mapconductor/react-for-maplibre';
import '@mapconductor/react-for-maplibre/style.css';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });

export function App() {
  const state = useMapLibreViewState({
    mapDesignType: MapLibreDesign.OsmBrightJa,
    cameraPosition: createMapCameraPosition({ position: TOKYO, zoom: 12 }),
  });

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <MapLibreMapView2D state={state}>
        <Marker position={TOKYO} />
        <Circle center={TOKYO} radiusMeters={800} strokeColor="#2563eb" />
      </MapLibreMapView2D>
    </div>
  );
}
```

Cada componente también acepta un objeto `state` creado con las fábricas de `@mapconductor/js-sdk-core` (`createMarkerState`, …) cuando quieras mutar superposiciones de forma imperativa o compartirlas entre vistas.

## Componentes

- `Marker` y `Markers` — marcadores individuales y registro masivo eficiente
- `Circle`, `Polyline`, `Polygon` — superposiciones de formas
- `GroundImage`, `RasterLayer` — superposiciones de imágenes y teselas ráster
- `InfoBubble` y superposiciones relacionadas — ventanas de información ancladas al mapa
- `MarkerAnimationLayer` — movimiento animado de marcadores
- Hooks y utilidades de ámbito de mapa para construir componentes de superposición personalizados

## React Native

El paquete incluye el runtime de React Native junto con la compilación web: la condición de export `react-native` se resuelve automáticamente en los bundlers de RN (también puedes importar `@mapconductor/js-sdk-react/native` explícitamente), y el módulo de Android y el podspec incluidos autoenlazan el core nativo. Úsalo junto con los puntos de entrada de React Native de `react-for-googlemaps` o `react-for-maplibre`.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — primitivas de geometría, cámara y estado
- `@mapconductor/react-for-*` — paquetes de proveedor (Google Maps, MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS, Cesium, HERE)
