# Image UNIQUE pour les 3 roles (api / ws / jobs) : le role est choisi a l'execution par SERVICE_ROLE.
# Cloudflare Containers exige linux/amd64. Le contexte de build est la racine du depot backend/.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production PORT=8080

RUN useradd --create-home --uid 10001 app
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# collectstatic a besoin d'une config valide mais AUCUN secret reel : valeurs factices limitees a cette instruction.
RUN DJANGO_SECRET_KEY=build-only-$(head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9') \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    INTERNAL_JOB_SECRET=build-only-0123456789abcdef0123456789abcdef \
    python manage.py collectstatic --noinput \
 && sed -i 's/\r$//' docker/entrypoint.sh \
 && chmod +x docker/entrypoint.sh \
 && chown -R app:app /app

USER app
EXPOSE 8080
ENTRYPOINT ["./docker/entrypoint.sh"]
