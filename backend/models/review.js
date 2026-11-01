const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    ReviewId: {
        type: String,
        unique: true
    },
    customerId: String,
    customerName: String,
    providerId: String,
    BookingID: String,
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    comment: String,
    date: String
});

module.exports = mongoose.model("Review", reviewSchema);
