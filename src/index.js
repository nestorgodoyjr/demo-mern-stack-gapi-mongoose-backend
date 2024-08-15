import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import { google } from 'googleapis';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI;

// Define a Mongoose schema for the business data
const businessSchema = new mongoose.Schema({
    name: String,
    formatted_address: String,
    formatted_phone_number: String,
    website: String,
    rating: Number,
    user_ratings_total: Number,
    opening_hours: Object,
    price_level: Number,
    icon: String
});

const Business = mongoose.model('Business', businessSchema);

// Google Sheets API setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const credentialsPath = 'credentials.json';

// Function to authenticate and get Google Sheets client
async function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: SCOPES,
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    return sheets;
}

// Function to add data to Google Sheets
async function appendToGoogleSheet(data) {
    const sheets = await getSheetsClient();

    const resource = {
        values: data.map(business => [
            business.name,
            business.formatted_address,
            business.formatted_phone_number || 'N/A',
            business.website || 'N/A',
            business.rating || 'N/A',
            business.user_ratings_total || 'N/A',
            business.price_level !== undefined ? business.price_level : 'N/A', // Still need to understand this code
            business.opening_hours?.open_now ? 'Open' : 'Closed',
        ]),
    };

    // Need to review this code for future changes
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A2', 
        valueInputOption: 'RAW',
        resource,
    });
}

mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(() => {
        console.log('Connected to MongoDB');
    }).catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });

app.get('/api/places', async (req, res) => {
    const { type, location } = req.query;
    if (!type || !location) {
        return res.status(400).send('Type and location are required');
    }

    try {
        // Get the basic place details
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
            params: {
                query: `${type} in ${location}`,
                key: process.env.GOOGLE_API_KEY
            }
        });

        const places = response.data.results;

        // Fetch detailed information for each place
        const detailedPlaces = await Promise.all(places.map(async place => {
            const placeDetails = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
                params: {
                    place_id: place.place_id,
                    key: process.env.GOOGLE_API_KEY,
                    fields: 'name,formatted_address,formatted_phone_number,website,rating,opening_hours,user_ratings_total,icon'
                }
            });
            return placeDetails.data.result;
        }));

        // Push data to Google Sheets
        await appendToGoogleSheet(detailedPlaces);

        // Save data to MongoDB using Mongoose
        await Business.insertMany(detailedPlaces);

        // For Troubleshooting
        // console.log(detailedPlaces);

        res.json(detailedPlaces);
    } catch (error) {
        console.error('Error fetching data from Google Places API:', error);
        res.status(500).send('Error fetching data from Google Places API');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
