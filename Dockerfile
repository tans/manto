FROM oven/bun:1.3.6
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
RUN mkdir -p /data
ENV PORT=41875 MANTO_DB_PATH=/data/manto.sqlite
EXPOSE 41875
VOLUME ["/data"]
CMD ["bun", "src/index.ts"]
