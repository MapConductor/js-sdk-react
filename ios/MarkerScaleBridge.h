#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Synchronous native entry point used by Core's background tile renderer.
@interface MCMarkerScaleBridge : NSObject

+ (double)requestScaleWithViewId:(NSInteger)viewId
                         markerId:(NSString *)markerId
                             zoom:(NSInteger)zoom
    NS_SWIFT_NAME(requestScale(viewId:markerId:zoom:));

+ (void)invalidateViewId:(NSInteger)viewId NS_SWIFT_NAME(invalidate(viewId:));
+ (void)removeViewId:(NSInteger)viewId NS_SWIFT_NAME(remove(viewId:));

@end

NS_ASSUME_NONNULL_END
