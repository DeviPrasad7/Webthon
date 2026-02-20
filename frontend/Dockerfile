# ═══════════════════════════════════════════════════════════════════
# JARVIS Frontend — React (Vite) in Docker
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine

WORKDIR /app

# Layer 1: deps (cached unless package.json changes)
COPY package.json ./
RUN npm install

# Layer 2: app code
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
