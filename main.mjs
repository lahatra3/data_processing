import { availableParallelism } from "node:os";
import { spawn } from "node:child_process";
import cluster from "node:cluster";
import process from "node:process";
import { createWriteStream, stat } from "node:fs";

const DATA_SOURCE = process.env["DATA_SOURCE"];
const DATA_SINK = process.env["DATA_SINK"];
const DATA_SINK_SIZE = parseInt(process.env["DATA_SINK_SIZE"]) || 1024;

const numCPUs = availableParallelism();

const dataProcessing = (datasource, datasink) => {

    const dataSourceReader = spawn("curl", [datasource], { stdio: 'pipe' });
    const writer = createWriteStream(datasink, { flags: "a", encoding: "utf-8", autoClose: true });

    dataSourceReader.stdout.on('data', (data) => {
        writer.write(data);
    });
    dataSourceReader.on('close', (code) => {
        console.log(`Reading is exited with code ${code}`);
    });

    writer.on("finish", () => {
        console.log("Writing finished...");
    });
}

const fileWatcher = (filename, maxSize) => {

    stat(filename, (err, stats) =>{
        if (err) {
            console.error("Error: ", err);
            process.exit(1);
        }

        if (stats.size > maxSize) {
            console.log("Completed...");
            process.exit(0);
        }
    })
}

setInterval(() => {

    fileWatcher(DATA_SINK, DATA_SINK_SIZE);

    if (cluster.isPrimary) {
        console.log(`Primary PID: ${process.pid} is running...`);
    
        for (let item = 0; item < numCPUs; item++) {
            cluster.fork();
        }
    
        cluster.on('exit', (worker, code, signal) => {
            console.log(`Worker PID: ${worker.process.pid} is died with status code ${code} and signal ${signal}...`);
        });
    } else {
        dataProcessing(DATA_SOURCE, DATA_SINK);
        console.log(`Worker PID: ${process.pid} is started`);
    }
}, 3113);