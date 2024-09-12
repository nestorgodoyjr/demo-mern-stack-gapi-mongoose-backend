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
import session from 'express-session';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(session({
  secret: 'sessionsecret777',
  cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7
  },
  resave: false,
  saveUninitialized: true,
  // store: store,
}));
app.use(express.json());


mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

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
    // Step 1: Geocode the location name to get latitude and longitude
    const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: location,
        key: process.env.GOOGLE_API_KEY
      }
    });

    if (geocodeResponse.data.status !== 'OK') {
      return res.status(400).send('Error geocoding location');
    }

    const { lat, lng } = geocodeResponse.data.results[0].geometry.location;

    let places = [];
    let nextPageToken = null;
    let queriesRemaining = 50;

    // Step 2: Fetch data from Google Places API with pagination
    while (queriesRemaining > 0) {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: `${type} in ${location}`,
          location: `${lat},${lng}`,
          radius: 10000, // Define your radius in meters
          key: process.env.GOOGLE_API_KEY,
          pagetoken: nextPageToken || undefined
        }
      });

      places = places.concat(response.data.results);
      nextPageToken = response.data.next_page_token;

      if (!nextPageToken) break;

      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait for the next page token to be valid
      queriesRemaining--;
    }

    const uniquePlaces = Array.from(new Map(places.map(place => [place.place_id, place])).values());

    // Step 3: Fetch additional details for each place
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

    // Bulk operations for updating or inserting new places
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

    // Step 4: Paginate the results from the Google Places API response
    const paginatedPlaces = detailedPlaces.slice((pageNumber - 1) * resultsPerPageInt, pageNumber * resultsPerPageInt);

    res.json({
      data: paginatedPlaces,
      total: detailedPlaces.length,
      page: pageNumber,
      limit: resultsPerPageInt,
    });

  } catch (error) {
    console.error('Error fetching or saving data:', error);
    res.status(500).send('Error fetching or saving data');
  }
});

// Function to calculate distance between two coordinates
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    0.5 - Math.cos(dLat) / 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    (1 - Math.cos(dLon)) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

  

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
