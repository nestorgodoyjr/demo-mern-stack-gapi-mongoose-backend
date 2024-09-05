import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import axios from 'axios';
import cors from 'cors';
import { parse } from 'json2csv';
import Business from './models/businessModel.js';
import userRoutes from './routes/userRoutes.js';
import businessRoutes from './routes/businessRoutes.js';

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

// Create and export the transporter
export const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  secure: false,  // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.post('/api/email', async (req, res) => {
  const { email, subject, message } = req.body;

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
    const { type, location, page = 1, limit: resultsPerPage = 10 } = req.query;
  
    if (!type || !location) {
      return res.status(400).send('Type and location are required');
    }
  
    const pageNumber = parseInt(page, 10);
    const resultsPerPageInt = parseInt(resultsPerPage, 10);
  
    if (pageNumber < 1 || resultsPerPageInt < 1) {
      return res.status(400).send('Invalid pagination parameters');
    }
  
    try {
      let places = [];
      let nextPageToken = null;
      let queriesRemaining = 50;
  
      while (queriesRemaining > 0) {
        const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
          params: {
            query: `${type} in ${location}`,
            key: process.env.GOOGLE_API_KEY,
            pagetoken: nextPageToken || undefined
          }
        });
  
        places = places.concat(response.data.results);
        nextPageToken = response.data.next_page_token;
  
        if (!nextPageToken) break;
  
        await new Promise(resolve => setTimeout(resolve, 2500));
        queriesRemaining--;
      }
  
      const uniquePlaces = Array.from(new Map(places.map(place => [place.place_id, place])).values());
  
      // Fetch additional details for each place
      const detailedPlaces = await Promise.all(uniquePlaces.map(async place => {
        try {
          const detailsResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: {
              place_id: place.place_id,
              key: process.env.GOOGLE_API_KEY
            }
          });
          return { ...place, ...detailsResponse.data.result };
        } catch (error) {
          console.error(`Error fetching details for place ${place.place_id}:`, error);
          return place; // Return place data even if details are not available
        }
      }));
  
      const bulkOps = detailedPlaces.map(place => ({
        updateOne: {
          filter: { place_id: place.place_id },
          update: { $set: place },
          upsert: true
        }
      }));
  
      if (bulkOps.length > 0) {
        await Business.bulkWrite(bulkOps);
      }
  
      const businesses = await Business.find()
        .skip((pageNumber - 1) * resultsPerPageInt)
        .limit(resultsPerPageInt)
        .exec();
  
      const total = await Business.countDocuments().exec();
      
      res.json({
        data: businesses,
        total,
        page: pageNumber,
        limit: resultsPerPageInt,
      });
  
    } catch (error) {
      console.error('Error fetching or saving data:', error);
      res.status(500).send('Error fetching or saving data');
    }
  });
  

app.get('/api/export', async (req, res) => {
  try {
    const businesses = await Business.find({}).exec();

    const businessesInfo = businesses.map(business => {
      const { _id, opening_hours, icon, __v, ...rest } = business.toObject();
      return rest;
    });

    const csv = parse(businessesInfo);

    // Send CSV directly in response
    res.setHeader('Content-disposition', 'attachment; filename=businesses.csv');
    res.setHeader('Content-type', 'text/csv');
    res.send(csv);

  } catch (error) {
    console.error('Error exporting data to CSV:', error);
    res.status(500).send('Error exporting data');
  }
});

const router = express.Router();

router.get('/all-data', async (req, res) => {
  try {
    const businesses = await Business.find();
    // const businesses = await Business.find({}, { formatted_phone_number: 1, website: 1, name: 1 });
    console.log(businesses);

    res.json(businesses);
  } catch (error) {
    console.error('Error fetching all data:', error);
    res.status(500).json({ message: 'Error fetching all data' });
  }
});

app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
