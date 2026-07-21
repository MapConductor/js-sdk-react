require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "MapConductorReactNativeCore"
  s.version = package["version"]
  s.summary = package["description"]
  s.license = package["license"]
  s.author = package["author"]
  s.homepage = "https://github.com/mapconductor/react-sdk"
  s.source = { :path => __dir__ }
  s.platform = :ios, "15.1"
  s.source_files = "ios/*.{swift,h,mm,cpp}"
  s.public_header_files = "ios/MarkerScaleBridge.h"
  s.dependency "MapConductorCore"
  s.dependency "React-Core"
  s.dependency "React-callinvoker"
  s.dependency "React-jsi"
  s.dependency "React-NativeModulesApple"
end
