export { M as MapContext, a as MapContextInternal, b as MapContextValue, c as MapServiceRegistryProvider, d as createMapContextValue, m as mapContextInternal, u as useMapLoaded, e as useMapServiceRegistry } from './MapServiceRegistryContext-CJDejYDF.js';
import { M as MapViewScope } from './MapViewScope-C_ngc8n9.js';
export { a as MapViewScopeProvider } from './MapViewScope-C_ngc8n9.js';
import * as React from 'react';
import React__default, { CSSProperties, ReactNode } from 'react';
import { MarkerState, GeoPoint, MarkerIcon, MarkerAnimation, Serializable, OnMarkerEventHandler, CircleState, OnCircleEventHandler, PolygonState, OnPolygonEventHandler, GeoRectBounds, PolylineState, OnPolylineEventHandler, GroundImageState, OnGroundImageEventHandler, RasterLayerState, RasterLayerSource, MapCameraPosition, AttributionRule, Offset, MarkerAnimationOverlayEntry } from '@mapconductor/js-sdk-core';
export { I as InfoBubbleEntry, M as MarkerAnimationStore } from './MarkerAnimationStore-Dm7KU-2L.js';

interface MarkerStateProps {
    state: MarkerState;
    position?: never;
}
interface MarkersProps {
    states: MarkerState[];
}
/**
 * Efficiently registers many markers without per-marker effects.
 * Mirrors `MarkerCompose.kt#Markers(states)`.
 */
declare function Markers({ states }: MarkersProps): null;
interface MarkerPositionProps {
    state?: never;
    position: GeoPoint;
    id?: string | null;
    zIndex?: number | null;
    clickable?: boolean;
    draggable?: boolean;
    icon?: MarkerIcon | null;
    animation?: MarkerAnimation | null;
    extra?: Serializable | null;
    onClick?: OnMarkerEventHandler | null;
    onDragStart?: OnMarkerEventHandler | null;
    onDrag?: OnMarkerEventHandler | null;
    onDragEnd?: OnMarkerEventHandler | null;
    onAnimateStart?: OnMarkerEventHandler | null;
    onAnimateEnd?: OnMarkerEventHandler | null;
}
type MarkerProps = MarkerStateProps | MarkerPositionProps;
/**
 * Registers a single marker. Mirrors `MarkerCompose.kt#Marker(state)` and
 * `MarkerCompose.kt#Marker(position, ...)`.
 */
declare function Marker(props: MarkerStateProps): null;
declare function Marker(props: MarkerPositionProps): React__default.ReactElement | null;

interface CircleStateProps {
    state: CircleState;
    center?: never;
    radiusMeters?: never;
}
interface CirclePositionProps {
    state?: never;
    center: GeoPoint;
    radiusMeters: number;
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    zIndex?: number | null;
    geodesic?: boolean;
    clickable?: boolean;
    extra?: Serializable | null;
    onClick?: OnCircleEventHandler | null;
}
type CircleProps = CircleStateProps | CirclePositionProps;
/**
 * Registers a single circle. Mirrors `CircleCompose.kt#Circle(state)` and
 * `CircleCompose.kt#Circle(center, ...)`.
 */
declare function Circle(props: CircleStateProps): null;
declare function Circle(props: CirclePositionProps): React__default.ReactElement | null;

interface PolygonStateProps {
    state: PolygonState;
    points?: never;
    bounds?: never;
}
interface PolygonCommonProps {
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    geodesic?: boolean;
    clickable?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolygonEventHandler | null;
}
interface PolygonPointsProps extends PolygonCommonProps {
    state?: never;
    points: GeoPoint[];
    holes?: GeoPoint[][];
    bounds?: never;
}
interface PolygonBoundsProps extends PolygonCommonProps {
    state?: never;
    points?: never;
    holes?: never;
    bounds: GeoRectBounds;
}
type PolygonProps = PolygonStateProps | PolygonPointsProps | PolygonBoundsProps;
/**
 * Registers a single polygon. Mirrors `PolygonComponent.kt#Polygon(state)`,
 * `PolygonComponent.kt#Polygon(points, ...)`, and
 * `PolygonComponent.kt#Polygon(bounds, ...)`.
 */
declare function Polygon(props: PolygonStateProps): null;
declare function Polygon(props: PolygonPointsProps): React__default.ReactElement | null;
declare function Polygon(props: PolygonBoundsProps): React__default.ReactElement | null;

