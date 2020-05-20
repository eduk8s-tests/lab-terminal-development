import * as express from 'express';
import * as WebSocket from 'ws';
import * as path from 'path';
import * as pty from 'node-pty';
import {IPty} from "node-pty";


const MAX_PAGE = 3;

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
            const ptyProcess = pty.spawn('bash', [], {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: process.cwd(),
                env: <any> process.env
            });
            processInfo = new PtyProcessInfo(ptyProcess, id);
            this.processes.set(id, processInfo);
        }
        return processInfo;
    }

    removeSocket(ws: WebSocket) {
        const it = this.processes.values();
        let itResult = it.next();
        while (!itResult.done) {
            const index = itResult.value.sockets.indexOf(ws);
            if (index >= 0) {
                itResult.value.sockets.splice(index, 1);
                return;
            }
            itResult = it.next();
        }
    }

}

interface Message {
    id: string;
    data: string;
}

const app = express();

//initialize a simple http server
const server = app.listen(3001, function() { console.log('Express server currently running on port 3001'); });

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

const processManager = new PtyProcessManager();

wss.on('connection', (ws: WebSocket) => {

    ws.on('message', (message: string) => {
        const msg: Message = JSON.parse(message);
        if (msg.id) {
            const processInfo = processManager.getOrCreate(msg.id);
            if (msg.data) {
                processInfo.pty.write(msg.data);
            } else {
                processInfo.sockets.push(ws);
                ws.send(JSON.stringify({
                    id: processInfo.id,
                    data: processInfo.buffer.join('')
                }));
            }
        }
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

app.get('/session/:id', (req, res) => {
    const session = req.params.id;
    const processInfo = processManager.getOrCreate(session);
    res.render('terminal', { session });
});
