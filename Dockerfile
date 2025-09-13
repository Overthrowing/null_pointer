# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.17.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"
WORKDIR /app
ENV NODE_ENV=production

FROM base AS build
ENV NODE_ENV=development

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci

COPY . .
RUN npm run build

RUN npm prune --omit=dev

FROM base
COPY --from=build /app /app
EXPOSE 8080
CMD [ "npm", "run", "start" ]
