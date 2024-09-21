import dbConnect from "./db/index.js";
import env from "dotenv";
env.config();



dbConnect();