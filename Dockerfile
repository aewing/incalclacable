FROM node:10.15.3-alpine
MAINTAINER Andrew Ewing <drew@collaboratory.io>

# install deps
ADD package.json /tmp/package.json
RUN cd /tmp && npm install

# Copy deps
RUN mkdir -p /opt/incalclacable && cp -a /tmp/node_modules /opt/incalclacable

# Setup workdir
WORKDIR /opt/incalclacable
COPY . /opt/incalclacable

# run
EXPOSE 3000
CMD ["npm", "start"]