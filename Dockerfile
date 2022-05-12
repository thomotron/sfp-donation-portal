FROM alpine:latest

RUN apk add --no-cache nodejs

WORKDIR /app/
COPY package.json ./
RUN apk add --no-cache --virtual .build build-base npm python3; \
    npm i; \
    apk del .build

COPY server.js ./
COPY static/ ./static/

CMD ["node", "server.js"]
