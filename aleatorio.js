const aleatorio = (cantidad) => {
  let objeto = {};
  for (let i = 0; i < cantidad; i++) {
    const random = Math.floor(Math.random() * 1000) + 1;
    const hasKey = objeto.hasOwnProperty(random);
    if (hasKey) {
      objeto[random] += 1;
    } else {
      objeto[random] = 1;
    }
  }
  return objeto;
};

process.on("message", (message) => {
  console.log(`Message from server.js: ${message}`);
  const result = aleatorio(message);
  process.send(result);
  //process.exit();
});

export { aleatorio };
