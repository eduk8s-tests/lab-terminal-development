FROM quay.io/eduk8s/base-environment:master

COPY --chown=1001:0 . /home/eduk8s/

RUN mv /home/eduk8s/workshop /opt/workshop

RUN fix-permissions /home/eduk8s

# To allow development of a new terminal, going to fudge some things.
# First move the handler for the new endpoint into the routes directory.

RUN mkdir /opt/xtermjs && mv tsconfig.json /opt/xtermjs/ && mv terminal.ts /opt/xtermjs/ && mv terminal.pug /opt/xtermjs/
COPY --chown=1001:0 terminal/start-xtermjs /opt/eduk8s/sbin
COPY --chown=1001:0 terminal/xtermjs.conf /opt/eduk8s/etc/supervisor/

# Next move the workshop.yaml file to the config directory so a new
# tab will be created in the dashboard for the new terminal.

RUN mkdir -p /opt/eduk8s/config && \
    mv resources/workshop.yaml /opt/eduk8s/config/ && \
    rm -rf resources

# Finally install any extra npm packages we need for the new terminal.

RUN mv package.json /opt/xtermjs/ && \
    cd /opt/xtermjs && \
    npm install
