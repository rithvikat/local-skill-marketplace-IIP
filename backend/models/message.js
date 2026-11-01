const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    messageid: {
        type: String,
        unique: true
    },
    bookingid: String,
    senderid: String,
    receiverid: String,
    message: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Message", messageSchema);