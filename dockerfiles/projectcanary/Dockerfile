###############################################################################
# Step 1 : Run Npm /install
#
# Use node v12.9.1
FROM node:12.9.1 AS builder

ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini

#RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
#RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
#RUN apt-get update && apt-get install yarn

# Change working directory
WORKDIR /usr/src/app
#COPY yarn.lock .
COPY package.json .

RUN yarn install


###############################################################################


###############################################################################
# Step 2 : Build Server image
#
# Use node v12.9.1
FROM node:12.9.1

RUN useradd -ms /bin/bash admin

ADD dockerfiles/projectcanary/custom.conf /etc/security/limits.d/custom.conf

COPY --from=builder /tini ./tini
RUN chmod +x /tini
#ENTRYPOINT ["/tini", "--"]

WORKDIR /usr/src/app

COPY . .

COPY --from=builder /usr/src/app/node_modules ./node_modules

#RUN mkdir /usr/src/app/server/.temp
#RUN mkdir /usr/src/app/server/.resume

RUN chown -R admin:admin /usr/src/app/server/

USER admin

# Expose API port to the outside
EXPOSE 6000

RUN ulimit -n

# Launch application
CMD ["npm", "start"]
