const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema({
    ProviderId: {
        type: String,
        unique: true
    },
    name: String,
    mobile: String,
    passwordHash: String,
    email: {
        type: String,
        sparse: true
    },
    doorNo: String,
    area: String,
    district: String,
    state: String,
    pincode: String,
    pinCode: String,
    address: String,
    services: [String],
    experience: Number,
    availability: String,
    isAvailable: {
        type: Boolean,
        default: true
    },
    manualStatus: {
        type: String,
        enum: ["Available", "Unavailable", "Auto"],
        default: "Auto"
    },
    rating: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Provider", providerSchema);