interface PolylineStateProps {
    state: PolylineState;
    points?: never;
    bounds?: never;
}
interface PolylineCommonProps {
    id?: string | null;
    strokeColor?: string;
    strokeWidth?: number;
    geodesic?: boolean;
    clickable?: boolean;
    zIndex?: number;
    extra?: Serializable | null;
    onClick?: OnPolylineEventHandler | null;
}
interface PolylinePointsProps extends PolylineCommonProps {
    state?: never;
    points: GeoPoint[];
    bounds?: never;
}
interface PolylineBoundsProps extends PolylineCommonProps {
    state?: never;
    points?: never;
    bounds: GeoRectBounds;
}
type PolylineProps = PolylineStateProps | PolylinePointsProps | PolylineBoundsProps;
/**
 * Registers a single polyline. Mirrors `PolylineComponent.kt#Polyline(state)`,
 * `PolylineComponent.kt#Polyline(points, ...)`, and
 * `PolylineComponent.kt#Polyline(bounds, ...)`.
 */
declare function Polyline(props: PolylineStateProps): null;
declare function Polyline(props: PolylinePointsProps): React__default.ReactElement | null;
declare function Polyline(props: PolylineBoundsProps): React__default.ReactElement | null;

interface GroundImageStateProps {
    state: GroundImageState;
    bounds?: never;
    imageUrl?: never;
}
interface GroundImageBoundsProps {
    state?: never;
    bounds: GeoRectBounds;
    imageUrl: string;
    opacity?: number;
    tileSize?: number;
    clickable?: boolean;
    id?: string | null;
    extra?: Serializable | null;
    onClick?: OnGroundImageEventHandler | null;
}
/**
 * Registers a ground image overlay. Mirrors
 * `GroundImageComponent.kt#GroundImage(state)` and
 * `GroundImageComponent.kt#GroundImage(bounds, image, ...)` (web port uses imageUrl instead of Drawable).
 */
type GroundImageProps = GroundImageStateProps | GroundImageBoundsProps;
declare function GroundImage(props: GroundImageStateProps): null;
declare function GroundImage(props: GroundImageBoundsProps): React__default.ReactElement | null;

interface RasterLayerStateProps {
    state: RasterLayerState;
    source?: never;
}
interface RasterLayerSourceProps {
    state?: never;
    source: RasterLayerSource;
    opacity?: number;
    visible?: boolean;
    zIndex?: number;
    userAgent?: string;
    id?: string | null;
    extraHeaders?: Record<string, string> | null;
    debug?: boolean;
}
/**
 * Registers a raster tile layer. Mirrors `RasterLayerComponent.kt#RasterLayer(state)`
 * and `RasterLayerComponent.kt#RasterLayer(source, ...)`.
 */
type RasterLayerProps = RasterLayerStateProps | RasterLayerSourceProps;
declare function RasterLayer(props: RasterLayerStateProps): null;
declare function RasterLayer(props: RasterLayerSourceProps): React__default.ReactElement | null;

interface MapAttributionOverlayProps {
    scope: MapViewScope;
    camera: MapCameraPosition;
    designAttributionRules?: readonly AttributionRule[];
    style?: CSSProperties;
}
declare function MapAttributionOverlay({ scope, camera, designAttributionRules, style, }: MapAttributionOverlayProps): React.JSX.Element | null;

/**
 * How the bubble looks. Each one left out falls back to its `--mc-bubble-*`
 * custom property, so it can be set from CSS instead; one given here wins over
 * the CSS. Lengths are px.
 */
interface InfoBubbleStyleProps {
    bubbleColor?: string;
    borderColor?: string;
    /** 枠線の太さ(px)。android の borderWidth / ios の borderWidth と同一契約。 */
    borderWidth?: number;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
    /**
     * Web only. Added to the bubble's element, next to `mc-info-bubble`. The
     * children sit directly inside it, so `.my-bubble h1` reaches them and
     * `color` set on the class is inherited.
     */
    className?: string;
    children: ReactNode;
}
interface InfoBubbleMarkerProps extends InfoBubbleStyleProps {
    /** Anchor the bubble to a marker (tracks the marker's position/icon). */
    marker: MarkerState;
    position?: never;
}
interface InfoBubblePositionProps extends InfoBubbleStyleProps {
    marker?: never;
    /** Anchor the bubble to an arbitrary geo position. */
    position: GeoPoint;
}
/**
 * Props for {@link InfoBubble}: pass exactly one of `marker` or `position`.
 * The two forms mirror Compose/iOS's overloaded `InfoBubble(marker:)` /
 * `InfoBubble(position:)`.
 */
