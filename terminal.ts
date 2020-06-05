import * as express from 'express';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as pty from 'node-pty';
import {IPty} from "node-pty";


const MAX_PAGE = 3;
const ARG_PORT_PREFIX = '--port=';
const ARG_CWD_PREFIX = '--cwd=';
const ARG_PTY_PREFX = '--pty-params=';

let cliPort = '';
let cwd = '';
let ptyParams: string[] = [];

for (let i = 0; i < process.argv.length; i++) {
    const value = process.argv[i];
    if (value.startsWith(ARG_PORT_PREFIX)) {
        cliPort = value.substr(ARG_PORT_PREFIX.length);
    } else if (value.startsWith(ARG_CWD_PREFIX)) {
        cwd = value.substr(ARG_CWD_PREFIX.length);
    } else if (value.startsWith(ARG_PTY_PREFX)) {
        let paramsStr = value.substr(ARG_PTY_PREFX.length).trim();
        if (paramsStr[0] === '"' && paramsStr[paramsStr.length - 1] === '"') {
            paramsStr = paramsStr.substring(1, paramsStr.length - 1);
        }
        if (paramsStr.length) {
            ptyParams.push(...paramsStr.split(/\s+/));
        }
    }
}

class PtyProcessInfo {

    id: string;
    pty: IPty;
    buffer: string[];
    sockets: WebSocket[] = [];

    constructor(pty: IPty, id: string) {
        this.id = id;
        this.pty = pty;
        this.buffer = [];

        pty.onData(data => {
            const message = JSON.stringify({
              id: this.id,
              data: data
            });
            this.sockets.forEach(ws => ws.send(message));
            if (this.isOverBufferSize()) {
                this.buffer.shift();
            }
            this.buffer.push(data);
        });

    }

    private isOverBufferSize(): boolean {
        const max = this.pty.cols * this.pty.rows * MAX_PAGE;
        const totalLength = this.buffer.length === 0 ? 0 : this.buffer.map(s => s.length).reduce((s, c) => s + c);
        return totalLength > max;
    }
}

class PtyProcessManager {

    private processes = new Map<String, PtyProcessInfo>();

    constructor() {}

    getOrCreate(id: string): PtyProcessInfo {
        let processInfo = this.processes.get(id);
        if (!processInfo) {
            const ptyProcess = pty.spawn('bash', ptyParams, {
                name: 'xterm-color',
                cols: 120,
                rows: 30,
                cwd: cwd || process.cwd(),
                env: <any> process.env
            });
            processInfo = new PtyProcessInfo(ptyProcess, id);
            this.processes.set(id, processInfo);
        }
        return processInfo;
    }

    removeSocket(ws: WebSocket): PtyProcessInfo | undefined {
        const it = this.processes.values();
        let itResult = it.next();
        while (!itResult.done) {
            const processInfo = itResult.value;
            const index = processInfo.sockets.indexOf(ws);
            if (index >= 0) {
                processInfo.sockets.splice(index, 1);
                return processInfo;
            }
            itResult = it.next();
        }
    }

}

interface Message {
    id?: string;
    data?: string;
    size?: Size;
}

interface Size {
    cols: number;
    rows: number;
}

const app = express();

const PORT = cliPort || process.env.TERMINAL_PORT || 3001;

//initialize a simple http server
const server = app.listen(PORT, function() { console.log(`Express server currently running on port ${PORT}`); });

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

const processManager = new PtyProcessManager();

wss.on('connection', (ws: WebSocket) => {

    ws.on('message', (message: string) => {
        const msg: Message = JSON.parse(message);
        if (msg.id) {
            const processInfo = processManager.getOrCreate(msg.id);
            if (msg.data) {
                // Terminal input data message
                processInfo.pty.write(msg.data);
            } else if (msg.size) {
                // Terminal size (cols, rows) message
                console.log(`Sizing pty process output to columns=${msg.size.cols} rows=${msg.size.rows}`);
                processInfo.pty.resize(msg.size.cols, msg.size.rows);
            } else {
                // Initial message for the session. Has the the session id only.
                // Reply is send current pty content if any
                processInfo.sockets.push(ws);
                ws.send(JSON.stringify({
                    id: processInfo.id,
                    data: processInfo.buffer.join('')
                }));
            }
        }
        // Else it is a ping message with is just empty object {}
        // Sent periodically from the client to keep the WS opened
    });


    ws.on('close', (ws: WebSocket) => {
        processManager.removeSocket(ws);
    });

});

app.set('views', path.join(__dirname, '.'));
app.set('view engine', 'pug');

app.use('/xterm.css', express.static(path.join(__dirname,
    './node_modules/xterm/css/xterm.css')));
app.use('/xterm.js', express.static(path.join(__dirname,
    './node_modules/xterm/lib/xterm.js')));
app.use('/xterm-addon-fit.js', express.static(path.join(__dirname,
    './node_modules/xterm-addon-fit/lib/xterm-addon-fit.js')));
app.use('/ResizeSensor.js', express.static(path.join(__dirname,
    './node_modules/css-element-queries/src/ResizeSensor.js')));
app.use('/lodash.js', express.static(path.join(__dirname,
    './node_modules/lodash/lodash.js')));

let wsUrl = `ws://localhost:${PORT}`;
if (process.env.SESSION_NAMESPACE && process.env.INGRESS_DOMAIN) {
    wsUrl = `ws://${process.env.SESSION_NAMESPACE}-xtermjs.${process.env.INGRESS_DOMAIN}`;
}

app.get('/session/:id', (req, res) => {
    const session = req.params.id;
    const processInfo = processManager.getOrCreate(session);
    res.render('terminal', {
        session: session,
        wsUrl: wsUrl,
        env: JSON.stringify(process.env)
    });
});
