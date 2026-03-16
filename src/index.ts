import { Hono } from 'hono'
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { auth } from "./lib/auth"; // path to your auth file
import { cors } from "hono/cors";

const app = new Hono()

app.use(
  '/api/auth/*', // or replace with "*" to enable cors for all routes
  cors({
    origin: 'http://localhost:3000', // replace with your origin
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
);

app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw)).get('/',(c)=>{
  return c.text('Hello Hono!');
});
export default app;


