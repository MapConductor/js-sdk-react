#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * Swift 側の地図ビュー（`MCReactNativeMapViewBase` の派生）が ObjC へ見せている口。
 *
 * Swift クラスはプロバイダの pod にあり、この pod からは名前でしか解決できないため
 * （`NSClassFromString`）、型はこのプロトコルで与える。
 */
@protocol MCReactNativeMapViewBridge <NSObject>
@property(nonatomic, copy, nullable) void (^eventHandler)(NSString *, NSDictionary *);
- (void)setCameraPosition:(NSDictionary *)payload;
- (void)setMapDesignType:(nullable NSString *)value;
- (void)setMarkerTilingOptions:(nullable NSDictionary *)payload viewId:(NSInteger)viewId;
- (void)setInfoBubblePositions:(NSArray *)positions;
- (void)moveCamera:(NSDictionary *)payload duration:(double)duration;
- (void)fitBounds:(NSDictionary *)bounds padding:(NSInteger)padding;
- (void)clearOverlays;
- (void)applyUISettings:(NSDictionary *)payload;
- (void)beginMarkerComposition:(NSInteger)generation icons:(NSArray *)icons;
- (void)appendMarkerComposition:(NSInteger)generation sequence:(NSInteger)sequence payload:(NSDictionary *)payload;
- (void)commitMarkerComposition:(NSInteger)generation;
- (void)updateMarker:(NSDictionary *)payload;
- (void)compositionCircles:(NSArray *)payload;
- (void)updateCircle:(NSDictionary *)payload;
- (void)compositionGroundImages:(NSArray *)payload;
- (void)updateGroundImage:(NSDictionary *)payload;
- (void)compositionPolygons:(NSArray *)payload;
- (void)updatePolygon:(NSDictionary *)payload;
- (void)compositionPolylines:(NSArray *)payload;
- (void)updatePolyline:(NSDictionary *)payload;
- (void)compositionRasterLayers:(NSArray *)payload;
- (void)updateRasterLayer:(NSDictionary *)payload;
- (void)upsertNativeMapExtension:(NSString *)extensionId type:(NSString *)type payload:(NSDictionary *)payload;
- (void)removeNativeMapExtension:(NSString *)extensionId;
@end

/**
 * RN のビュー階層に載る入れ物。Swift の地図ビューを 1 枚だけ抱えて、
 * ネイティブから上がったイベントを RN の `RCTDirectEventBlock` へ振り分ける。
 *
 * イベント名と prop 名の対応は JS 側の `NativeMapViewProps` と対になる。
 */
@interface MCReactNativeMapContainerView : UIView

/// 実体は `NSClassFromString` で解決した Swift の地図ビュー。
@property(nonatomic, strong, readonly) UIView<MCReactNativeMapViewBridge> *mapView;

@property(nonatomic, copy, nullable) RCTDirectEventBlock onMapLoaded;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerCompositionBatchProcessed;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMapClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMapLongClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onCameraMoveStart;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onCameraMove;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onCameraMoveEnd;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onCircleClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onGroundImageClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onPolylineClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onPolygonClick;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerDragStart;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerDrag;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerDragEnd;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerAnimateStart;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerAnimateEnd;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onMarkerScreenPositions;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onInfoBubbleScreenPositions;
@property(nonatomic, copy, nullable) RCTDirectEventBlock onNativeMapExtensionEvent;

/// @param className Swift 側の `@objc(...)` 名。例: `@"MCMapLibreReactNativeView"`。
- (instancetype)initWithMapViewClassName:(NSString *)className;

@end

/**
 * RN の ViewManager。**プロバイダ固有の実装はここには無い。**
 *
 * サブクラスが書くのは 3 つだけ:
 *   1. `RCT_EXPORT_MODULE(<JS のコンポーネント名>)`
 *   2. `- (NSString *)mapViewClassName` の override
 *   3. プロバイダ固有の prop（API キー等）があればそれ
 *
 * 加えて `MCReactNativeRegisterLegacyViewManagerInterop()` を
 * `__attribute__((constructor))` から 1 回呼ぶ（理由は同関数のコメント）。
 */
