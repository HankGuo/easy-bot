FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache python3 bash git curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4100

CMD ["node", "dist/main/index.js"]
