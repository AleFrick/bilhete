FROM node:20-slim
WORKDIR /usr/src/app

COPY package*.json ./
# Para produção, mantemos o npm install normal ou ci para garantir que ferramentas de migration funcionem
RUN npm install

COPY . .

# Define a variável de ambiente para produção
ENV NODE_ENV=production

# Porta padrão interna onde o seu servidor server.js escuta
EXPOSE 3333

CMD ["node", "src/server.js"]
