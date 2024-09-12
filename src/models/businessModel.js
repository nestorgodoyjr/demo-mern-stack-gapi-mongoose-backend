import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema({
  place_id: { type: String, unique: true, required: true },
  name: { type: String },
  formatted_address: { type: String },
  formatted_phone_number: { type: String },
  rating: { type: Number },
  user_ratings_total: { type: Number },
  website: { type: String },
  types: [{ type: String }], // Array of types (categories)
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' }, // Longitude, Latitude with geospatial indexing
  },
  opening_hours: {
    open_now: { type: Boolean },
  },
  // Automatically managed fields
  createdAt: { type: Date, default: Date.now }, // Created at date
  updatedAt: { type: Date, default: Date.now }, // Updated at date
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }, // Automatically handle createdAt and updatedAt
});

const Business = mongoose.model('Business', businessSchema);

export default Business;
