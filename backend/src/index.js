import app from "./app.js";
import dbConnect from "./db/index.js";
import env from "dotenv";
env.config();



dbConnect()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server runnung at port ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("MongoDB connection Failed");
})