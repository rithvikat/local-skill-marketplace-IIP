require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Customer = require("./models/customer");
const Provider = require("./models/provider");
const Booking = require("./models/booking");
const Review = require("./models/review");
const Message = require("./models/message");

const customerNames = [
    "Aarav Kumar", "Ananya Reddy", "Aditya Sharma", "Sneha Rao",
    "Rahul Verma", "Priya Singh", "Arjun Patel", "Kavya Reddy",
    "Rohan Kumar", "Isha Sharma", "Vikram Rao", "Meera Patel",
    "Karan Singh", "Nisha Kumar", "Sanjay Reddy", "Divya Sharma",
    "Manoj Verma", "Pooja Rao", "Akash Patel", "Neha Singh",
    "Varun Kumar", "Swathi Reddy", "Rakesh Sharma", "Siri Rao",
    "Harsha Patel", "Aishwarya Singh", "Naveen Kumar", "Bhavya Reddy",
    "Suresh Sharma", "Lakshmi Rao", "Abhishek Patel", "Keerthi Singh",
    "Ravi Kumar", "Deepika Reddy", "Chaitanya Sharma", "Mounika Rao",
    "Tarun Patel", "Anjali Singh", "Mahesh Kumar", "Sravya Reddy",
    "Vishal Sharma", "Shreya Rao", "Nikhil Patel", "Pallavi Singh",
    "Sai Kumar", "Tejaswini Reddy", "Manish Sharma", "Ramya Rao",
    "Ajay Patel", "Harini Singh", "Pranav Kumar", "Akshara Reddy",
    "Ritesh Sharma", "Sandhya Rao", "Lokesh Patel", "Varsha Singh",
    "Yash Kumar", "Navya Reddy", "Rohit Sharma", "Tanvi Rao",
    "Surya Patel", "Kritika Singh", "Dinesh Kumar", "Pavani Reddy",
    "Vijay Sharma", "Manasa Rao", "Gaurav Patel", "Riya Singh",
    "Madhav Kumar", "Apoorva Reddy", "Siddharth Sharma", "Shalini Rao",
    "Krishna Patel", "Lavanya Singh", "Abhinav Kumar", "Padmini Reddy",
    "Pradeep Sharma", "Charitha Rao", "Kishore Patel", "Anusha Singh",
    "Raghav Kumar", "Sowmya Reddy", "Mohan Sharma", "Teena Rao",
    "Varun Patel", "Madhuri Singh", "Sandeep Kumar", "Roshni Reddy",
    "Vinay Sharma", "Jyothi Rao", "Raj Patel", "Sahana Singh",
    "Anil Kumar", "Gayathri Reddy", "Vivek Sharma", "Bindu Rao",
    "Ramesh Patel", "Sushmita Singh", "Karthik Kumar", "Nandini Reddy"
];

