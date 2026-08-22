import { server } from './http_server.js';
const port=Number(process.env.PORT||3000);
const app=server();
if(process.argv[1]===new URL(import.meta.url).pathname) app.listen(port,'0.0.0.0',()=>console.log(`Corpus API listening on ${port}`));
export default app;
