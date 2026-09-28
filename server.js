// =========================================================
// WEATHERGPT - GEMINI CHATBOT SERVER
// =========================================================

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenAI } = require("@google/genai");

const app = express();


// =========================================================
// CONFIGURATION
// =========================================================

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing from .env");
    process.exit(1);
}


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors());

app.use(express.json({
    limit: "20mb"
}));


// =========================================================
// GEMINI SETUP
// =========================================================

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const transcriptionAI = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});

const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash"
});


// =========================================================
// WEATHERGPT HTML PAGE
// =========================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "indexGpt(1).html"
        )
    );

});


// =========================================================
// VOICE TRANSCRIPTION ROUTE
// MICROPHONE FEATURE
// =========================================================

app.post("/api/transcribe", async (req, res) => {

    try {

        const { audio, mimeType } = req.body;

        console.log(
            "🎤 Voice transcription request received"
        );


        if (!audio || typeof audio !== "string") {

            return res.status(400).json({

                success: false,

                error:
                    "No audio recording was received."

            });

        }


        console.log(
            "🎤 MIME type:",
            mimeType
        );

        console.log(
            "🎤 Base64 length:",
            audio.length
        );


        // -------------------------------------------------
        // Convert Base64 audio to a temporary file
        // -------------------------------------------------

        const fs = require("fs");
        const os = require("os");


        const audioBuffer =
            Buffer.from(
                audio,
                "base64"
            );


        const extension =
            mimeType &&
            mimeType.includes("ogg")
                ? ".ogg"
                : ".webm";


        const tempFile =
            path.join(
                os.tmpdir(),
                `weathergpt_voice_${Date.now()}${extension}`
            );


        fs.writeFileSync(
            tempFile,
            audioBuffer
        );


        console.log(
            "🎤 Audio file created:",
            tempFile
        );


        // -------------------------------------------------
        // Upload audio using Gemini Files API
        // -------------------------------------------------

        console.log(
            "🎤 Uploading audio to Gemini..."
        );


        const audioFile =
            await transcriptionAI.files.upload({

                file:
                    tempFile,

                config: {

                    mime_type:
                        mimeType ||
                        "audio/webm"

                }

            });


        console.log(
            "✅ Audio uploaded to Gemini"
        );


        console.log(
            "🎤 File URI:",
            audioFile.uri
        );


        // -------------------------------------------------
        // Transcribe using Gemini 3.5 Transcribe
        // -------------------------------------------------

        console.log(
            "🎤 Starting transcription..."
        );


        const interaction =
            await transcriptionAI.interactions.create({

                model:
                    "gemini-3.5-transcribe",

                input: [

                    {

                        type:
                            "audio",

                        uri:
                            audioFile.uri,

                        mime_type:
                            audioFile.mimeType

                    }

                ],

                generation_config: {

                    transcription_config: {

                        language_codes: [

                            "en-IN",

                            "en-US"

                        ]

                    }

                }

            });


        console.log(
            "✅ Gemini transcription completed"
        );


        const transcript =
            interaction.output_text
                ? interaction.output_text.trim()
                : "";


        console.log(
            "🎤 Transcript:",
            transcript
        );


        // -------------------------------------------------
        // Delete temporary file
        // -------------------------------------------------

        try {

            fs.unlinkSync(
                tempFile
            );

        }

        catch (deleteError) {

            console.log(
                "⚠️ Could not delete temporary file."
            );

        }


        // -------------------------------------------------
        // Check transcript
        // -------------------------------------------------

        if (!transcript) {

            return res.status(422).json({

                success: false,

                error:
                    "Gemini could not detect speech."

            });

        }


        // -------------------------------------------------
        // Return transcript to frontend
        // -------------------------------------------------

        res.json({

            success: true,

            transcript:
                transcript

        });

    }

    catch (error) {

        console.error("");

        console.error(
            "======================================"
        );

        console.error(
            "❌ VOICE TRANSCRIPTION ERROR"
        );

        console.error(
            "======================================"
        );

        console.error(
            error
        );

        console.error(
            error?.message
        );

        console.error(
            error?.stack
        );

        console.error(
            "======================================"
        );


        res.status(500).json({

            success: false,

            error:
                error?.message ||
                "Voice transcription failed."

        });

    }

});


