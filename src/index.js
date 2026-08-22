const { server } = require('./http_server');

const port = Number(process.env.PORT || 3000);
const app = server();

if (require.main === module) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Corpus API listening on ${port}`);
  });
}

module.exports = app;
