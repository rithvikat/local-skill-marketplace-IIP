const express = require("express");
const Message = require("../models/message");

const router = express.Router();

// Save Message
router.post("/send", async (req, res) => {
    try {
        const {
            messageid,
            bookingid,
            senderid,
            receiverid,
            message
        } = req.body;

        const finalMessageId = messageid || ("M" + Date.now().toString().slice(-4) + Math.floor(10 + Math.random() * 90));

        const newMessage = new Message({
            messageid: finalMessageId,
            bookingid,
            senderid,
            receiverid,
            message
        });

        await newMessage.save();

        const io = req.app.get("io");
        if (io) {
            io.to(bookingid).emit("receiveMessage", newMessage);
        }

        res.json({
            message: "Message saved successfully",
            data: newMessage
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Get messages for a booking
router.get("/:bookingid", async (req, res) => {
    try {
        const messages = await Message.find({
            bookingid: req.params.bookingid
        }).sort({ timestamp: 1 });

        res.json(messages);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;