[English](./README.md) | 日本語 | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/js-sdk-react

MapConductor SDK の共有 React コンポーネント群です。マーカー、シェイプ、インフォバブル、オーバーレイレイヤーを、任意のプロバイダのマップビュー(`react-for-googlemaps`、`react-for-maplibre`、`react-for-here` など)の中に描画できます。同じコンポーネントが Web でも、パッケージに含まれる React Native エントリポイントと Android/iOS ネイティブモジュールを通じて React Native でも動作します。

## インストール

いずれかのプロバイダパッケージをインストールすれば自動的に含まれます。このパッケージから直接 import する場合(通常のアプリケーションコードは該当します)や、pnpm の strict(isolated)な `node_modules` を使う場合は、明示的にインストールしてください:

```shell
npm install @mapconductor/js-sdk-react
```

## クイックスタート

コンポーネントはプロバイダ非依存で、マップビューの子要素として描画します。以下は MapLibre の例ですが、プロバイダの import を差し替えても子要素はそのまま使えます:

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

各コンポーネントは、`@mapconductor/js-sdk-core` のファクトリ(`createMarkerState` など)で作成した `state` オブジェクトも受け付けます。オーバーレイを命令的に更新したい場合や、複数のビューで共有したい場合に使用してください。

## コンポーネント

- `Marker` / `Markers` — 単体マーカーと効率的な一括登録
- `Circle`、`Polyline`、`Polygon` — シェイプオーバーレイ
- `GroundImage`、`RasterLayer` — 画像・ラスタータイルのオーバーレイ
- `InfoBubble` と関連オーバーレイ — 地図にアンカーされる情報ウィンドウ
- `MarkerAnimationLayer` — マーカー移動のアニメーション
- カスタムオーバーレイコンポーネントを作るためのフックとマップスコープユーティリティ

## React Native

このパッケージは Web ビルドと併せて React Native ランタイムを同梱しています。RN のバンドラでは `react-native` の export 条件が自動的に解決され(明示的に `@mapconductor/js-sdk-react/native` を import することも可能)、同梱の Android モジュールと podspec によりネイティブコアがオートリンクされます。`react-for-googlemaps` または `react-for-maplibre` の React Native エントリポイントと組み合わせて使用してください。

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- `@mapconductor/react-for-*` — プロバイダパッケージ(Google Maps、MapLibre、Mapbox、Leaflet、OpenLayers、ArcGIS、Cesium、HERE)
