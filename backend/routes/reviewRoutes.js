const express = require("express");
const Review = require("../models/review");
const Booking = require("../models/booking");
const Provider = require("../models/provider");
const Customer = require("../models/customer");

const router = express.Router();

// Add Review
router.post("/add", async (req, res) => {
    try {
        const {
            ReviewId,
            customerId,
            providerId,
            BookingID,
            rating,
            comment
        } = req.body;

        // Check booking
        const booking = await Booking.findOne({ BookingID });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // Verify that customer is the one who created this booking
        if (customerId && booking.customerId !== customerId) {
            return res.status(403).json({
                message: "Only the customer who created this booking can review it"
            });
        }

        // Review only after completion
        if (booking.status !== "Completed") {
            return res.status(400).json({
                message: "Review allowed only after completed service"
            });
        }

        // Prevent duplicate review for the same booking
        const existingReview = await Review.findOne({ BookingID });
        if (existingReview) {
            return res.status(400).json({
                message: "You have already submitted a review for this booking"
            });
        }

        const customer = await Customer.findOne({ CustomerID: booking.customerId }).select("name");
        const finalCustomerName = customer?.name || booking.customerName || "Verified Customer";

        const finalReviewId = ReviewId || ("R" + Date.now().toString().slice(-4) + Math.floor(10 + Math.random() * 90));

        const review = new Review({
            ReviewId: finalReviewId,
            customerId: booking.customerId,
            customerName: finalCustomerName,
            providerId: booking.providerId || providerId,
            BookingID,
            rating: Number(rating) || 5,
            comment: comment || "",
            date: new Date().toISOString().split("T")[0]
        });

        await review.save();

        // Update provider rating
        const targetProviderId = booking.providerId || providerId;
        const reviews = await Review.find({ providerId: targetProviderId });

        let total = 0;
        reviews.forEach(r => {
            total += r.rating;
        });

        const averageRating = reviews.length > 0 ? Number((total / reviews.length).toFixed(1)) : 0;

        await Provider.findOneAndUpdate(
            { ProviderId: targetProviderId },
            { rating: averageRating }
        );

        res.json({
            message: "Review added successfully",
            rating: averageRating
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Get Reviews (by providerId or BookingID query params, or all)
router.get("/", async (req, res) => {
    try {
        const { providerId, BookingID, customerId } = req.query;
        let query = {};
        if (providerId) query.providerId = providerId;
        if (BookingID) query.BookingID = BookingID;
        if (customerId) query.customerId = customerId;

        const reviews = await Review.find(query).sort({ _id: -1 }).lean();
        const custIds = [...new Set(reviews.map(r => r.customerId).filter(Boolean))];
        const customers = await Customer.find({ CustomerID: { $in: custIds } }).select("CustomerID name").lean();
        const custMap = {};
        customers.forEach(c => { custMap[c.CustomerID] = c.name; });

        const enriched = reviews.map(r => ({
            ...r,
            customerName: r.customerName || custMap[r.customerId] || r.customerId || "Verified Customer"
        }));

        res.json(enriched);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Get Reviews by ProviderId path param
router.get("/:providerId", async (req, res) => {
    try {
        const reviews = await Review.find({ providerId: req.params.providerId }).sort({ _id: -1 }).lean();
        const custIds = [...new Set(reviews.map(r => r.customerId).filter(Boolean))];
        const customers = await Customer.find({ CustomerID: { $in: custIds } }).select("CustomerID name").lean();
        const custMap = {};
        customers.forEach(c => { custMap[c.CustomerID] = c.name; });

        const enriched = reviews.map(r => ({
            ...r,
            customerName: r.customerName || custMap[r.customerId] || r.customerId || "Verified Customer"
        }));

        res.json(enriched);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;
