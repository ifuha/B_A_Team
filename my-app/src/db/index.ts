import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { relations } from "./relations";

const poolConnection = mysql.createPool({
  uri: process.env.DATABASE_URL!,
  connectionLimit: 10,
});

export const db = drizzle({
  client: poolConnection,
  relations,
});

export type DB = typeof db;
