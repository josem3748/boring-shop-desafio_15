/////////////////////////// IMPORTS ///////////////////////////////

import express from "express";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { Router } = express;

import { Server as HttpServer } from "http";

const httpServer = new HttpServer(app);

app.use(express.static("public"));

/// DOTENV
import * as dotenv from "dotenv";
dotenv.config();
const URL = process.env.URL;

/// YARGS
import yargs from "yargs";
const args = yargs(process.argv.slice(2))
  .alias({ p: "puerto", m: "modo" })
  .default({ p: 8080, m: "fork" }).argv;

const PORT = args.puerto;

import os from "os";
const numCPUs = os.cpus().length;

///////////////////////// API RANDOMS ///////////////////////////

const apiRandoms = Router();
app.use("/api/randoms", apiRandoms);

import { fork } from "child_process";
import cluster from "cluster";

apiRandoms.get("/", async (req, res) => {
  let cantidad = req.query.cant;
  !cantidad && (cantidad = 100000000);

  const forked = fork("./aleatorio.js");

  console.log("Running server.js");
  console.log("Forking a new subprocess....");

  forked.send(cantidad);

  forked.on("message", (message) => {
    console.log(`Message from aleatorio.js: ${message}`);
    const info = {
      process_id: process.pid,
      puerto: PORT,
      resultado: message,
    };
    res.send(info);
  });
});

//////////////////////////// SERVER /////////////////////////////////

const MODO = args.modo;

if (MODO == "cluster") {
  if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
      cluster.fork();
    });
  } else {
    // Workers can share any TCP connection

    const server = httpServer.listen(PORT, (err) => {
      if (err) console.log(err);
      console.log(
        `Listen to port ${server.address().port} process id: ${process.pid}`
      );
    });

    console.log(`Worker ${process.pid} started`);
  }
} else {
  const server = httpServer.listen(PORT, (err) => {
    if (err) console.log(err);
    console.log(
      `Listen to port ${server.address().port} process id: ${process.pid}`
    );
  });
}