const providerNames = [
    "Rajesh Kumar", "Suresh Reddy", "Mahesh Sharma", "Ravi Rao",
    "Arun Patel", "Manoj Singh", "Naveen Kumar", "Kiran Reddy",
    "Vijay Sharma", "Prakash Rao", "Ramesh Patel", "Sunil Singh",
    "Anil Kumar", "Harish Reddy", "Mohan Sharma", "Raghu Rao",
    "Deepak Patel", "Srinivas Singh", "Ajay Kumar", "Naresh Reddy",
    "Ganesh Sharma", "Venu Rao", "Rohit Patel", "Santosh Singh",
    "Vinod Kumar", "Chandra Reddy", "Lokesh Sharma", "Pawan Rao",
    "Karthik Patel", "Bharat Singh", "Sanjay Kumar", "Rakesh Reddy",
    "Ashok Sharma", "Madhav Rao", "Tarun Patel", "Dheeraj Singh",
    "Nikhil Kumar", "Sandeep Reddy", "Yogesh Sharma", "Prasad Rao",
    "Manish Patel", "Akshay Singh", "Vishnu Kumar", "Raju Reddy",
    "Shankar Sharma", "Srikanth Rao", "Gopal Patel", "Rahul Singh",
    "Chaitanya Kumar", "Naveen Reddy", "Vamsi Sharma", "Murali Rao",
    "Ritesh Patel", "Uday Singh", "Siva Kumar", "Teja Reddy",
    "Pranav Sharma", "Rohan Rao", "Varun Patel", "Arvind Singh",
    "Suresh Kumar", "Raj Reddy", "Kishore Sharma", "Madan Rao",
    "Vikram Patel", "Harsha Singh", "Aditya Kumar", "Raghav Reddy",
    "Siddharth Sharma", "Pradeep Rao", "Kiran Patel", "Manoj Singh",
    "Ravi Kumar", "Surya Reddy", "Vivek Sharma", "Ganesh Rao",
    "Abhinav Patel", "Rakesh Singh", "Mohan Kumar", "Srinivas Reddy",
    "Dinesh Sharma", "Anil Rao", "Vijay Patel", "Sagar Singh",
    "Karthik Kumar", "Mahesh Reddy", "Rajesh Sharma", "Naveen Rao",
    "Pavan Patel", "Sunil Singh", "Arun Kumar", "Harish Reddy",
    "Madhav Sharma", "Ravi Rao", "Prakash Patel", "Rohit Singh",
    "Sanjay Kumar", "Lokesh Reddy", "Ajay Sharma", "Venu Rao"
];

const services = [
    "Plumbing",
    "Electrical",
    "Home Cleaning",
    "AC Repair",
    "Appliance Repair",
    "Painting",
    "Carpentry",
    "Pest Control",
    "RO Service",
    "Computer Repair"
];

const cities = [
    "Hyderabad",
    "Secunderabad",
    "Kompally",
    "Medchal",
    "Kukatpally",
    "Miyapur",
    "Begumpet",
    "LB Nagar",
    "Uppal",
    "Chittoor"
];

const reviewComments = [
    "Excellent service!",
    "Very professional and punctual.",
    "Good quality work.",
    "Service was completed on time.",
    "Very satisfied with the service.",
    "Friendly and professional.",
    "Good experience overall.",
    "Highly recommended.",
    "Work was completed perfectly.",
    "Great service at a reasonable price."
];

const password = "Demo@123";

function getDate(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);

    return date.toISOString().split("T")[0];
}

