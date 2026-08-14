#import "MCReactNativeMapViewManager.h"

#import <React/RCTBridge.h>
#import <React/RCTUIManager.h>

#pragma mark - Container

@implementation MCReactNativeMapContainerView

- (instancetype)initWithMapViewClassName:(NSString *)className
{
  if ((self = [super initWithFrame:CGRectZero])) {
    Class cls = NSClassFromString(className);
    NSAssert(cls != Nil, @"%@ is not linked (provider pod missing?)", className);
    _mapView = [[cls alloc] initWithFrame:CGRectZero];
    [self addSubview:_mapView];
    __weak __typeof(self) weakSelf = self;
    _mapView.eventHandler = ^(NSString *name, NSDictionary *body) {
      [weakSelf emitEventNamed:name body:body];
    };
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  self.mapView.frame = self.bounds;
}

- (void)emitEventNamed:(NSString *)name body:(NSDictionary *)body
{
  // JS の prop 名と 1:1。増やすときは js-sdk-react の NativeMapViewProps も対で直すこと。
  static NSDictionary<NSString *, NSString *> *keyPaths;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    keyPaths = @{
      @"mapLoaded" : @"onMapLoaded",
      @"markerCompositionBatchProcessed" : @"onMarkerCompositionBatchProcessed",
      @"mapClick" : @"onMapClick",
      @"mapLongClick" : @"onMapLongClick",
      @"cameraMoveStart" : @"onCameraMoveStart",
      @"cameraMove" : @"onCameraMove",
      @"cameraMoveEnd" : @"onCameraMoveEnd",
      @"markerClick" : @"onMarkerClick",
      @"circleClick" : @"onCircleClick",
      @"groundImageClick" : @"onGroundImageClick",
      @"polylineClick" : @"onPolylineClick",
      @"polygonClick" : @"onPolygonClick",
      @"markerDragStart" : @"onMarkerDragStart",
      @"markerDrag" : @"onMarkerDrag",
      @"markerDragEnd" : @"onMarkerDragEnd",
      @"markerAnimateStart" : @"onMarkerAnimateStart",
      @"markerAnimateEnd" : @"onMarkerAnimateEnd",
      @"markerScreenPositions" : @"onMarkerScreenPositions",
      @"infoBubbleScreenPositions" : @"onInfoBubbleScreenPositions",
      @"nativeMapExtensionEvent" : @"onNativeMapExtensionEvent",
    };
  });

  NSString *keyPath = keyPaths[name];
  if (keyPath == nil) return;
  RCTDirectEventBlock block = [self valueForKey:keyPath];
  if (block) block(body);
}

@end

#pragma mark - Manager

@implementation MCReactNativeMapViewManagerBase

- (NSString *)mapViewClassName
{
  [NSException raise:NSInternalInconsistencyException
              format:@"%@ must override -mapViewClassName", NSStringFromClass([self class])];
  return @"";
}

- (UIView *)view
{
  return [[MCReactNativeMapContainerView alloc] initWithMapViewClassName:[self mapViewClassName]];
}

- (void)withMapView:(nonnull NSNumber *)tag
              block:(void (^)(UIView<MCReactNativeMapViewBridge> *))block
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *manager,
                                      NSDictionary<NSNumber *, UIView *> *registry) {
    UIView *view = registry[tag];
    if ([view isKindOfClass:[MCReactNativeMapContainerView class]]) {
      block(((MCReactNativeMapContainerView *)view).mapView);
    }
  }];
}

@end

void MCReactNativeRegisterLegacyViewManagerInterop(NSString *componentName)
{
  Class cls = NSClassFromString(@"RCTLegacyViewManagerInteropComponentView");
  SEL selector = NSSelectorFromString(@"supportLegacyViewManagerWithName:");
  if (cls && [cls respondsToSelector:selector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    [cls performSelector:selector withObject:componentName];
#pragma clang diagnostic pop
  }
}