@interface MCReactNativeMapViewManagerBase : RCTViewManager

/// Swift 側の地図ビューのクラス名。サブクラスが必ず override する。
- (NSString *)mapViewClassName;

/// reactTag から Swift の地図ビューを引いて UI スレッドで叩く。
- (void)withMapView:(nonnull NSNumber *)tag
              block:(void (^)(UIView<MCReactNativeMapViewBridge> *mapView))block;

@end

/**
 * 旧アーキテクチャの ViewManager を bridgeless New Architecture から見えるようにする。
 *
 * MapConductor の地図ビューは Codegen した Fabric コンポーネントではないので、
 * この登録が無いと "View config not found for component `XxxMapView`" で落ちる。
 * `RCT_EXPORT_MODULE` が既に `+load` を生やしているため、呼び出し側は
 * `+load` ではなく `__attribute__((constructor))` から呼ぶこと（`+load` の重複定義になる）。
 *
 * 実装は `RCTLegacyViewManagerInteropComponentView` を名前で解決する。直接 import すると
 * この pod が React-RCTFabric の C++/Yoga ヘッダ依存を丸ごと抱えることになるため。
 */


FOUNDATION_EXPORT void MCReactNativeRegisterLegacyViewManagerInterop(NSString *componentName);

/**
 * ViewManager の本体（イベント 20 / prop 4 / コマンド 22 の宣言）。
 * **各プロバイダの `@implementation` の中で 1 回展開すること。**
 *
 * なぜ基底クラスに置けないのか: RN は ViewManager の `Commands` を
 * マネージャ**自身**のメソッド一覧からしか組み立てる（`RCTComponentData` の
 * `viewConfigForViewMangerClass:` は `class_copyMethodList` を 1 回呼ぶだけで
 * 親クラスを辿らない）。基底に置くと prop は JS 側の `baseModuleName` 合流で
 * 効くのにコマンドだけ届かず、「地図は出るがマーカーが出ない」形で表面化する。
 *
 * include するフラグメントにもできないのは、CocoaPods の public header が
 * umbrella header へ取り込まれ、`@implementation` の外で単体コンパイルされるため。
 *
 * 使い方:
 *
 *     @implementation MapConductorXxxViewManager
 *     RCT_EXPORT_MODULE(XxxMapView)
 *     - (NSString *)mapViewClassName { return @"MCXxxReactNativeView"; }
 *     MC_REACT_NATIVE_MAP_VIEW_MANAGER_BODY
 *     @end
 */
// clang-format off
#define MCMapViewBridge UIView<MCReactNativeMapViewBridge> *
#define MC_REACT_NATIVE_MAP_VIEW_MANAGER_BODY \
/* イベント */ \
  RCT_EXPORT_VIEW_PROPERTY(onMapLoaded, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerCompositionBatchProcessed, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMapClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMapLongClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onCameraMoveStart, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onCameraMove, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onCameraMoveEnd, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onCircleClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onGroundImageClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onPolylineClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onPolygonClick, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerDragStart, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerDrag, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerDragEnd, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerAnimateStart, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerAnimateEnd, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onMarkerScreenPositions, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onInfoBubbleScreenPositions, RCTDirectEventBlock) \
  RCT_EXPORT_VIEW_PROPERTY(onNativeMapExtensionEvent, RCTDirectEventBlock) \
/* prop */ \
  RCT_CUSTOM_VIEW_PROPERTY(cameraPosition, NSDictionary, MCReactNativeMapContainerView) { if (json) [view.mapView setCameraPosition:json]; } \
  RCT_CUSTOM_VIEW_PROPERTY(mapDesignType, NSString, MCReactNativeMapContainerView) { [view.mapView setMapDesignType:json]; } \
  RCT_CUSTOM_VIEW_PROPERTY(markerTilingOptions, NSDictionary, MCReactNativeMapContainerView) { [view.mapView setMarkerTilingOptions:json viewId:view.reactTag.integerValue]; } \
  RCT_CUSTOM_VIEW_PROPERTY(infoBubblePositions, NSArray, MCReactNativeMapContainerView) { [view.mapView setInfoBubblePositions:json ?: @[]]; } \
