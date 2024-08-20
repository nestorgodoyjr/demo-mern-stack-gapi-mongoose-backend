import mongoose from 'mongoose';

const businessSchema = new mongoose.Schema({
    name: { type: String, required: true },
    name: String,
    formatted_address: String,
    formatted_phone_number: String,
    website: String,
    rating: Number,
    user_ratings_total: Number,
    opening_hours: Object,
    price_level: Number,
    icon: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Reference to the user who added the business
});

const Business = mongoose.model('Business', businessSchema);

export default Business;
