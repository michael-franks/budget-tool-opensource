FROM node:20-alpine
WORKDIR /app

# Install production deps first (better layer caching). Uses the committed lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source
COPY . .

# Inside the container: persist data under /data, and bind all interfaces so the
# published port is reachable. Only ever expose the mapped port behind auth / a VPN.
ENV DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=3000
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
