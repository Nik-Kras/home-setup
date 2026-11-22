# Sourced by run.sh and the helper scripts: toolchain paths. No secrets here.
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_NO_UPDATE_NOTIFICATION=1
export DEVICE="${DEVICE:-emulator-5554}"
