#pragma once

#include <ReactCommon/CallInvoker.h>
#include <jsi/jsi.h>

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace mapconductor {

/**
 * Lets native marker-tiling code (Kotlin) synchronously obtain an icon scale
 * from the JS-defined `iconScaleCallback` while rendering tiles on a
 * background thread. JS can only run on the JS thread, so `requestScale`
 * schedules the actual call via CallInvoker and blocks the caller on a
 * future with a timeout fallback of 1.0 (no-op scale).
 */
class MarkerScaleBridge {
 public:
  static MarkerScaleBridge &instance();

  void install(
      facebook::jsi::Runtime &runtime,
      std::shared_ptr<facebook::react::CallInvoker> callInvoker);

  /** Called when the JS runtime is torn down (e.g. Fast Refresh/reload). */
  void invalidate();

  /**
   * May be called from any thread. Blocks the calling thread until the JS
   * callback resolves or `timeoutMs` elapses.
   */
  double requestScale(
      int viewId,
      const std::string &markerId,
      int zoom,
      double timeoutMs);

 private:
  MarkerScaleBridge() = default;

  std::mutex mutex_;
  facebook::jsi::Runtime *runtime_ = nullptr;
  std::shared_ptr<facebook::react::CallInvoker> callInvoker_;
  std::unordered_map<int, std::shared_ptr<facebook::jsi::Function>> callbacks_;
};

} // namespace mapconductor
