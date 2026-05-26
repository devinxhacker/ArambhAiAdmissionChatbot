FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=development

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
