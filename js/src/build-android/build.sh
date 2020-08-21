# options
develop=
release=
RELEASE_DIR="spidermonkey-android"

usage(){
cat << EOF
usage: $0 [options]

Build SpiderMonkey using Android NDK

OPTIONS:
-d	Build for development
-r  Build for release. specify RELEASE_DIR.
-h	this help

EOF
}

while getopts "drh" OPTION; do
case "$OPTION" in
d)
develop=1
;;
r)
release=1
;;
h)
usage
exit 0
;;
esac
done

set -x

host_os=`uname -s | tr "[:upper:]" "[:lower:]"`
host_arch=`uname -m`

build_with_arch()
{

#NDK_ROOT=$HOME/bin/android-ndk
if [[ ! $NDK_ROOT ]]; then
	echo "You have to define NDK_ROOT"
	exit 1
fi

rm -rf dist
rm -f ./config.cache

../configure --with-android-ndk=$NDK_ROOT \
             --with-android-sdk=$ANDROID_SDK_ROOT \
             --with-android-toolchain=$NDK_ROOT/toolchains/llvm/prebuilt/${host_os}-${host_arch} \
             --with-android-version=14 \
             --enable-readline=no \
             --enable-application=mobile/android \
             --with-android-gnu-compiler-version=${GCC_VERSION} \
             --with-android-arch=${CPU_ARCH} \
             --target=${TARGET_NAME} \
             --disable-shared-js \
             --disable-tests \
             --enable-strip \
             --enable-install-strip \
             --disable-gcgenerational \
             --disable-exact-rooting \
             --disable-root-analysis \
             --enable-gcincremental \
             --disable-debug \
             --disable-gczeal \
             --without-intl-api \
             --disable-threadsafe

# make
make -j8

if [[ $develop ]]; then
    rm ../../../include
    rm ../../../lib

    ln -s -f "$PWD"/dist/include ../../..
    ln -s -f "$PWD"/dist/lib ../../..
fi

if [[ $release ]]; then
# copy specific files from dist
    rm -r "$RELEASE_DIR/include"
    rm -r "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR"
    mkdir -p "$RELEASE_DIR/include"
    cp -RL dist/include/* "$RELEASE_DIR/include/"
    mkdir -p "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR"
    cp -L dist/lib/libjs_static.a "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR/libjs_static.a"

# strip unneeded symbols
    $NDK_ROOT/toolchains/${TOOLS_ARCH}-${GCC_VERSION}/prebuilt/${host_os}-${host_arch}/bin/${TOOLNAME_PREFIX}-strip \
        --strip-unneeded "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR/libjs_static.a"
fi

}

build_with_arm64()
{

#NDK_ROOT=$HOME/bin/android-ndk
if [[ ! $NDK_ROOT ]]; then
	echo "You have to define NDK_ROOT"
	exit 1
fi

rm -rf dist
rm -f ./config.cache

../configure --with-android-ndk=$NDK_ROOT \
             --with-android-sdk=$ANDROID_SDK_ROOT \
             --with-android-toolchain=$NDK_ROOT/toolchains/llvm/prebuilt/${host_os}-${host_arch} \
             --with-android-version=21 \
             --enable-application=mobile/android \
             --with-android-gnu-compiler-version=${GCC_VERSION} \
             --with-android-arch=${CPU_ARCH} \
             --target=${TARGET_NAME} \
             --disable-shared-js \
             --disable-tests \
             --enable-strip \
             --enable-install-strip \
             --disable-gcgenerational \
             --disable-exact-rooting \
             --disable-root-analysis \
             --enable-gcincremental \
             --disable-debug \
             --disable-gczeal \
             --without-intl-api \
             --disable-threadsafe

# make
make -j8

if [[ $develop ]]; then
    rm ../../../include
    rm ../../../lib

    ln -s -f "$PWD"/dist/include ../../..
    ln -s -f "$PWD"/dist/lib ../../..
fi

if [[ $release ]]; then
# copy specific files from dist
    rm -r "$RELEASE_DIR/include"
    rm -r "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR"
    mkdir -p "$RELEASE_DIR/include"
    cp -RL dist/include/* "$RELEASE_DIR/include/"
    mkdir -p "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR"
    cp -L dist/lib/libjs_static.a "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR/libjs_static.a"

# strip unneeded symbols
    $NDK_ROOT/toolchains/${TOOLS_ARCH}-${GCC_VERSION}/prebuilt/${host_os}-${host_arch}/bin/${TOOLNAME_PREFIX}-strip \
        --strip-unneeded "$RELEASE_DIR/lib/$RELEASE_ARCH_DIR/libjs_static.a"
fi

}

# # Build with armv6
# TOOLS_ARCH=arm-linux-androideabi
# TARGET_NAME=arm-linux-androideabi
# CPU_ARCH=armeabi
# RELEASE_ARCH_DIR=armeabi
# GCC_VERSION=4.9
# TOOLNAME_PREFIX=arm-linux-androideabi
# build_with_arch

# Build with armv7
TOOLS_ARCH=arm-linux-androideabi
TARGET_NAME=arm-linux-androideabi
CPU_ARCH=armeabi-v7a
RELEASE_ARCH_DIR=armeabi-v7a
GCC_VERSION=4.9
TOOLNAME_PREFIX=arm-linux-androideabi
build_with_arch

# Build with arm64
TOOLS_ARCH=aarch64-linux-android
TARGET_NAME=aarch64-linux-android
CPU_ARCH=arm64-v8a
RELEASE_ARCH_DIR=arm64-v8a
GCC_VERSION=4.9
TOOLNAME_PREFIX=aarch64-linux-android
build_with_arm64

# Build with x86
TOOLS_ARCH=x86
TARGET_NAME=i686-linux-android
CPU_ARCH=x86
RELEASE_ARCH_DIR=x86
GCC_VERSION=4.9
TOOLNAME_PREFIX=i686-linux-android
build_with_arch
