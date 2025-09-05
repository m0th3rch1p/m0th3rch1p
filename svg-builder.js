// @ts-check
import fs from 'fs';
import got from 'got';
import Qty from 'js-quantities';
import { formatDistance } from 'date-fns';

// Open-Meteo doesn't require an API key for basic use in server-side applications
// const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// Open-Meteo API base URL (without trailing slash)
const WEATHER_BASE_URL = 'https://api.open-meteo.com';

// WMO Weather codes used by Open-Meteo
// Mapped to emojis based on the descriptions
const emojis = {
    0: '☀️', // Clear sky
    1: '☀️', // Mainly clear
    2: '🌤', // Partly cloudy
    3: '☁️', // Overcast
    45: '🌫', // Fog
    48: '🌫', // Depositing rime fog
    51: '🌦', // Light drizzle
    53: '🌦', // Moderate drizzle
    55: '🌦', // Dense drizzle
    56: '🌧', // Light freezing drizzle
    57: '🌧', // Dense freezing drizzle
    61: '🌦', // Slight rain
    63: '🌧', // Moderate rain
    65: '🌧', // Heavy rain
    66: '🌧', // Light freezing rain
    67: '🌧', // Heavy freezing rain
    71: '🌨', // Slight snow fall
    73: '❄️', // Moderate snow fall
    75: '❄️', // Heavy snow fall
    77: '❄️', // Snow grains
    80: '🌦', // Slight rain showers
    81: '🌧', // Moderate rain showers
    82: '🌧', // Violent rain showers
    85: '🌨', // Slight snow showers
    86: '🌨', // Heavy snow showers
    95: '⛈', // Thunderstorm
    96: '⛈', // Thunderstorm with slight hail
    99: '⛈'  // Thunderstorm with heavy hail
};

// Cheap, janky way to have variable bubble width
const dayBubbleWidths = {
    Monday: 235,
    Tuesday: 235,
    Wednesday: 260,
    Thursday: 245,
    Friday: 220,
    Saturday: 245,
    Sunday: 230,
};

// AccuWeather used 2020, 12, 14 -> JS Date month 11 (December)
const todayDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today);


// --- Location Settings ---
// Coordinates for San Francisco (example, replace as needed)
// AccuWeather location key '18363_PC' roughly corresponds to San Francisco
const latitude = -1.213066726789292;
const longitude = 36.75178648764836;

// --- Open-Meteo API Call ---
// Path part of the URL (WITHOUT the leading slash)
// Request daily forecast for weather code and max temperature
const apiPath = `v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;

// Use got with prefixUrl for the base, and apiPath for the path
got(apiPath, { prefixUrl: WEATHER_BASE_URL })
    .then((response) => {
        let json;
        try {
             json = JSON.parse(response.body);
        } catch (parseError) {
            console.error("Error parsing JSON response:", parseError.message);
            console.error("Response body:", response.body);
            return;
        }


        // Check if the expected data structure exists
        if (!json.daily || !Array.isArray(json.daily.weather_code) || json.daily.weather_code.length === 0) {
             console.error("Unexpected API response structure or no data available:", json);
             // Handle error or use defaults
             return;
        }

        // Access the first day's forecast (today)
        const weatherCode = json.daily.weather_code[0];
        // Open-Meteo provides temperature in Celsius by default
        const degC = Math.round(json.daily.temperature_2m_max[0]);
        // Convert Celsius to Fahrenheit using js-quantities
        // Ensure Qty handles the conversion correctly, or use manual formula
        let degF;
        try {
            degF = Math.round(Qty(`${degC} tempC`).to('tempF').scalar);
        } catch (conversionError) {
            console.error("Error converting temperature:", conversionError.message);
            // Fallback manual conversion if js-quantities fails
            degF = Math.round((degC * 9/5) + 32);
        }


        // Get the corresponding emoji
        const weatherEmoji = emojis[weatherCode] ?? '❓'; // Use nullish coalescing for default

        fs.readFile('template.svg', 'utf-8', (error, data) => {
            if (error) {
                console.error("Error reading template.svg:", error);
                return;
            }

            // Ensure data is a string before replacing
            if (typeof data !== 'string') {
                 console.error("Template data is not a string");
                 return;
            }

            // Replace placeholders in the SVG template
            // Use global replacement in case placeholders appear multiple times
            data = data.replace(/{degF}/g, degF);
            data = data.replace(/{degC}/g, degC);
            data = data.replace(/{weatherEmoji}/g, weatherEmoji);
            data = data.replace(/{psTime}/g, psTime);
            data = data.replace(/{todayDay}/g, todayDay);
            data = data.replace(/{dayBubbleWidth}/g, dayBubbleWidths[todayDay] ?? 235); // Default width if day not found

            fs.writeFile('chat.svg', data, (err) => {
                if (err) {
                    console.error("Error writing chat.svg:", err);
                    return;
                }
                console.log("SVG generated successfully: chat.svg");
            });
        });
    })
    .catch((err) => {
        // Improved error handling
        console.error("Error fetching or processing weather data:");
        if (err.response) {
            // Server responded with error status
            console.error(`HTTP Status: ${err.response.statusCode}`);
            console.error(`Response Body: ${err.response.body}`);
        } else if (err.request) {
            // Request was made but no response received
            console.error("No response received from server:", err.request);
        } else {
            // Something else happened
            console.error("General error:", err.message);
        }
    });
