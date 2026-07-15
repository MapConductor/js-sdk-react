#include "MarkerScaleBridge.h"

#include <android/log.h>

#include <chrono>
#include <future>
#include <limits>

#define MSB_LOG(...) __android_log_print(ANDROID_LOG_DEBUG, "MarkerScaleBridge", __VA_ARGS__)

using facebook::jsi::Function;
using facebook::jsi::PropNameID;
using facebook::jsi::Runtime;
using facebook::jsi::String;
using facebook::jsi::Value;
using facebook::react::CallInvoker;

namespace mapconductor {

MarkerScaleBridge &MarkerScaleBridge::instance() {
  static MarkerScaleBridge bridge;
  return bridge;
}

void MarkerScaleBridge::install(
    Runtime &runtime,
    std::shared_ptr<CallInvoker> callInvoker) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    runtime_ = &runtime;
    callInvoker_ = std::move(callInvoker);
    callbacks_.clear();
  }
//  MSB_LOG("install: runtime=%p", (void *)&runtime);

  auto registerFn = Function::createFromHostFunction(
      runtime,
      PropNameID::forAscii(runtime, "__mapconductorRegisterIconScaleCallback"),
      2,
      [this](Runtime &rt, const Value &, const Value *args, size_t count) -> Value {
        if (count < 2 || !args[0].isNumber() || !args[1].isObject() ||
            !args[1].getObject(rt).isFunction(rt)) {
//          MSB_LOG("register: rejected (bad args, count=%zu)", count);
          return Value::undefined();
        }
        int viewId = static_cast<int>(args[0].getNumber());
        auto fn = std::make_shared<Function>(args[1].getObject(rt).getFunction(rt));
        std::lock_guard<std::mutex> lock(mutex_);
        callbacks_[viewId] = fn;
//        MSB_LOG("register: viewId=%d (callbacks now=%zu)", viewId, callbacks_.size());
        return Value::undefined();
      });
  runtime.global().setProperty(runtime, "__mapconductorRegisterIconScaleCallback", registerFn);

  auto unregisterFn = Function::createFromHostFunction(
      runtime,
      PropNameID::forAscii(runtime, "__mapconductorUnregisterIconScaleCallback"),
      1,
      [this](Runtime &, const Value &, const Value *args, size_t count) -> Value {
        if (count < 1 || !args[0].isNumber()) return Value::undefined();
        int viewId = static_cast<int>(args[0].getNumber());
        std::lock_guard<std::mutex> lock(mutex_);
        callbacks_.erase(viewId);
        return Value::undefined();
      });
  runtime.global().setProperty(
      runtime, "__mapconductorUnregisterIconScaleCallback", unregisterFn);
}

void MarkerScaleBridge::invalidate() {
  std::lock_guard<std::mutex> lock(mutex_);
  runtime_ = nullptr;
  callInvoker_.reset();
  callbacks_.clear();
}

double MarkerScaleBridge::requestScale(
    int viewId,
    const std::string &markerId,
    int zoom,
    double timeoutMs) {
  std::shared_ptr<CallInvoker> callInvoker;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    callInvoker = callInvoker_;
  }
  // NaN signals "not ready yet" (bridge not installed, callback not registered
  // yet, timeout, or JS exception) as opposed to a real resolved scale, so the
  // Kotlin-side cache can tell a transient miss apart from a genuine 1.0 and
  // avoid permanently caching a fallback value from before startup finished.
  const double notReady = std::numeric_limits<double>::quiet_NaN();

  if (!callInvoker) {
    MSB_LOG("requestScale: no callInvoker (not installed), viewId=%d", viewId);
    return notReady;
  }

  auto promise = std::make_shared<std::promise<double>>();
  auto future = promise->get_future();

  callInvoker->invokeAsync([this, promise, viewId, markerId, zoom, notReady]() {
    double scale = notReady;
    try {
      std::shared_ptr<Function> fn;
      Runtime *runtime;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        runtime = runtime_;
        auto it = callbacks_.find(viewId);
        if (it != callbacks_.end()) fn = it->second;
      }
      if (fn && runtime) {
        Value result = fn->call(
            *runtime,
            String::createFromUtf8(*runtime, markerId),
            static_cast<double>(zoom));
        scale = result.isNumber() ? result.getNumber() : 1.0;
//        MSB_LOG(
//            "requestScale(async): viewId=%d markerId=%s zoom=%d -> %f",
//            viewId, markerId.c_str(), zoom, scale);
//      } else {
//        MSB_LOG(
//            "requestScale(async): no callback registered for viewId=%d (fn=%d runtime=%p)",
//            viewId, fn != nullptr, (void *)runtime);
      }
    } catch (std::exception &e) {
      MSB_LOG("requestScale(async): exception: %s", e.what());
      scale = notReady;
    } catch (...) {
      MSB_LOG("requestScale(async): unknown exception");
      scale = notReady;
    }
    promise->set_value(scale);
  });

  auto status = future.wait_for(std::chrono::duration<double, std::milli>(timeoutMs));
  if (status != std::future_status::ready) {
    MSB_LOG("requestScale: TIMEOUT viewId=%d markerId=%s zoom=%d", viewId, markerId.c_str(), zoom);
    return notReady;
  }
  return future.get();
}

} // namespace mapconductor
