FROM python:3.12-alpine

WORKDIR /app

# Copy application files
COPY index.html favicon.svg manifest.json server.py ./
COPY config.template.yaml ./
COPY css/ ./css/
COPY js/ ./js/
COPY themes/ ./themes/

EXPOSE 7070

CMD ["python3", "server.py"]
