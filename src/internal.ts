/**
 * プロバイダパッケージ（`react-for-*`）と拡張パッケージ（`react-marker-clustering` 等）
 * だけが使う内部配線。**アプリケーションから import しないこと。**
 *
 * ここに置いてあるのは「プロバイダのビューが React コンポーネントである以上どこかに要る」
 * だけのフックで、SDK の利用者が呼ぶことはない。公開エントリ（`.`）から出すと
 * 使ってよい API に見えてしまうので分けてある。
 *
 * 予告なく変わる。semver の対象外。
 */
export { useMapViewScope } from './MapViewScope';
export { useCollectAndRenderOverlays } from './CollectAndRenderOverlays';
export { useCameraRestriction } from './hooks/useCameraRestriction';
export { useMapUISettings } from './hooks/useMapUISettings';
// React Native 専用のフックだが、`./internal` の型解決が web エントリへ落ちる
// 環境があるためこちらからも出しておく（web のビューは呼ばない）。
export { useNativeCapabilityDeclarations } from './hooks/useNativeCapabilityDeclarations';
export { useMarkerRenderingSupport } from './hooks/useMarkerRenderingSupport';