/* コマンド */ \
  RCT_EXPORT_METHOD(clearOverlays:(nonnull NSNumber *)tag) { [self withMapView:tag block:^(MCMapViewBridge v) { [v clearOverlays]; }]; } \
  RCT_EXPORT_METHOD(moveCamera:(nonnull NSNumber *)tag position:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v moveCamera:p duration:0]; }]; } \
  RCT_EXPORT_METHOD(animateCamera:(nonnull NSNumber *)tag position:(nonnull NSDictionary *)p duration:(double)d) { [self withMapView:tag block:^(MCMapViewBridge v) { [v moveCamera:p duration:d]; }]; } \
  RCT_EXPORT_METHOD(fitBounds:(nonnull NSNumber *)tag bounds:(nonnull NSDictionary *)b padding:(NSInteger)pad) { [self withMapView:tag block:^(MCMapViewBridge v) { [v fitBounds:b padding:pad]; }]; } \
  RCT_EXPORT_METHOD(applyUISettings:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v applyUISettings:p]; }]; } \
  RCT_EXPORT_METHOD(beginMarkerComposition:(nonnull NSNumber *)tag generation:(NSInteger)g icons:(nonnull NSArray *)i) { [self withMapView:tag block:^(MCMapViewBridge v) { [v beginMarkerComposition:g icons:i]; }]; } \
  RCT_EXPORT_METHOD(appendMarkerComposition:(nonnull NSNumber *)tag generation:(NSInteger)g sequence:(NSInteger)s payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v appendMarkerComposition:g sequence:s payload:p]; }]; } \
  RCT_EXPORT_METHOD(commitMarkerComposition:(nonnull NSNumber *)tag generation:(NSInteger)g) { [self withMapView:tag block:^(MCMapViewBridge v) { [v commitMarkerComposition:g]; }]; } \
  RCT_EXPORT_METHOD(updateMarker:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updateMarker:p]; }]; } \
  RCT_EXPORT_METHOD(compositionCircles:(nonnull NSNumber *)tag payload:(nonnull NSArray *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v compositionCircles:p]; }]; } \
  RCT_EXPORT_METHOD(compositionGroundImages:(nonnull NSNumber *)tag payload:(nonnull NSArray *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v compositionGroundImages:p]; }]; } \
  RCT_EXPORT_METHOD(compositionPolygons:(nonnull NSNumber *)tag payload:(nonnull NSArray *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v compositionPolygons:p]; }]; } \
  RCT_EXPORT_METHOD(compositionPolylines:(nonnull NSNumber *)tag payload:(nonnull NSArray *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v compositionPolylines:p]; }]; } \
  RCT_EXPORT_METHOD(compositionRasterLayers:(nonnull NSNumber *)tag payload:(nonnull NSArray *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v compositionRasterLayers:p]; }]; } \
  RCT_EXPORT_METHOD(updateCircle:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updateCircle:p]; }]; } \
  RCT_EXPORT_METHOD(updateGroundImage:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updateGroundImage:p]; }]; } \
  RCT_EXPORT_METHOD(updatePolygon:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updatePolygon:p]; }]; } \
  RCT_EXPORT_METHOD(updatePolyline:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updatePolyline:p]; }]; } \
  RCT_EXPORT_METHOD(updateRasterLayer:(nonnull NSNumber *)tag payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v updateRasterLayer:p]; }]; } \
  RCT_EXPORT_METHOD(upsertNativeMapExtension:(nonnull NSNumber *)tag extensionId:(nonnull NSString *)eid type:(nonnull NSString *)t payload:(nonnull NSDictionary *)p) { [self withMapView:tag block:^(MCMapViewBridge v) { [v upsertNativeMapExtension:eid type:t payload:p]; }]; } \
  RCT_EXPORT_METHOD(removeNativeMapExtension:(nonnull NSNumber *)tag extensionId:(nonnull NSString *)eid) { [self withMapView:tag block:^(MCMapViewBridge v) { [v removeNativeMapExtension:eid]; }]; }
// clang-format on

NS_ASSUME_NONNULL_END
