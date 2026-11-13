const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");
const path = require("node:path");

const rootDirectory = path.resolve(__dirname, "..");
const backendEntry = path.join(rootDirectory, "backend", "src", "server.js");
const frontendEntry = path.join(rootDirectory, "frontend", "node_modules", "vite", "bin", "vite.js");
const children = [];
let shuttingDown = false;

if (!fs.existsSync(backendEntry) || !fs.existsSync(frontendEntry)) {
    console.error("Missing project dependencies. Run `npm install` in both the backend and frontend directories.");
    process.exit(1);
}

function isPortInUse(port) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port });
        let settled = false;

        function finish(inUse) {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(inUse);
        }

        socket.setTimeout(300);
        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(true));
        socket.once("error", (error) => {
            if (error.code === "ECONNREFUSED") {
                finish(false);
            } else {
                settled = true;
                reject(error);
            }
        });
    });
}

async function findBackendPort() {
    const configuredPort = process.env.PORT;
    const firstPort = configuredPort ? Number(configuredPort) : 5000;

    if (!Number.isInteger(firstPort) || firstPort < 1 || firstPort > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535.");
    }

    const lastPort = configuredPort ? firstPort : Math.min(firstPort + 99, 65535);
    for (let port = firstPort; port <= lastPort; port += 1) {
        if (!(await isPortInUse(port))) {
            if (port !== firstPort) {
                console.log(`[backend] Port ${firstPort} is occupied; using port ${port}.`);
            }
            return port;
        }
    }

    throw new Error(
        configuredPort
            ? `Backend port ${firstPort} is already in use. Stop the service using it or set PORT to another port.`
            : `No available backend port found between ${firstPort} and ${lastPort}.`
    );
}

function startChild(name, entry, args, cwd, env) {
    console.log(`[${name}] Starting...`);
    const child = spawn(process.execPath, [entry, ...args], {
        cwd,
        env,
        stdio: "inherit"
    });
    children.push(child);

    child.on("error", (error) => {
        console.error(`[${name}] Failed to start: ${error.message}`);
        shutdown(1);
    });

    child.on("exit", (code, signal) => {
        if (shuttingDown) return;

        console.error(
            `[${name}] Exited unexpectedly with ${signal ? `signal ${signal}` : `code ${code}`}.`
        );
        shutdown(code === 0 ? 1 : code || 1);
    });

    return child;
}

async function waitForBackend(port) {
    const url = `http://127.0.0.1:${port}/api/health`;
    const deadline = Date.now() + 10000;

    while (!shuttingDown && Date.now() < deadline) {
        try {
            const response = await fetch(url);
            const payload = await response.json();
            if (
                response.ok &&
                payload.success === true &&
                payload.project === "FarmShift AI" &&
                payload.team === "METHOD404"
            ) {
                return;
            }
        } catch {
            // Retry while the backend is starting or before its health route responds.
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Backend did not become healthy at ${url}.`);
}

function shutdown(exitCode = 0) {
    if (shuttingDown) return;

    shuttingDown = true;
    process.exitCode = exitCode;
    for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill();
        }
    }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function startDevelopmentServers() {
    const backendPort = await findBackendPort();
    const backendEnv = { ...process.env, PORT: String(backendPort) };

    startChild("backend", backendEntry, [], path.join(rootDirectory, "backend"), backendEnv);
    await waitForBackend(backendPort);

    const frontendEnv = {
        ...process.env,
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || `http://localhost:${backendPort}`
    };
    const frontendPort = process.env.VITE_PORT || "5173";

    startChild(
        "frontend",
        frontendEntry,
        ["--port", frontendPort],
        path.join(rootDirectory, "frontend"),
        frontendEnv
    );
}

startDevelopmentServers().catch((error) => {
    console.error(`[dev] ${error.message}`);
    shutdown(1);
});
