require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pdfkit = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const {GoogleGenerativeAI}  = require("@google/generative-ai");


const app = express();
const port = process.env.PORT || 5000;

//configure multer for file upload
const upload = multer({dest: "upload/"});
app.use(express.json({limit: "10mb"}));

//initilize genai
const genai = new GoogleGenerativeAI(process.env.GeminiApiKey);
app.use(express.static("public"));

//routes
app.post('/analyze', async(req, res)=>{
    res.json({ success: true });
})
app.post('/download', async(req, res)=>{
    res.json({ success: true });
})

//start the serve
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});