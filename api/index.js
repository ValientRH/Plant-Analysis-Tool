// File: api/index.js

require("dotenv").config(); // Loads environment variables (for local dev; Vercel uses its own config)
const express = require("express");
const multer = require("multer");
const pdfkit = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

// Configure multer for file upload
// IMPORTANT: On Vercel, only /tmp is writable for serverless functions.
// Files stored here are temporary and will be deleted after the function's execution.
const upload = multer({ dest: "/tmp/" }); // ADJUSTMENT: Use /tmp
app.use(express.json({ limit: "10mb" })); // Increased limit for image data

// Initialize GenAI
// Make sure GeminiApiKey is set as an environment variable in Vercel project settings
const genai = new GoogleGenerativeAI(process.env.GeminiApiKey);

// Routes

// Analyze plant image endpoint
app.post("/api/analyze", upload.single("image"), async (req, res) => { // ADJUSTMENT: Route prefix /api
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please upload an image." });
    }

    const imagePath = req.file.path;
    const imageData = await fsPromises.readFile(imagePath, {
      encoding: "base64",
    });

    // Use the Gemini API to analyze the image
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const result = await model.generateContent([
      "Analyze this plant image and provide detailed analysis of its species, health status, and any potential diseases or pests, its characteristics, how to take care of it and any interesting facts. Please provide the response in plain text without using any markdown formatting",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: imageData,
        },
      },
    ]);
    const plantInfo = result.response.text();

    // Remove the uploaded image from /tmp (good practice, as it's temporary storage)
    await fsPromises.unlink(imagePath)
      .catch(err => console.error("Error deleting temporary image:", err)); // Added error handling

    // Send the response back to the frontend
    res.json({
      result: plantInfo,
      image: `data:${req.file.mimetype};base64,${imageData}`, // Send base64 image back for PDF generation
    });
  } catch (error) {
    console.error("Analysis route error:", error); // Log the full error for debugging
    res
      .status(500)
      .json({ error: "An error occurred while analyzing the image." });
  }
});

// Download PDF report endpoint
app.post("/api/download", express.json(), async (req, res) => { // ADJUSTMENT: Route prefix /api
  const { result, image } = req.body; // Expecting analysis result and base64 image from frontend
  try {
    // Ensure that the temporary directory for reports exists in /tmp
    const reportDir = "/tmp/reports"; // ADJUSTMENT: Use /tmp for reports
    await fsPromises.mkdir(reportDir, { recursive: true });

    // Generate the PDF report
    const filename = `plant_analysis_report_${Date.now()}.pdf`;
    const filePath = path.join(reportDir, filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new pdfkit();
    doc.pipe(writeStream);

    // Add content to the PDF document
    doc.fontSize(20).text("Plant Analysis Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Insert image in PDF if provided (decoded from base64)
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      doc.moveDown();
      doc.image(buffer, {
        fit: [500, 300], // Adjust size as needed
        align: "center",
        valign: "center",
      });
      doc.moveDown(); // Add some space after the image
    }
    
    doc.fontSize(12).text(result, { align: "justify" }); // Adjusted font size for more text to fit
    
    doc.end();

    // Wait for the PDF to be fully written to the temporary file
    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    // Send the generated PDF file for download
    res.download(filePath, (err) => {
      if (err) {
        console.error("PDF download error:", err);
        // Important: Check if headers were already sent to prevent errors
        if (!res.headersSent) {
            res.status(500).send("Failed to download the PDF report.");
        }
      }
      // Remove the generated PDF file from /tmp after sending
      fsPromises.unlink(filePath)
        .catch(unlinkErr => console.error("Error deleting temporary PDF:", unlinkErr)); // Added error handling
    });
  } catch (error) {
    console.error("Download route error:", error); // Log the full error
    res
      .status(500)
      .json({ error: "Failed to generate and download the PDF report." });
  }
});

// For Vercel, you must export the 'app' instance.
// Vercel will automatically convert this Express app into serverless functions.
module.exports = app;

// The app.listen() call is NOT needed when deploying to Vercel
// because Vercel manages the server and port.
const serverless = require("serverless-http");
module.exports = serverless(app);
