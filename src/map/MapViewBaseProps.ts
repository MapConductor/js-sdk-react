import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import type {
  GeoPoint,
  MapCameraPosition,
  MapDesignTypeInterface,
  MapViewStateInterface,
} from '@mapconductor/js-sdk-core';

export type OnMapLoadedHandler<TState> = (state: TState) => void;
export type OnMapEventHandler = (point: GeoPoint) => void;
export type OnCameraMoveHandler = (camera: MapCameraPosition) => void;

export interface MapViewBaseProps<
  TState extends MapViewStateInterface<MapDesignTypeInterface<unknown>>,
> {
  state: TState;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onMapLoaded?: OnMapLoadedHandler<TState>;
  onMapClick?: OnMapEventHandler;
  onMapLongClick?: OnMapEventHandler;
  onCameraMoveStart?: OnCameraMoveHandler;
  onCameraMove?: OnCameraMoveHandler;
  onCameraMoveEnd?: OnCameraMoveHandler;
}
