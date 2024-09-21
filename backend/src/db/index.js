import mongoose from "mongoose"
import { db_name } from "../constants.js";

const dbConnect=async ()=>{
    try {
        const dbConnectionInstance=await mongoose.connect(`${process.env.MONGODB_URL}/${db_name}`);

        console.log("DB connection successfully");
        // console.log(dbConnectionInstance);
    } catch (error) {
        console.log("error: "+error);
    }
}

export default dbConnect;