// =========================================================
// GEMINI CHAT ROUTE
// =========================================================

app.post("/api/chat", async (req, res) => {

    try {

        const {
            message,
            weatherData
        } = req.body;


        // -------------------------------------------------
        // Validate message
        // -------------------------------------------------

        if (
            !message ||
            typeof message !== "string"
        ) {

            return res.status(400).json({

                error:
                    "Please provide a valid message."

            });

        }


        // -------------------------------------------------
        // Weather information from your Open-Meteo API
        // -------------------------------------------------

        let weatherContext = "";


        if (weatherData) {

            weatherContext = `
CURRENT WEATHER DATA:

Location: ${weatherData.location || "Unknown"}

Temperature:
${weatherData.temperature ?? "Unknown"} °C

Feels Like:
${weatherData.feels ?? "Unknown"} °C

Humidity:
${weatherData.humidity ?? "Unknown"} %

Wind Speed:
${weatherData.wind ?? "Unknown"} km/h

Rain Probability:
${weatherData.rain ?? "Unknown"} %

Visibility:
${weatherData.visibility ?? "Unknown"} km

UV Index:
${weatherData.uv ?? "Unknown"}

Condition:
${weatherData.condition || "Unknown"}

Use this weather data when answering questions about
current weather conditions.
`;

        }


        // -------------------------------------------------
        // WeatherGPT system instructions
        // -------------------------------------------------

        const prompt = `

You are WeatherGPT, an intelligent conversational
weather assistant.

Your job is to help users understand weather,
forecasts, rainfall, temperature, humidity, wind,
UV index, visibility, travel conditions, farming
conditions and weather alerts.

IMPORTANT RULES:

1. Be conversational and friendly.

2. Understand natural language.

3. Correct spelling mistakes when possible.

4. Understand different ways of asking the same question.

Examples:

"will it rain?"

"is there any chance of rain?"

"should I take an umbrella?"

"rain condition?"

These can all refer to rainfall.

5. If the user greets you, respond naturally.

Examples:

"Hi"
"Hello"
"Hey"
"Good morning"
"Good evening"

6. Do NOT invent live weather information.

7. If current weather data is provided below,
use it when answering weather questions.

8. If the user asks about a different city and
there is no weather data for that city, clearly
say that live data for that city has not been
provided instead of making up information.

9. Give simple explanations that a normal user
can understand.

10. For safety-related weather questions such as
storms, floods, extreme heat or severe weather,
recommend checking official weather warnings.

11. Do not claim to be a human.

12. Keep answers reasonably concise unless the
user asks for detailed information.

13. You can answer general weather-related questions
even when the user does not use exact weather
terminology.

14. If the question is not related to weather,
you can still answer normally, but briefly remind
the user that WeatherGPT is primarily a weather
assistant when appropriate.

${weatherContext}

USER QUESTION:

${message}

Give the best possible answer.
`;


        // -------------------------------------------------
        // Generate Gemini response
        // -------------------------------------------------

        const result =
            await model.generateContent(
                prompt
            );


        const response =
            result.response;


        const text =
            response.text();


        // -------------------------------------------------
        // Send response to frontend
        // -------------------------------------------------

        res.json({

            success: true,

            reply:
                text

        });

    }

    catch (error) {

        console.error(
            "❌ Gemini API Error:"
        );

        console.error(
            error
        );


        res.status(500).json({

            success: false,

            error:
                "Unable to get a response from Gemini.",

            details:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined

        });

    }

});


// =========================================================
// START SERVER
// =========================================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "======================================"
        );

        console.log(
            "      WeatherGPT AI Server"
        );

        console.log(
            "======================================"
        );

        console.log(
            `🚀 Server running on port ${PORT}`
        );

        console.log(
            `🤖 Gemini model: gemini-3.6-flash`
        );

        console.log(
            "🎤 Voice transcription: enabled"
        );

        console.log(
            "🌦️ Open-Meteo can be used by frontend"
        );

        console.log(
            "🌐 WeatherGPT page: http://localhost:" +
            PORT
        );

        console.log(
            "======================================"
        );

        console.log("");

    }
);