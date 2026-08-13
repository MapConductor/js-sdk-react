import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, StyleSheet, View } from 'react-native';
import { GeoPoint, MapCameraPosition, mapViewStateInternal } from '@mapconductor/js-sdk-core';
import {
  InfoBubbleLayer,
  type InfoBubblePositionRequest,
  type InfoBubbleScreenPositionMap,
  type MarkerScreenPositionMap,
} from '../info/InfoBubbleLayer.native';
import { MapAttributionOverlay } from '../MapAttributionOverlay.native';
import { MapContext, createMapContextValue } from '../MapContext';
import { MapViewScope, MapViewScopeProvider } from '../MapViewScope.native';
import { MapServiceRegistryProvider } from '../map/MapServiceRegistryContext';
import {
  registerIconScaleCallback,
  unregisterIconScaleCallback,
} from '../marker/IconScaleBridge.native';
import type { MapViewBaseProps } from '../map/MapViewBaseProps';
import type { MarkerTilingOptions, MapDesignTypeInterface, MapViewStateInterface } from '@mapconductor/js-sdk-core';
import { useCollectAndRenderOverlays } from '../CollectAndRenderOverlays';
import { useCameraRestriction } from '../hooks/useCameraRestriction';
import { useMapUISettings } from '../hooks/useMapUISettings';
import { useNativeCapabilityDeclarations } from '../hooks/useNativeCapabilityDeclarations';
import { useMarkerRenderingSupport } from '../hooks/useMarkerRenderingSupport';
import { ReactNativeBridgeMapViewController, type NativeViewRef } from './ReactNativeBridgeMapViewController';
import { toNativeCameraPosition, toNativeMarkerTilingOptions } from './nativePayloads';
import type { NativeMapViewProps } from './NativeMapViewProps';

export interface NativeMapViewHostProps<
  ViewRef extends NativeViewRef,
  TState extends MapViewStateInterface<MapDesignTypeInterface<unknown>> = MapViewStateInterface<
    MapDesignTypeInterface<unknown>
  >,
> extends MapViewBaseProps<TState> {
  markerTilingOptions?: MarkerTilingOptions;
  /** `requireNativeComponent` が返したプロバイダのネイティブビュー。 */
  nativeComponent: React.ComponentType<NativeMapViewProps & { ref?: React.Ref<ViewRef> }>;
  /** ネイティブへ渡すデザイン値。エンコード方法はプロバイダが決める。 */
  mapDesignValue: string | undefined;
  /** apiKey / accessKey などプロバイダ固有のネイティブ props。 */
  // eslint-disable-next-line typescript/no-explicit-any
  nativeProps?: Record<string, any>;
  /** 既定は共有コントローラ。メソッドを override したいプロバイダだけ差し替える。 */
  createController?: (
    ref: React.RefObject<ViewRef | null>,
    camera: MapCameraPosition
  ) => ReactNativeBridgeMapViewController<ViewRef>;
}

/**
 * RN プロバイダのビューが共有する本体。
 *
 * ネイティブイベントの配線・オーバーレイ収集・InfoBubble レイヤ・attribution は
 * プロバイダに依らず同一なので、ここに集約してある。プロバイダ側のビューは
 * ネイティブコンポーネントとデザイン値の作り方を渡すだけでよい。
 */
export function NativeMapViewHost<
  ViewRef extends NativeViewRef,
  TState extends MapViewStateInterface<MapDesignTypeInterface<unknown>> = MapViewStateInterface<
    MapDesignTypeInterface<unknown>
  >,
