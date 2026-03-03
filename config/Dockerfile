# syntax=docker/dockerfile:1

FROM node:20 AS deps
WORKDIR /app
COPY package*.json ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/plugins/package.json packages/plugins/
COPY packages/server/package.json packages/server/
COPY packages/demo/package.json packages/demo/
COPY packages/site/package.json packages/site/
RUN --mount=type=cache,target=/root/.npm \
    npm ci && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
      npm install @rollup/rollup-linux-x64-gnu @pagefind/linux-x64 --no-save; \
    elif [ "$ARCH" = "aarch64" ]; then \
      npm install @rollup/rollup-linux-arm64-gnu @pagefind/linux-arm64 --no-save; \
    fi

FROM deps AS build
COPY packages/core/ packages/core/
COPY packages/react/ packages/react/
COPY packages/plugins/ packages/plugins/
COPY packages/server/ packages/server/
COPY packages/demo/ packages/demo/
COPY packages/site/ packages/site/
COPY tsconfig*.json ./
ARG BUILD_TIME=unknown
RUN npm run build && npm run build -w packages/demo && npm run build -w packages/site

FROM nginx:alpine
ARG BUILD_TIME=unknown
COPY config/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/site/dist /usr/share/nginx/html
COPY --from=build /app/packages/demo/dist /usr/share/nginx/html/demo
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s CMD wget -qO- http://127.0.0.1/ || exit 1
