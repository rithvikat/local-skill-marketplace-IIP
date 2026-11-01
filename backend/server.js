const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dns = require("dns");
try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
    console.log("DNS setServers notice:", e.message);
}

const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");

const customerRoutes = require("./routes/customerRoutes");
const providerRoutes = require("./routes/providerRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const searchRoutes = require("./routes/searchRoutes");
const messageRoutes = require("./routes/messageRoutes");

const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.set("io", io);

app.use(cors());
app.use(express.json());
app.use("/frontend", express.static(path.join(__dirname, "../frontend")));

// APIs
app.use("/api/customers", customerRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/messages", messageRoutes);

// Home
app.get("/", (req, res) => {
    res.send('<!DOCTYPE html><html><head><title>Local Skill Marketplace Backend</title></head><body style="font-family:sans-serif;padding:40px;line-height:1.6"><h1>Local Skill Marketplace Backend is Running!</h1><p><a href="/frontend/index.html" style="font-size:1.2rem;color:#2563eb;font-weight:bold">&rarr; Open Frontend Marketplace</a></p></body></html>');
});

// Live Chat
io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    socket.on("joinRoom", (bookingid) => {
        socket.join(bookingid);
    });

    socket.on("sendMessage", async (data) => {
    try {
        const Message = require("./models/message");

        const newMessage = new Message({
            messageid: data.messageid || ("M" + Date.now().toString().slice(-4) + Math.floor(10 + Math.random() * 90)),
            bookingid: data.bookingid,
            senderid: data.senderid,
            receiverid: data.receiverid,
            message: data.message
        });

        await newMessage.save();

        io.to(data.bookingid).emit("receiveMessage", newMessage);

    } catch (error) {
        console.log("Message error:", error.message);
    }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });

});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const connectDB = () => {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => {
            console.log("MongoDB Atlas connected successfully");
        })
        .catch((error) => {
            console.log("MongoDB connection error:", error.message);
            console.log("Retrying MongoDB connection in 5 seconds...");
            setTimeout(connectDB, 5000);
        });
};

connectDB();
