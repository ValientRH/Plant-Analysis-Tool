require("dotenv").config();
const express = require("express");
const multer = require("multer");
const pdfkit = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 5000;

//configure multer for file upload
const upload = multer({ dest: "upload/" });
app.use(express.json({ limit: "10mb" }));

//initilize genai
const genai = new GoogleGenerativeAI(process.env.GeminiApiKey);
app.use(express.static("public"));

//routes

//analyze
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Pleasr upload an image" });
    }
    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });
    //Use the gemini api to analyze the image
    const model = genai.getGenerativeModel({
      model: "gemini-2.3-flash",
    });
    const results = await model.generateContent([
      "Analyze this plant image and provide detailed analysis of its species, health status, and any potential diseases or pests, its characteristics, how to take care of it and any interesting facts. Please provide the response in plain text without using any markdown formatting",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imageData,
        },
      },
    ]);
    const plantInfo = results.response.text();
    // remove the uploaded image
    await fsPromises.unlink(imagePath);
    // send the response 
    res.json({ results: plantInfo, image: `data:${req.file.mimetype};base64,${imageData}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/download", async (req, res) => {
  res.json({ success: true });
});

//start the serve
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