async function seedDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected.");

        // ----------------------------------
        // DELETE ALL EXISTING DATA
        // ----------------------------------

        await Customer.deleteMany({});
        await Provider.deleteMany({});
        await Booking.deleteMany({});
        await Review.deleteMany({});
        await Message.deleteMany({});

        console.log("Existing data deleted.");

        // ----------------------------------
        // PASSWORD HASH
        // ----------------------------------

        const passwordHash = await bcrypt.hash(password, 10);

        // ----------------------------------
        // CUSTOMERS - 100
        // ----------------------------------

        const customers = [];

        for (let i = 0; i < 100; i++) {

            customers.push({
                CustomerID: `C${String(i + 1).padStart(3, "0")}`,
                name: customerNames[i],
                mobile: `9${String(700000000 + i)}`,
                email: `customer${i + 1}@gmail.com`,
                address: cities[i % cities.length],
                passwordHash: passwordHash
            });
        }

        await Customer.insertMany(customers);

        console.log("100 customers added.");

        // ----------------------------------
        // PROVIDERS - 100
        // ----------------------------------

        const providers = [];

        for (let i = 0; i < 100; i++) {

            const service1 = services[i % services.length];
            const service2 = services[(i + 3) % services.length];

            providers.push({
                ProviderId: `P${String(i + 1).padStart(3, "0")}`,
                name: providerNames[i],
                mobile: `8${String(600000000 + i)}`,
                email: `provider${i + 1}@gmail.com`,
                address: cities[(i + 2) % cities.length],
                services: [service1, service2],
                experience: (i % 10) + 1,
                availability: i % 2 === 0
                    ? "9 AM - 6 PM"
                    : "10 AM - 7 PM",
                rating: 0,
                passwordHash: passwordHash
            });
        }

        await Provider.insertMany(providers);

        console.log("100 providers added.");

        // ----------------------------------
        // BOOKINGS - 300
        // ----------------------------------

        const bookings = [];

        for (let i = 0; i < 300; i++) {

            const customerNumber = (i % 100) + 1;
            const providerNumber = ((i * 7) % 100) + 1;

            const provider = providers[providerNumber - 1];

            let status;

            if (i % 10 < 5) {
                status = "Completed";
            } else if (i % 10 < 7) {
                status = "Accepted";
            } else if (i % 10 < 9) {
                status = "Pending";
            } else {
                status = "Cancelled";
            }

            bookings.push({
                BookingID: `B${String(i + 1).padStart(3, "0")}`,
                customerId: `C${String(customerNumber).padStart(3, "0")}`,
                providerId: provider.ProviderId,
                service: provider.services[i % provider.services.length],
                date: getDate(i - 20),
                time: i % 2 === 0 ? "11:00 AM" : "3:00 PM",
                status: status
            });
        }

        await Booking.insertMany(bookings);

        console.log("300 bookings added.");

        // ----------------------------------
        // REVIEWS - 150
        // ONLY FOR COMPLETED BOOKINGS
        // ----------------------------------

        const completedBookings = bookings.filter(
            booking => booking.status === "Completed"
        );

        const reviews = [];

        for (let i = 0; i < 150 && i < completedBookings.length; i++) {

            const booking = completedBookings[i];

            reviews.push({
                ReviewId: `R${String(i + 1).padStart(3, "0")}`,
                customerId: booking.customerId,
                providerId: booking.providerId,
                BookingID: booking.BookingID,
                rating: (i % 5) + 1,
                comment: reviewComments[i % reviewComments.length],
                date: booking.date
            });
        }

        await Review.insertMany(reviews);

        console.log(`${reviews.length} reviews added.`);

        // ----------------------------------
        // UPDATE PROVIDER RATINGS
        // ----------------------------------

        for (const provider of providers) {

            const providerReviews = reviews.filter(
                review => review.providerId === provider.ProviderId
            );

            if (providerReviews.length > 0) {

                let total = 0;

                providerReviews.forEach(review => {
                    total += review.rating;
                });

                const average = total / providerReviews.length;

                await Provider.updateOne(
                    { ProviderId: provider.ProviderId },
                    { rating: Number(average.toFixed(1)) }
                );
            }
        }

        console.log("Provider ratings updated.");

        // ----------------------------------
        // MESSAGES - 300
        // ----------------------------------

        const messages = [];

        for (let i = 0; i < 300; i++) {

            const booking = bookings[i % bookings.length];

            const customerMessage = i % 2 === 0;

            messages.push({
                messageid: `M${String(i + 1).padStart(3, "0")}`,
                bookingid: booking.BookingID,
                senderid: customerMessage
                    ? booking.customerId
                    : booking.providerId,
                receiverid: customerMessage
                    ? booking.providerId
                    : booking.customerId,
                message: customerMessage
                    ? "Hello, I would like to discuss the service."
                    : "Sure, I can help you with the service.",
                timestamp: new Date(Date.now() - (i * 3600000))
            });
        }

        await Message.insertMany(messages);

        console.log("300 messages added.");

        // ----------------------------------
        // FINAL SUMMARY
        // ----------------------------------

        console.log("");
        console.log("======================================");
        console.log("DATABASE RESET AND SEED COMPLETED");
        console.log("======================================");
        console.log("Customers : 100");
        console.log("Providers : 100");
        console.log("Bookings  : 300");
        console.log(`Reviews   : ${reviews.length}`);
        console.log("Messages  : 300");
        console.log("");
        console.log("Demo Password:");
        console.log("Demo@123");
        console.log("======================================");

        await mongoose.connection.close();

    } catch (error) {

        console.log("Seed error:", error.message);

        await mongoose.connection.close();
    }
}

seedDatabase();