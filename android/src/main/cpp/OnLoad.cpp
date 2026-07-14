#include <ReactCommon/CallInvokerHolder.h>
#include <fbjni/fbjni.h>
#include <jsi/jsi.h>

#include "MarkerScaleBridge.h"

using facebook::jni::alias_ref;
using facebook::jni::JClass;
using facebook::react::CallInvokerHolder;

namespace {

void nativeInstall(
    alias_ref<JClass> /*clazz*/,
    jlong jsContext,
    alias_ref<CallInvokerHolder::javaobject> callInvokerHolder) {
  auto *runtime = reinterpret_cast<facebook::jsi::Runtime *>(jsContext);
  if (runtime == nullptr) return;
  auto callInvoker = callInvokerHolder->cthis()->getCallInvoker();
  mapconductor::MarkerScaleBridge::instance().install(*runtime, callInvoker);
}

void nativeInvalidate(alias_ref<JClass> /*clazz*/) {
  mapconductor::MarkerScaleBridge::instance().invalidate();
}

jdouble nativeRequestScale(
    alias_ref<JClass> /*clazz*/,
    jint viewId,
    alias_ref<jstring> markerId,
    jint zoom,
    jdouble timeoutMs) {
  return mapconductor::MarkerScaleBridge::instance().requestScale(
      viewId, markerId->toStdString(), zoom, timeoutMs);
}

} // namespace

extern "C" JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void * /*reserved*/) {
  return facebook::jni::initialize(vm, [] {
    facebook::jni::registerNatives(
        "com/mapconductor/react/marker/MarkerScaleBridgeModule",
        {
            makeNativeMethod("nativeInstall", nativeInstall),
            makeNativeMethod("nativeInvalidate", nativeInvalidate),
        });
    facebook::jni::registerNatives(
        "com/mapconductor/react/marker/MarkerScaleBridge",
        {
            makeNativeMethod("nativeRequestScale", nativeRequestScale),
        });
  });
}
