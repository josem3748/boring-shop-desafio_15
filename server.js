/////////////////////////// IMPORTS ///////////////////////////////

import { normalize, denormalize, schema } from "normalizr";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from "express";
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { Router } = express;

import { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";

const httpServer = new HttpServer(app);
const io = new IOServer(httpServer);

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

/// COMPRESSION GZIP
import compression from "compression";
app.use(compression());
/// en la ruta info me salen más bytes con GZIP que sin.

/// WINSTON
import winston from "winston";
/// LOGGER
const loggerConsole = winston.createLogger({
  transports: [new winston.transports.Console({ level: "info" })],
});

const loggerWarn = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: "./logs/warn.log",
      name: "warn",
      level: "warn",
    }),
  ],
});

const loggerError = winston.createLogger({
  transports: [
    new winston.transports.File({
      filename: "./logs/error.log",
      name: "error",
      level: "error",
    }),
  ],
});

const loggerFile = {
  warn: (params) => {
    return loggerWarn.warn(params);
  },
  error: (params) => {
    return loggerError.error(params);
  },
};

// Ruta y método de todas las peticiones recibidas por el servidor (info)
app.use((req, res, next) => {
  loggerConsole.info(`Ruta: '${req.originalUrl}' - Método: '${req.method}'`);
  next();
});

////////////////////////// GET PRODUCTOS ////////////////////////////

import fetch from "node-fetch";

const getProducts2 = async () => {
  const requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  const respuesta = await fetch(
    "http://localhost:8080/api/productos-test",
    requestOptions
  )
    .then((response) => response.text())
    .catch((error) => console.log("error", error));

  return JSON.parse(respuesta);
};

////////////////////////// GET MENSAJES ////////////////////////////

import mongoose, { now } from "mongoose";

const mensajesCollection = "mensajes";

const MensajeSchema = new mongoose.Schema({
  author: {
    id: { type: String },
    nombre: { type: String },
    apellido: { type: String },
    edad: { type: String },
    alias: { type: String },
    avatar: { type: String },
  },
  fecha: { type: String },
  text: { type: String },
});

const mensajes = mongoose.model(mensajesCollection, MensajeSchema);

const getMessages2 = async () => {
  try {
    // Conexión a la base de datos
    let rta = await mongoose.connect(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "chat",
    });

    /////////////// GET /////////////////

    let getAll = await mensajes.find({}).lean();

    /////////////// NORMALIZAR /////////////////

    const myData = getAll;
    const autorSchema = new schema.Entity("autores");
    const mensajeListSchema = [
      {
        author: autorSchema,
      },
    ];

    let result = normalize(myData, mensajeListSchema);

    /////////////// COMPRESION /////////////////

    let size1 = JSON.stringify(myData).length;
    let size2 = JSON.stringify(result).length;

    let compression = Math.round(((size1 - size2) / size1) * 10000) / 100;

    /////////////// DENORMALIZAR /////////////////

    const denormalizedResult = denormalize(
      result.result,
      mensajeListSchema,
      result.entities
    );

    /////////////// RETURN /////////////////

    return { mensajes: denormalizedResult, compresion: compression };
  } catch (error) {
    console.log(error);
  }
};

////////////////////////// SEND MENSAJE ////////////////////////////

const sendMessage = async (data) => {
  try {
    // Conexión a la base de datos
    let rta = await mongoose.connect(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "chat",
    });

    await new mensajes(data).save();
  } catch (error) {
    console.log(error);
  }
};

////////////////////////////// HBS //////////////////////////////////

import * as hbs from "express-handlebars";

app.set("view engine", "hbs"); // motor de plantillas a utilizar
app.set("views", "./views"); // especifica el directorio de vistas

app.engine(
  "hbs",
  hbs.engine({
    extname: ".hbs",
    defaultLayout: "index.hbs",
    layoutsDir: __dirname + "/views/layouts/",
    partialsDir: __dirname + "/views/partials/",
  })
);

////////////////////////////// SESSION Y COOKIE //////////////////////////////////

import cookieParser from "cookie-parser";
import session from "express-session";
app.use(cookieParser());

////////////////////////////// PASSPORT //////////////////////////////////

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";

const usuariosCollection = "usuarios";

const UsuarioSchema = new mongoose.Schema({
  username: { type: String },
  password: { type: String },
});

const usuarios = mongoose.model(usuariosCollection, UsuarioSchema);

passport.use(
  "login",
  new LocalStrategy(async (username, password, done) => {
    let rta = mongoose.connect(URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: "chat",
    });

    usuarios.findOne({ username }, (err, user) => {
      if (err) return done(err);

      if (!user) {
        console.log("User Not Found with username " + username);
        return done(null, false);
      }

      if (!isValidPassword(user, password)) {
        console.log("Invalid Password");
        return done(null, false);
      }

      return done(null, user);
    });
  })
);

const isValidPassword = (user, password) => {
  return bcrypt.compareSync(password, user.password);
};

