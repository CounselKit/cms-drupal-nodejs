FROM node:gallium
EXPOSE 8080

WORKDIR /home/node/app

COPY ["package.json", "package-lock.json", "./"]
RUN npm install
COPY . .

CMD ["node", "/home/node/app/app.js"]
