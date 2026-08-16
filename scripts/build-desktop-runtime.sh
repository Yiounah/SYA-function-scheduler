#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/.desktop-build"
VENV_DIR="${BUILD_DIR}/venv"
OUTPUT_DIR="${ROOT_DIR}/desktop-runtime"

select_python() {
  for candidate in "${PYTHON:-}" "/opt/homebrew/bin/python3" "/opt/miniconda3/bin/python3" "python3.13" "python3.12" "python3.11" "python3"; do
    [[ -z "${candidate}" ]] && continue
    if command -v "${candidate}" >/dev/null 2>&1 || [[ -x "${candidate}" ]]; then
      if "${candidate}" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
        echo "${candidate}"
        return
      fi
    fi
  done
  echo "Python 3.11+ is required to build the desktop runtime." >&2
  exit 1
}

PYTHON_BIN="$(select_python)"
mkdir -p "${BUILD_DIR}" "${OUTPUT_DIR}"

if [[ ! -x "${VENV_DIR}/bin/python" ]]; then
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

"${VENV_DIR}/bin/python" -m pip install --disable-pip-version-check \
  -r "${ROOT_DIR}/sya_task_scheduler/requirements.txt" \
  'pyinstaller>=6.11,<7'

"${VENV_DIR}/bin/pyinstaller" \
  --noconfirm \
  --clean \
  --onefile \
  --name scheduler-server \
  --paths "${ROOT_DIR}/sya_task_scheduler" \
  --add-data "${ROOT_DIR}/sya_task_scheduler/app/static:app/static" \
  --distpath "${BUILD_DIR}/dist" \
  --workpath "${BUILD_DIR}/work" \
  --specpath "${BUILD_DIR}" \
  "${ROOT_DIR}/desktop/python_entry.py"

install -m 755 "${BUILD_DIR}/dist/scheduler-server" "${OUTPUT_DIR}/scheduler-server"
echo "${OUTPUT_DIR}/scheduler-server"