passport.use(
  "signup",
  new LocalStrategy(
    {
      passReqToCallback: true,
    },
    (req, username, password, done) => {
      let rta = mongoose.connect(URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: "chat",
      });

      usuarios.findOne({ username: username }, async (err, user) => {
        if (err) {
          console.log("Error in SignUp: " + err);
          return done(err);
        }

        if (user) {
          console.log("User already exists");
          return done(null, false);
        }

        const newUser = {
          username: username,
          password: bcrypt.hashSync(password, 10),
        };
        usuarios.create(newUser, (err, userWithId) => {
          if (err) {
            console.log("Error in Saving user: " + err);
            return done(err);
          }
          console.log(user);
          console.log("User Registration succesful");
          return done(null, userWithId);
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  usuarios.findById(id, done);
});

app.use(
  session({
    secret: "keyboard cat",
    cookie: {
      httpOnly: false,
      secure: false,
      maxAge: 10 * 60 * 1000,
    },
    rolling: true,
    resave: true,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

////////////////////////////// RUTAS //////////////////////////////////

app.get("/login", async (req, res) => {
  const productos = await getProducts2();
  const check = productos.length > 0;
  const mensajesCheck = await getMessages2();
  const check2 = mensajesCheck.mensajes.length > 0;

  req.session.inicio = Date.now();

  console.log(req.sessionID);

  res.status(200).render("main", {
    body: check,
    body2: check2,
    user: req.session.user,
  });
});

app.post(
  "/login",
  passport.authenticate("login", { failureRedirect: "/faillogin" }),
  async (req, res) => {
    const productos = await getProducts2();
    const check = productos.length > 0;
    const mensajesCheck = await getMessages2();
    const check2 = mensajesCheck.mensajes.length > 0;

    const { username } = req.body;
    req.session.user = username;
    req.session.inicio = Date.now();

    console.log(req.sessionID);

    res.status(200).render("main", {
      body: check,
      body2: check2,
      user: req.session.user,
    });
  }
);

app.get("/faillogin", async (req, res) => {
  res.status(200).render("faillogin");
});

app.get("/logout", (req, res) => {
  let user = req.session.user;
  req.session.destroy((err) => {
    if (!err) {
      res.status(200).render("main", {
        lastuser: user,
      });
    } else res.send({ error: err });
  });
});

///////////////////////// REGISTRO ///////////////////////////

app.get("/registro", async (req, res) => {
  res.status(200).render("registro");
});

app.post(
  "/registro",
  passport.authenticate("signup", { failureRedirect: "/failregistro" }),
  (req, res) => {
    res.redirect("/login");
  }
);

app.get("/failregistro", async (req, res) => {
  res.status(200).render("failregistro");
});

///////////////////////// RUTA INFO ///////////////////////////

import os from "os";
const numCPUs = os.cpus().length;

const info = {
  argumentos_de_entrada: process.argv,
  nombre_de_la_plataforma: process.env.OS,
  version_node: process.versions.node,
  memoria_total_reservada: process.memoryUsage().rss,
  path_de_ejecucion: process.execPath,
  carpeta_del_proyecto: process.env.PWD,
  numero_de_cpus: numCPUs,
  process_id: process.pid,
  puerto: PORT,
};

app.get("/info-nobloq", async (req, res) => {
  //console.log(info);
  res.send(info);
});

app.get("/info-bloq", async (req, res) => {
  console.log(info);
  res.send(info);
});

///////////////////////// API RANDOMS ///////////////////////////

const apiRandoms = Router();
app.use("/api/randoms", apiRandoms);

import { fork } from "child_process";
import cluster from "cluster";

// Desactivando child_process de ruta randoms

/* apiRandoms.get("/", async (req, res) => {
  try {
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
  } catch (error) {
    // Errores lanzados por las apis de mensajes y productos, únicamente (error)
    loggerConsole.error(`${error}`);
    loggerFile.error(`${error}`);
  }
}); */

import { aleatorio } from "./aleatorio.js";

apiRandoms.get("/", async (req, res) => {
  try {
    let cantidad = req.query.cant;
    !cantidad && (cantidad = 100000000);

    const message = aleatorio(cantidad);

    const info = {
      process_id: process.pid,
      puerto: PORT,
      resultado: message,
    };

    res.send(info);
  } catch (error) {
    // Errores lanzados por las apis de mensajes y productos, únicamente (error)
    loggerConsole.error(`${error}`);
    loggerFile.error(`${error}`);
  }
});

///////////////////////// PRODUCTOS FAKER ///////////////////////////

import faker from "faker";
faker.locale = "es";
const { commerce, image } = faker;

app.get("/api/productos-test", async (req, res) => {
  try {
    let cant = req.query["cant"];
    !cant ? (cant = 5) : (cant = parseInt(cant));

    let resultados = [];

    for (let i = 1; i < cant + 1; i++) {
      resultados.push({
        title: commerce.product(),
        price: commerce.price(),
        thumbnail: image.animals(64, 64, true),
      });
    }
    res.send(resultados);
  } catch (error) {
    // Errores lanzados por las apis de mensajes y productos, únicamente (error)
    loggerConsole.error(`${error}`);
    loggerFile.error(`${error}`);
  }
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

///////////////////////// IO / SOCKETS //////////////////////////////

io.on("connection", async (socket) => {
  const productos = await getProducts2();
  const mensajes = await getMessages2();

  console.log("¡Nuevo cliente conectado!");

  // Envio los productos al cliente que se conectó
  socket.emit("productos", productos);
  socket.emit("mensajes", mensajes);

  // Escucho los productos enviados por el cliente y se los propago a todos
  socket.on("producto", async (data) => {
    productos.push(data);
    io.sockets.emit("productos", productos);
  });
  socket.on("mensaje", async (data) => {
    await sendMessage(data);
    const mensajes = await getMessages2();
    io.sockets.emit("mensajes", mensajes);
  });
});

///////////////////////// LOGGER DE RUTAS NO IMPLEMENTADAS //////////////////////////////

// Ruta y método de las peticiones a rutas inexistentes en el servidor (warning)
app.use((req, res) => {
  loggerConsole.warn(
    `Ruta: '${req.originalUrl}' - Método: '${req.method}' - No implementada`
  );
  loggerFile.warn(
    `Ruta: '${req.originalUrl}' - Método: '${req.method}' - No implementada`
  );
  res.json({
    error: -2,
    descripcion: `ruta '${req.originalUrl}' método '${req.method}' no implementada`,
  });
});
