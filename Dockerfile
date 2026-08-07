FROM python:3.12-alpine

WORKDIR /app

# Copy all files
COPY index.html favicon.svg manifest.json server.py ./
COPY css/ ./css/
COPY js/ ./js/

EXPOSE 7070

CMD ["python3", "server.py"]
