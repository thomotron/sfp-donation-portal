FROM alpine:latest

RUN apk add --no-cache npm nodejs

WORKDIR /app/
COPY package.json ./
RUN apk add --no-cache --virtual .build build-base python3; \
    npm i; \
    apk del .build

COPY server.js ./
COPY static/ ./static/

CMD ["node", "server.js"]
