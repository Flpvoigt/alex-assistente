#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"

if ! command -v uv >/dev/null 2>&1; then
  echo "Instale o uv em https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi

if ! command -v espeak-ng >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Instalando o fonetizador espeak-ng..."
    brew install espeak-ng
  else
    echo "Instale espeak-ng pelo gerenciador de pacotes do sistema." >&2
    exit 1
  fi
fi

echo "Preparando o ambiente local do Kokoro..."
uv sync --project voice --python 3.12

echo "Validando as bibliotecas de audio..."
uv run --project voice --python 3.12 --no-sync python -c \
  'import kokoro, numpy, soundfile, torch; print(f"Kokoro pronto (PyTorch {torch.__version__}).")'

echo "Dependencias prontas. O modelo sera baixado e aquecido na primeira execucao de npm start."
