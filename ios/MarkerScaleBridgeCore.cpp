#include "MarkerScaleBridgeCore.hpp"

#include <chrono>
#include <cmath>
#include <future>
#include <limits>

using facebook::jsi::Function;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::String;
using facebook::jsi::Value;
using facebook::react::CallInvoker;

namespace mapconductor {

MarkerScaleBridgeCore &MarkerScaleBridgeCore::instance() {
  static MarkerScaleBridgeCore bridge;
  return bridge;
}

void MarkerScaleBridgeCore::install(
    Runtime &runtime,
    std::shared_ptr<CallInvoker> callInvoker) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    runtime_ = &runtime;
    callInvoker_ = std::move(callInvoker);
    callbacks_.clear();
    cache_.clear();
  }

  auto registerFn = Function::createFromHostFunction(
      runtime,
      PropNameID::forAscii(runtime, "__mapconductorRegisterIconScaleCallback"),
      2,
      [this](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
        if (count < 2 || !args[0].isNumber() || !args[1].isObject() ||
            !args[1].getObject(rt).isFunction(rt)) {
          return Value::undefined();
        }
        const int viewId = static_cast<int>(args[0].getNumber());
        auto callback = std::make_shared<Function>(args[1].getObject(rt).getFunction(rt));
        std::lock_guard<std::mutex> lock(mutex_);
        callbacks_[viewId] = std::move(callback);
        const std::string prefix = std::to_string(viewId) + " ";
        for (auto it = cache_.begin(); it != cache_.end();) {
          it = it->first.rfind(prefix, 0) == 0 ? cache_.erase(it) : std::next(it);
        }
        return Value::undefined();
      });
  runtime.global().setProperty(runtime, "__mapconductorRegisterIconScaleCallback", registerFn);

  auto unregisterFn = Function::createFromHostFunction(
      runtime,
      PropNameID::forAscii(runtime, "__mapconductorUnregisterIconScaleCallback"),
      1,
      [this](Runtime &, const Value &, const Value *args, size_t count) -> Value {
        if (count >= 1 && args[0].isNumber()) {
          removeView(static_cast<int>(args[0].getNumber()));
        }
        return Value::undefined();
      });
  runtime.global().setProperty(runtime, "__mapconductorUnregisterIconScaleCallback", unregisterFn);
}

void MarkerScaleBridgeCore::invalidate() {
  std::lock_guard<std::mutex> lock(mutex_);
  runtime_ = nullptr;
  callInvoker_.reset();
  callbacks_.clear();
  cache_.clear();
}

void MarkerScaleBridgeCore::invalidateViewCache(int viewId) {
  std::lock_guard<std::mutex> lock(mutex_);
  const std::string prefix = std::to_string(viewId) + " ";
  for (auto it = cache_.begin(); it != cache_.end();) {
    it = it->first.rfind(prefix, 0) == 0 ? cache_.erase(it) : std::next(it);
  }
}

void MarkerScaleBridgeCore::removeView(int viewId) {
  std::lock_guard<std::mutex> lock(mutex_);
  callbacks_.erase(viewId);
  const std::string prefix = std::to_string(viewId) + " ";
  for (auto it = cache_.begin(); it != cache_.end();) {
    it = it->first.rfind(prefix, 0) == 0 ? cache_.erase(it) : std::next(it);
  }
}

std::string MarkerScaleBridgeCore::cacheKey(
    int viewId,
    const std::string &markerId,
    int zoom) const {
  return std::to_string(viewId) + " " + markerId + " " + std::to_string(zoom);
}

double MarkerScaleBridgeCore::requestScale(
    int viewId,
    const std::string &markerId,
    int zoom,
    double timeoutMs) {
  const std::string key = cacheKey(viewId, markerId, zoom);
  std::shared_ptr<CallInvoker> callInvoker;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    auto cached = cache_.find(key);
    if (cached != cache_.end()) return cached->second;
    callInvoker = callInvoker_;
  }

  const double notReady = std::numeric_limits<double>::quiet_NaN();
  if (!callInvoker) return notReady;

  auto promise = std::make_shared<std::promise<double>>();
  auto future = promise->get_future();
  callInvoker->invokeAsync([this, promise, viewId, markerId, zoom, notReady]() {
    double scale = notReady;
    try {
      std::shared_ptr<Function> callback;
      Runtime *runtime = nullptr;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        runtime = runtime_;
        auto found = callbacks_.find(viewId);
        if (found != callbacks_.end()) callback = found->second;
      }
      if (callback && runtime) {
        Value result = callback->call(
            *runtime,
            String::createFromUtf8(*runtime, markerId),
            static_cast<double>(zoom));
        if (result.isNumber()) scale = result.getNumber();
      }
    } catch (...) {
      scale = notReady;
    }
    promise->set_value(scale);
  });

  if (future.wait_for(std::chrono::duration<double, std::milli>(timeoutMs)) !=
      std::future_status::ready) {
    return notReady;
  }
  const double scale = future.get();
  if (!std::isnan(scale)) {
    std::lock_guard<std::mutex> lock(mutex_);
    cache_[key] = scale;
  }
  return scale;
}

} // namespace mapconductor
