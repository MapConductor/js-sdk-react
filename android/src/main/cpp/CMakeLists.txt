cmake_minimum_required(VERSION 3.13)
project(mapconductor_markerscale)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

add_library(
  mapconductor_markerscale
  SHARED
  MarkerScaleBridge.cpp
  OnLoad.cpp
)

target_link_libraries(
  mapconductor_markerscale
  ReactAndroid::jsi
  ReactAndroid::reactnative
  fbjni::fbjni
  android
  log
)

target_compile_options(
  mapconductor_markerscale
  PRIVATE
  -fexceptions
  -frtti
  -Wall
)
