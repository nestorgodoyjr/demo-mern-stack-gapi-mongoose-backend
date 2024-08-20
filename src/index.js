import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import axios from 'axios';
import cors from 'cors';
import { authenticateUser } from './middleware/authMiddleware.js';
import { appendToGoogleSheet } from './services/googleSheetService.js';
import userRoutes from './routes/userRoutes.js';
import businessRoutes from './routes/businessRoutes.js';
import Business from './models/businessModel.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

app.post('/api/email', async (req, res) => {
    const { email, subject, message } = req.body;

    const transporter = nodemailer.createTransport({
        service: 'gmail', //Only upto 500 mails
        host: 'smtp.gmail.com',
        secure: false, 
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject,
        text: message
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully', info });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Error sending email', error: error.message });
    }
});

app.use('/api/users', userRoutes);
app.use('/api/businesses', businessRoutes);

app.get('/api/places', async (req, res) => {
    const { type, location } = req.query;
    if (!type || !location) {
        return res.status(400).send('Type and location are required');
    }
    console.log(type, location);

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
        await Business.insertMany(detailedPlaces); //Problem now!!!!

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
