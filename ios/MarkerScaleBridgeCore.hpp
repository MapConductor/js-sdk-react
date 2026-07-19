#pragma once

#include <ReactCommon/CallInvoker.h>
#include <jsi/jsi.h>

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace mapconductor {

class MarkerScaleBridgeCore {
 public:
  static MarkerScaleBridgeCore &instance();

  void install(
      facebook::jsi::Runtime &runtime,
      std::shared_ptr<facebook::react::CallInvoker> callInvoker);
  void invalidate();
  void invalidateViewCache(int viewId);
  void removeView(int viewId);
  double requestScale(int viewId, const std::string &markerId, int zoom, double timeoutMs);

 private:
  MarkerScaleBridgeCore() = default;

  std::string cacheKey(int viewId, const std::string &markerId, int zoom) const;

  std::mutex mutex_;
  facebook::jsi::Runtime *runtime_ = nullptr;
  std::shared_ptr<facebook::react::CallInvoker> callInvoker_;
  std::unordered_map<int, std::shared_ptr<facebook::jsi::Function>> callbacks_;
  std::unordered_map<std::string, double> cache_;
};

} // namespace mapconductor
