FROM quay.io/eduk8s/base-environment:master

COPY --chown=1001:0 . /home/eduk8s/

RUN mv /home/eduk8s/workshop /opt/workshop

RUN fix-permissions /home/eduk8s

# To allow development of a new terminal, going to fudge some things.
# First move the handler for the new endpoint into the routes directory.

RUN mv myterminal.js /opt/gateway/routes/

RUN mv myterminal.pug /opt/gateway/views/

# Next move the workshop.yaml file to the config directory so a new
# tab will be created in the dashboard for the new terminal.

RUN mkdir -p /opt/eduk8s/config && \
    mv resources/workshop.yaml /opt/eduk8s/config/ && \
    rm -rf resources

# Finally install any extra npm packages we need for the new terminal.

RUN mv package.json /opt/gateway/ && \
    cd /opt/gateway && \
    npm install
