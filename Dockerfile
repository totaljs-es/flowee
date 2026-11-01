FROM node:24-alpine
MAINTAINER totaljses "info@totaljs.es"

WORKDIR /www

COPY package.json .
RUN npm install --omit=dev

COPY . .

# The data of the classroom: the FlowStreams, their settings and the private files
VOLUME ["/www/databases", "/www/flowstream", "/www/private"]

EXPOSE 8000

CMD [ "npm", "start" ]
