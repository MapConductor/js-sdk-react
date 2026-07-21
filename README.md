English | [日本語](./README.ja.md) | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/js-sdk-react

Shared React components for the MapConductor SDK: markers, shapes, info
bubbles, and overlay layers that render inside any provider map view
(`react-for-googlemaps`, `react-for-maplibre`, `react-for-here`, …). The same
components work on the web and — through the package's React Native entry
point and bundled Android/iOS modules — in React Native.

## Installation

Installing any provider package pulls this in automatically. Install it
explicitly when you import from it directly (which typical application code
does), or with pnpm's strict (isolated) `node_modules`:

```shell
npm install @mapconductor/js-sdk-react
```

## Quick start

The components are provider-independent children of a map view; the example
uses MapLibre, but swapping the provider imports leaves the children
unchanged:

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

Each component also accepts a `state` object created with the
`@mapconductor/js-sdk-core` factories (`createMarkerState`, …) when you want to
mutate overlays imperatively or share them across views.

## Components

- `Marker` and `Markers` — single markers and efficient bulk registration
- `Circle`, `Polyline`, `Polygon` — shape overlays
- `GroundImage`, `RasterLayer` — image and raster tile overlays
- `InfoBubble` and related overlays — info windows anchored to the map
- `MarkerAnimationLayer` — animated marker movement
- Hooks and map-scope utilities for building custom overlay components

## React Native

The package ships the React Native runtime alongside the web build: the
`react-native` export condition resolves automatically in RN bundlers (you can
also import `@mapconductor/js-sdk-react/native` explicitly), and the included
Android module and podspec autolink the native core. Use it together with the
React Native entry points of `react-for-googlemaps` or `react-for-maplibre`.

## Related packages

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — geometry, camera, and state primitives
- `@mapconductor/react-for-*` — provider packages (Google Maps, MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS, Cesium, HERE)
