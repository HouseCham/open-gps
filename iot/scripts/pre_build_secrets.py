# SCons pre-build hook: ensure secrets.cpp rebuilds whenever config/secrets.h
# changes. PlatformIO's SCons dep tracker doesn't watch files outside the
# standard src/include/lib paths, so without this hook a stale .o can sit
# in .pio/build/ and ship a firmware with empty WiFi credentials even after
# the user edits config/secrets.h.
#
# Symlinks config/secrets.h into include/ via a tiny header shim? No —
# that would commit secrets to a tracked dir. Touch src/secrets.cpp if the
# secrets file is newer; the recompile is cheap and the dependency becomes
# explicit in SCons's dep tree after that.

import os

Import("env")

# env["PROJECT_DIR"] is the PlatformIO project root — `File("...")` resolves
# relative to this script's directory otherwise, which would be `scripts/`.
PROJECT_DIR    = env["PROJECT_DIR"]
CONFIG_SECRETS = os.path.join(PROJECT_DIR, "config", "secrets.h")
SECRETS_CPP    = os.path.join(PROJECT_DIR, "src",     "secrets.cpp")

if os.path.exists(CONFIG_SECRETS) and os.path.exists(SECRETS_CPP):
    secrets_mtime = os.path.getmtime(CONFIG_SECRETS)
    cpp_mtime     = os.path.getmtime(SECRETS_CPP)
    if secrets_mtime >= cpp_mtime:
        print("[pre-build] config/secrets.h is newer than src/secrets.cpp — "
              "bumping secrets.cpp mtime to force rebuild")
        # Set secrets.cpp mtime to secrets.h mtime + 1s so SCons sees
        # it as strictly newer and triggers a rebuild.
        os.utime(SECRETS_CPP, (secrets_mtime + 1, secrets_mtime + 1))