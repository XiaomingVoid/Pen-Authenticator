#!/bin/bash
# Compatibility entry for existing projects; npm postinstall uses Node directly.
set -e
exec node "$(dirname -- "$0")/patch-cli.cjs"
