const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    BookingID: {
        type: String,
        unique: true
    },
    customerId: String,
    providerId: String,
    service: String,
    date: String,
    time: String,
    status: {
        type: String,
        enum: ["Pending", "Accepted", "Completed", "Cancelled"],
        default: "Pending"
    },
    customerName: String,
    providerName: String,
    customerMobile: String,
    customerDoorNo: String,
    customerArea: String,
    customerDistrict: String,
    customerState: String,
    customerAddress: String
});

module.exports = mongoose.model("Booking", bookingSchema);