>({
  state,
  nativeComponent: NativeMapView,
  mapDesignValue,
  nativeProps,
  createController,
  style,
  onMapLoaded,
  onMapClick,
  onMapLongClick,
  onCameraMoveStart,
  onCameraMove,
  onCameraMoveEnd,
  cameraRestriction,
  markerTilingOptions,
  children,
}: NativeMapViewHostProps<ViewRef, TState>) {
  const nativeRef = useRef<ViewRef | null>(null);
  const scope = useMemo(() => new MapViewScope(), []);
  const registry = useMemo(() => scope.buildRegistry(), [scope]);
  const initialCameraPositionRef = useRef(state.cameraPosition);
  const onMapLoadedRef = useRef(onMapLoaded);
  const onMapClickRef = useRef(onMapClick);
  const onMapLongClickRef = useRef(onMapLongClick);
  const onCameraMoveStartRef = useRef(onCameraMoveStart);
  const onCameraMoveRef = useRef(onCameraMove);
  const onCameraMoveEndRef = useRef(onCameraMoveEnd);
  const [controller] = useState(() =>
    createController
      ? createController(nativeRef, state.cameraPosition)
      : new ReactNativeBridgeMapViewController<ViewRef>(nativeRef, state.cameraPosition)
  );
  const [markerScreenPositions, setMarkerScreenPositions] = useState<MarkerScreenPositionMap>(
    () => new Map()
  );
  const [infoBubblePositions, setInfoBubblePositions] = useState<InfoBubblePositionRequest[]>([]);
  const [isReady, setIsReady] = useState(false);
  // `onMapLoaded` と同じ瞬間を「値」として持つ。イベントを取り逃した後から
  // マウントした子（examples の Three.js overlay 等）も読めるようにするため。
  const [isLoaded, setIsLoaded] = useState(false);
  const [attributionCamera, setAttributionCamera] = useState(() => state.cameraPosition);
  const [infoBubbleScreenPositions, setInfoBubbleScreenPositions] =
    useState<InfoBubbleScreenPositionMap>(() => new Map());

  useCollectAndRenderOverlays(registry, controller);
  // ネイティブ側に範囲制限 API を渡していないため、BaseMapViewController の
  // クランプ方式で効く（android-sdk の HERE/ArcGIS/TomTom と同じ振り分け）。
  useCameraRestriction(controller, { cameraRestriction });
  // state.uiSettings をネイティブのコントローラへ流す（web の MapViewBase 相当）。
  useMapUISettings(state, controller);
  // RN は同期投影を持たない（ネイティブ側で投影する）ことを明示する。
  useNativeCapabilityDeclarations(state);

  useEffect(() => {
    const iconScaleCallback = markerTilingOptions?.iconScaleCallback;
    if (!iconScaleCallback) return;
    const viewId = findNodeHandle(nativeRef.current);
    if (viewId == null) return;
    registerIconScaleCallback(viewId, iconScaleCallback, (markerId) =>
      scope.markerCollector.get(markerId)
    );
    return () => unregisterIconScaleCallback(viewId);
  }, [markerTilingOptions?.iconScaleCallback, scope]);

  useEffect(() => {
    scope.markerCollector.setUpdateHandler((marker) => {
      if (controller.hasMarker(marker)) {
        void controller.updateMarker(marker);
      }
    });
    scope.circleCollector.setUpdateHandler((circle) => {
      if (controller.hasCircle(circle)) {
        void controller.updateCircle(circle);
      }
    });
    scope.groundImageCollector.setUpdateHandler((groundImage) => {
      if (controller.hasGroundImage(groundImage)) {
        void controller.updateGroundImage(groundImage);
      }
    });
    scope.polylineCollector.setUpdateHandler((polyline) => {
      if (controller.hasPolyline(polyline)) {
        void controller.updatePolyline(polyline);
      }
    });
    scope.polygonCollector.setUpdateHandler((polygon) => {
      if (controller.hasPolygon(polygon)) {
        void controller.updatePolygon(polygon);
      }
    });
    scope.rasterLayerCollector.setUpdateHandler((rasterLayer) => {
      if (controller.hasRasterLayer(rasterLayer)) {
        void controller.updateRasterLayer(rasterLayer);
      }
    });

    return () => {
      scope.markerCollector.setUpdateHandler(null);
      scope.circleCollector.setUpdateHandler(null);
      scope.groundImageCollector.setUpdateHandler(null);
      scope.polylineCollector.setUpdateHandler(null);
      scope.polygonCollector.setUpdateHandler(null);
      scope.rasterLayerCollector.setUpdateHandler(null);
    };
  }, [controller, scope]);

  onMapLoadedRef.current = onMapLoaded;
  onMapClickRef.current = onMapClick;
  onMapLongClickRef.current = onMapLongClick;
  onCameraMoveStartRef.current = onCameraMoveStart;
  onCameraMoveRef.current = onCameraMove;
  onCameraMoveEndRef.current = onCameraMoveEnd;

  useEffect(() => {
    mapViewStateInternal(state).setController(controller);

    controller.setMapInitializedListener(() => {
      setIsLoaded(true);
      onMapLoadedRef.current?.(state);
    });
    controller.setMapClickListener((point) => onMapClickRef.current?.(point));
    controller.setMapLongClickListener((point) => onMapLongClickRef.current?.(point));
    controller.setCameraMoveStartListener((camera) => {
      mapViewStateInternal(state).updateCameraPosition(camera);
      onCameraMoveStartRef.current?.(camera);
    });
    controller.setCameraMoveListener((camera) => {
      mapViewStateInternal(state).updateCameraPosition(camera);
      onCameraMoveRef.current?.(camera);
    });
    controller.setCameraMoveEndListener((camera) => {
      mapViewStateInternal(state).updateCameraPosition(camera);
      onCameraMoveEndRef.current?.(camera);
    });

    return () => {
      mapViewStateInternal(state).setController(null);
      controller.destroy();
    };
  }, [controller, state]);


  // マーカー描画 capability をこのマップのサービスレジストリへ登録する。
  // marker-clustering などの拡張がここから解決する
  // （android-sdk の *MapView.kt / ios-sdk の *MapView.swift が
  //  MarkerRenderingSupportKey を put するのと同じ位置づけ）。
  useMarkerRenderingSupport(state, scope, controller);

  return (
    <MapContext.Provider value={createMapContextValue({ controller, isReady, isLoaded, state: state ?? null })}>
      <MapServiceRegistryProvider registry={state?.serviceRegistry}>
        <MapViewScopeProvider scope={scope}>
          <View style={style ?? { flex: 1 }}>
            <NativeMapView
              ref={nativeRef}
              {...nativeProps}
              style={StyleSheet.absoluteFill}
              cameraPosition={toNativeCameraPosition(initialCameraPositionRef.current)}
              mapDesignType={mapDesignValue}
              markerTilingOptions={toNativeMarkerTilingOptions(markerTilingOptions)}
              infoBubblePositions={infoBubblePositions}
              onMapLoaded={() => {
                setIsReady(true);
                controller.onNativeMapLoaded();
              }}
              onMarkerCompositionBatchProcessed={(event) =>
                controller.onNativeMarkerCompositionBatchProcessed(
                  event.nativeEvent.generation,
                  event.nativeEvent.sequence
                )
              }
              onMapClick={(event) => controller.onNativeMapClick(GeoPoint.from(event.nativeEvent.point))}
              onMapLongClick={(event) =>
                controller.onNativeMapLongClick(GeoPoint.from(event.nativeEvent.point))
              }
              onCameraMoveStart={(event) => {
                const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
                setAttributionCamera(camera);
                controller.onNativeCameraMoveStart(camera);
              }}
              onCameraMove={(event) => {
                const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
                setAttributionCamera(camera);
                controller.onNativeCameraMove(camera);
              }}
              onCameraMoveEnd={(event) => {
                const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
                setAttributionCamera(camera);
                controller.onNativeCameraMoveEnd(camera);
              }}
              onMarkerClick={(event) => controller.onNativeMarkerClick(event.nativeEvent.markerId)}
              onCircleClick={(event) =>
                controller.onNativeCircleClick(
                  event.nativeEvent.circleId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onGroundImageClick={(event) =>
                controller?.onNativeGroundImageClick(
                  event.nativeEvent.groundImageId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onPolylineClick={(event) =>
                controller.onNativePolylineClick(
                  event.nativeEvent.polylineId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onPolygonClick={(event) =>
                controller.onNativePolygonClick(
                  event.nativeEvent.polygonId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onMarkerDragStart={(event) =>
                controller.onNativeMarkerDragStart(
                  event.nativeEvent.markerId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onMarkerDrag={(event) =>
                controller.onNativeMarkerDrag(
                  event.nativeEvent.markerId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onMarkerDragEnd={(event) =>
                controller.onNativeMarkerDragEnd(
                  event.nativeEvent.markerId,
                  GeoPoint.from(event.nativeEvent.point)
                )
              }
              onMarkerAnimateStart={(event) =>
                controller.onNativeMarkerAnimateStart(event.nativeEvent.markerId)
              }
              onMarkerAnimateEnd={(event) =>
                controller.onNativeMarkerAnimateEnd(event.nativeEvent.markerId)
              }
              onMarkerScreenPositions={(event) => {
                const positions = event.nativeEvent.positions;
                setMarkerScreenPositions((previous) => {
                  // Keeping the previous (empty) Map lets React bail out of the
                  // re-render that an identical-but-new Map would trigger.
                  if (previous.size === 0 && positions.length === 0) return previous;
                  return new Map(
                    positions.map((position) => [position.markerId, { x: position.x, y: position.y }])
                  );
                });
              }}
              onInfoBubbleScreenPositions={(event) => {
                const positions = event.nativeEvent.positions;
                setInfoBubbleScreenPositions((previous) => {
                  if (previous.size === 0 && positions.length === 0) return previous;
                  return new Map(
                    positions.map((position) => [position.id, { x: position.x, y: position.y }])
                  );
                });
              }}
              onNativeMapExtensionEvent={(event) =>
                controller?.onNativeMapExtensionEvent(event.nativeEvent)
              }
            />
            <InfoBubbleLayer
              scope={scope}
              markerScreenPositions={markerScreenPositions}
              infoBubbleScreenPositions={infoBubbleScreenPositions}
              onPositionRequestsChange={setInfoBubblePositions}
            />
            <MapAttributionOverlay
              scope={scope}
              camera={attributionCamera}
              designAttributionRules={state.mapDesignType.attributionRules}
            />
            {children}
          </View>
        </MapViewScopeProvider>
      </MapServiceRegistryProvider>
    </MapContext.Provider>
  );
}
