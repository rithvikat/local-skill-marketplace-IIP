const express = require("express");
const bcrypt = require("bcryptjs");
const Customer = require("../models/customer");

const router = express.Router();

// Customer Registration (Name + Password, no email required)
router.post("/register", async (req, res) => {
    try {
        const { CustomerID, name, mobile, email, address, doorNo, area, district, state, password } = req.body;

        if (!name || !name.trim() || !password) {
            return res.status(400).json({
                message: "Name and password are required"
            });
        }

        const trimmedName = name.trim();
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingCustomer = await Customer.findOne({
            name: { $regex: new RegExp("^" + escapedName + "$", "i") }
        });

        if (existingCustomer) {
            return res.status(400).json({
                message: "A customer account with this name already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const finalCustomerID = CustomerID || ("C" + Date.now().toString().slice(-4) + Math.floor(10 + Math.random() * 90));
        const finalEmail = (email && email.trim()) ? email.trim() : `${finalCustomerID.toLowerCase()}@local.market`;

        const finalDoorNo = (doorNo && doorNo.trim()) ? doorNo.trim() : "";
        const finalArea = (area && area.trim()) ? area.trim() : "";
        const finalDistrict = (district && district.trim()) ? district.trim() : "";
        const finalState = (state && state.trim()) ? state.trim() : "";

        let finalAddress = (address && address.trim()) ? address.trim() : "";
        if (!finalAddress) {
            finalAddress = [finalDoorNo, finalArea, finalDistrict, finalState].filter(Boolean).join(", ");
        }
        if (!finalAddress) finalAddress = "N/A";

        const customer = new Customer({
            CustomerID: finalCustomerID,
            name: trimmedName,
            mobile: (mobile && mobile.trim()) ? mobile.trim() : "N/A",
            email: finalEmail,
            doorNo: finalDoorNo,
            area: finalArea,
            district: finalDistrict,
            state: finalState,
            address: finalAddress,
            passwordHash
        });

        await customer.save();

        res.json({
            message: "Customer registered successfully",
            CustomerID: finalCustomerID
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// Customer Login (Name/Email + Password)
router.post("/login", async (req, res) => {
    try {
        const { name, email, identifier, password } = req.body;
        const loginId = (name || identifier || email || "").trim();

        if (!loginId || !password) {
            return res.status(400).json({
                message: "Name and password are required"
            });
        }

        const escapedId = loginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const customer = await Customer.findOne({
            $or: [
                { name: { $regex: new RegExp("^" + escapedId + "$", "i") } },
                { email: loginId }
            ]
        });

        if (!customer) {
            return res.status(400).json({
                message: "Customer account not found"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            customer.passwordHash
        );

        if (!validPassword) {
            return res.status(400).json({
                message: "Invalid password"
            });
        }

        res.json({
            message: "Login successful",
            customer: {
                CustomerID: customer.CustomerID,
                name: customer.name,
                email: customer.email,
                mobile: customer.mobile || "N/A",
                doorNo: customer.doorNo || "",
                area: customer.area || "",
                district: customer.district || "",
                state: customer.state || "",
                address: customer.address || "N/A",
                role: "customer"
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Customer Profile (Get)
router.get("/profile/:id", async (req, res) => {
    try {
        const customer = await Customer.findOne({ CustomerID: req.params.id }).select("-passwordHash");
        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }
        res.json(customer);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Customer Profile (Update)
router.put("/profile/:id", async (req, res) => {
    try {
        const { name, mobile, address, doorNo, area, district, state } = req.body;
        const customer = await Customer.findOne({ CustomerID: req.params.id });

        if (!customer) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        if (name && name.trim()) {
            const trimmedName = name.trim();
            if (trimmedName.toLowerCase() !== (customer.name || "").toLowerCase()) {
                const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const duplicate = await Customer.findOne({
                    name: { $regex: new RegExp("^" + escapedName + "$", "i") },
                    CustomerID: { $ne: customer.CustomerID }
                });
                if (duplicate) {
                    return res.status(400).json({
                        message: "Another customer with this name already exists"
                    });
                }
            }
            customer.name = trimmedName;
        }

        if (mobile !== undefined) customer.mobile = mobile.trim();
        if (doorNo !== undefined) customer.doorNo = doorNo.trim();
        if (area !== undefined) customer.area = area.trim();
        if (district !== undefined) customer.district = district.trim();
        if (state !== undefined) customer.state = state.trim();

        if (address !== undefined && address.trim()) {
            customer.address = address.trim();
        } else if (doorNo !== undefined || area !== undefined || district !== undefined || state !== undefined) {
            customer.address = [customer.doorNo, customer.area, customer.district, customer.state].filter(Boolean).join(", ");
        }

        await customer.save();

        const updated = customer.toObject();
        delete updated.passwordHash;

        res.json({
            message: "Profile updated successfully",
            customer: updated
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;
