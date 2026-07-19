#import "MarkerScaleBridge.h"
#import "MarkerScaleBridgeCore.hpp"

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>
#import <ReactCommon/RCTTurboModuleWithJSIBindings.h>

#include <cmath>

using facebook::react::CallInvoker;

// Conforming to RCTTurboModule is what routes this module through RCTTurboModuleManager's
// TurboModule path; only that path invokes installJSIBindingsWithRuntime:callInvoker:.
// Without it the module is treated as a legacy module and the JSI bindings (and thus
// iconScaleCallback resolution) are never installed.
@interface MCMarkerScaleBridgeModule : NSObject <RCTBridgeModule, RCTTurboModule, RCTTurboModuleWithJSIBindings>
@end

@implementation MCMarkerScaleBridgeModule

RCT_EXPORT_MODULE(MapConductorMarkerScaleBridge)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::ObjCTurboModule>(params);
}

- (void)installJSIBindingsWithRuntime:(facebook::jsi::Runtime &)runtime
                          callInvoker:(const std::shared_ptr<CallInvoker> &)callInvoker
{
  mapconductor::MarkerScaleBridgeCore::instance().install(runtime, callInvoker);
}

- (void)invalidate
{
  mapconductor::MarkerScaleBridgeCore::instance().invalidate();
}

@end

@implementation MCMarkerScaleBridge

+ (double)requestScaleWithViewId:(NSInteger)viewId markerId:(NSString *)markerId zoom:(NSInteger)zoom
{
  const double scale = mapconductor::MarkerScaleBridgeCore::instance().requestScale(
      (int)viewId, markerId.UTF8String ?: "", (int)zoom, 250.0);
  return std::isnan(scale) ? 1.0 : scale;
}

+ (void)invalidateViewId:(NSInteger)viewId
{
  mapconductor::MarkerScaleBridgeCore::instance().invalidateViewCache((int)viewId);
}

+ (void)removeViewId:(NSInteger)viewId
{
  mapconductor::MarkerScaleBridgeCore::instance().removeView((int)viewId);
}

@end