type InfoBubbleProps = InfoBubbleMarkerProps | InfoBubblePositionProps;
/**
 * Draws a styled speech-bubble anchored to either a marker (`marker` prop) or an
 * arbitrary geo position (`position` prop). Mirrors the overloaded
 * `InfoBubbleCompose.kt#InfoBubble(marker, ...)` / `InfoBubble(position, ...)`.
 */
declare function InfoBubble(props: InfoBubbleProps): null;
interface InfoBubbleCustomProps {
    marker: MarkerState;
    tailOffset: Offset;
    /**
     * Web only. Put on the element that holds the children, as
     * `mc-info-bubble-custom <className>`. The SDK gives that element no look of
     * its own; it is there so the content can be styled from one class.
     */
    className?: string;
    children: ReactNode;
}
/** Registers a fully custom bubble content. Mirrors `InfoBubbleCompose.kt#InfoBubbleCustom`. */
declare function InfoBubbleCustom({ marker, tailOffset, className, children }: InfoBubbleCustomProps): null;

interface InfoBubbleOverlayProps {
    /** Screen pixel offset of the anchor point (marker position projected to screen). */
    positionOffset: Offset;
    /** Pixel size of the associated icon. */
    iconSize: {
        width: number;
        height: number;
    };
    /** Normalised anchor point within the icon that aligns to the map position (0–1). */
    iconOffset: Offset;
    /** Normalised point within the icon that the info bubble connects to (0–1). */
    infoAnchorOffset: Offset;
    /** Normalised connection point within the bubble content (0–1). */
    tailOffset: Offset;
    children: ReactNode;
    style?: CSSProperties;
}
/**
 * Positions its children at the correct screen coordinates relative to a map marker.
 * Mirrors `InfoBubbleOverlay` from `InfoWindowOverlay.kt`.
 */

interface InfoBubbleStyleValues {
    bubbleColor?: string;
    borderColor?: string;
    borderWidth?: number;
    contentPadding?: number;
    cornerRadius?: number;
    tailSize?: number;
}

interface DrawInfoBubbleProps extends InfoBubbleStyleValues {
    /** Added to the bubble's class list, next to `mc-info-bubble`. */
    className?: string;
    children: ReactNode;
}
/**
 * The bubble itself: one div, its tail drawn by `::before` and `::after`.
 *
 * No style attribute anywhere, so an app's stylesheet reaches every part of it.
 * The look comes from `--mc-bubble-*` custom properties (see infoBubbleStyles);
 * a prop that is given wins over them, one that is left out leaves them in
 * charge. The children sit directly inside, so `.my-bubble h1` and
 * `.my-bubble > h1` both reach them and `color` set on the class is inherited.
 *
 * The tail hangs below the box, inside its bottom margin, so the element's
 * outer box ends at the tail's tip — which is where InfoBubbleOverlay puts the
 * anchor.
 */
declare function DrawInfoBubble({ className, children, ...values }: DrawInfoBubbleProps): React.JSX.Element;

type ResolveScreenOffset = (entry: MarkerAnimationOverlayEntry) => Offset | null | Promise<Offset | null>;
/**
 * Screen-space marker-animation overlay: a sibling layer sandwiched between
 * the native map view and InfoBubbles (same DOM position both render into).
 * Renders nothing while no animation is in flight.
 */
declare function MarkerAnimationLayer({ entries, resolveScreenOffset, }: {
    entries: MarkerAnimationOverlayEntry[];
    resolveScreenOffset: ResolveScreenOffset;
}): React.JSX.Element | null;

export { Circle, DrawInfoBubble, GroundImage, InfoBubble, InfoBubbleCustom, InfoBubbleOverlay, MapAttributionOverlay, MapViewScope, Marker, MarkerAnimationLayer, Markers, Polygon, Polyline, RasterLayer };
export type { CirclePositionProps, CircleProps, CircleStateProps, GroundImageBoundsProps, GroundImageProps, GroundImageStateProps, InfoBubbleProps, MapAttributionOverlayProps, MarkerPositionProps, MarkerProps, MarkerStateProps, PolygonBoundsProps, PolygonPointsProps, PolygonProps, PolygonStateProps, PolylineBoundsProps, PolylinePointsProps, PolylineProps, PolylineStateProps, RasterLayerProps, RasterLayerSourceProps, RasterLayerStateProps };
