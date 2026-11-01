const express = require("express");
const bcrypt = require("bcryptjs");
const Provider = require("../models/provider");

const router = express.Router();

// Provider Registration (Name + Password, no email required)
router.post("/register", async (req, res) => {
    try {
        const {
            ProviderId,
            name,
            mobile,
            email,
            address,
            doorNo,
            area,
            district,
            state,
            pincode,
            pinCode,
            services,
            skill,
            experience,
            availability,
            password
        } = req.body;

        if (!name || !name.trim() || !password) {
            return res.status(400).json({
                message: "Name and password are required"
            });
        }

        const trimmedName = name.trim();
        const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingProvider = await Provider.findOne({
            name: { $regex: new RegExp("^" + escapedName + "$", "i") }
        });

        if (existingProvider) {
            return res.status(400).json({
                message: "A service provider with this name already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const finalProviderId = ProviderId || ("P" + Date.now().toString().slice(-4) + Math.floor(10 + Math.random() * 90));
        const finalServices = Array.isArray(services) && services.length > 0
            ? services
            : (services ? [services] : (skill ? [skill] : ["General"]));

        const finalEmail = (email && email.trim()) ? email.trim() : `${finalProviderId.toLowerCase()}@local.market`;

        const finalDoorNo = (doorNo && doorNo.trim()) ? doorNo.trim() : "";
        const finalArea = (area && area.trim()) ? area.trim() : "";
        const finalDistrict = (district && district.trim()) ? district.trim() : "";
        const finalState = (state && state.trim()) ? state.trim() : "";
        const finalPincode = (pincode || pinCode || "").toString().trim();

        let finalAddress = (address && address.trim()) ? address.trim() : "";
        if (!finalAddress) {
            finalAddress = [finalDoorNo, finalArea, finalDistrict, finalState, finalPincode].filter(Boolean).join(", ");
        }
        if (!finalAddress) finalAddress = "N/A";

        const provider = new Provider({
            ProviderId: finalProviderId,
            name: trimmedName,
            mobile: (mobile && mobile.trim()) ? mobile.trim() : "N/A",
            email: finalEmail,
            doorNo: finalDoorNo,
            area: finalArea,
            district: finalDistrict,
            state: finalState,
            pincode: finalPincode,
            pinCode: finalPincode,
            address: finalAddress,
            services: finalServices,
            experience: Number(experience) || 1,
            availability: (availability && availability.trim()) ? availability.trim() : "9 AM - 6 PM",
            rating: 0,
            passwordHash
        });

        await provider.save();

        res.json({
            message: "Provider registered successfully",
            ProviderId: finalProviderId
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});


// Provider Login (Name/Email + Password)
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
        const provider = await Provider.findOne({
            $or: [
                { name: { $regex: new RegExp("^" + escapedId + "$", "i") } },
                { email: loginId }
            ]
        });

        if (!provider) {
            return res.status(400).json({
                message: "Provider account not found"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            provider.passwordHash
        );

        if (!validPassword) {
            return res.status(400).json({
                message: "Invalid password"
            });
        }

        res.json({
            message: "Login successful",
            provider: {
                ProviderId: provider.ProviderId,
                name: provider.name,
                email: provider.email,
                mobile: provider.mobile || "N/A",
                doorNo: provider.doorNo || "",
                area: provider.area || "",
                district: provider.district || "",
                state: provider.state || "",
                pincode: provider.pincode || provider.pinCode || "",
                address: provider.address || "N/A",
                services: provider.services,
                experience: provider.experience,
                availability: provider.availability,
                isAvailable: provider.isAvailable !== false,
                manualStatus: provider.manualStatus || "Auto",
                rating: provider.rating,
                role: "provider"
            }
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Provider Profile (Get)
router.get("/profile/:id", async (req, res) => {
    try {
        const provider = await Provider.findOne({ ProviderId: req.params.id }).select("-passwordHash");
        if (!provider) {
            return res.status(404).json({
                message: "Provider not found"
            });
        }
        res.json(provider);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Provider Profile (Update)
router.put("/profile/:id", async (req, res) => {
    try {
        const { name, mobile, address, doorNo, area, district, state, pincode, pinCode, services, skill, experience, availability } = req.body;
        const provider = await Provider.findOne({ ProviderId: req.params.id });

        if (!provider) {
            return res.status(404).json({
                message: "Provider not found"
            });
        }

        if (name && name.trim()) {
            const trimmedName = name.trim();
            if (trimmedName.toLowerCase() !== (provider.name || "").toLowerCase()) {
                const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const duplicate = await Provider.findOne({
                    name: { $regex: new RegExp("^" + escapedName + "$", "i") },
                    ProviderId: { $ne: provider.ProviderId }
                });
                if (duplicate) {
                    return res.status(400).json({
                        message: "Another provider with this name already exists"
                    });
                }
            }
            provider.name = trimmedName;
        }

        if (mobile !== undefined) provider.mobile = mobile.trim();
        if (doorNo !== undefined) provider.doorNo = doorNo.trim();
        if (area !== undefined) provider.area = area.trim();
        if (district !== undefined) provider.district = district.trim();
        if (state !== undefined) provider.state = state.trim();
        if (pincode !== undefined || pinCode !== undefined) {
            const pin = (pincode || pinCode || "").toString().trim();
            provider.pincode = pin;
            provider.pinCode = pin;
        }

        if (address !== undefined && address.trim()) {
            provider.address = address.trim();
        } else if (doorNo !== undefined || area !== undefined || district !== undefined || state !== undefined || pincode !== undefined || pinCode !== undefined) {
            provider.address = [provider.doorNo, provider.area, provider.district, provider.state, provider.pincode].filter(Boolean).join(", ");
        }

        if (services) {
            provider.services = Array.isArray(services) ? services : [services];
        } else if (skill) {
            provider.services = [skill];
        }

        if (experience !== undefined && experience !== null && experience !== "") {
            provider.experience = Number(experience) || provider.experience;
        }

        if (availability !== undefined && availability.trim()) {
            provider.availability = availability.trim();
        }

        if (req.body.isAvailable !== undefined) {
            provider.isAvailable = Boolean(req.body.isAvailable);
        }

        if (req.body.manualStatus !== undefined) {
            provider.manualStatus = req.body.manualStatus;
            if (req.body.manualStatus === "Available") provider.isAvailable = true;
            else if (req.body.manualStatus === "Unavailable") provider.isAvailable = false;
            else if (req.body.manualStatus === "Auto") provider.isAvailable = true;
        }

        await provider.save();

        const updated = provider.toObject();
        delete updated.passwordHash;

        res.json({
            message: "Profile updated successfully",
            provider: updated
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Provider Status Toggle (Available <-> Unavailable)
router.put("/status/:id", async (req, res) => {
    try {
        const { isAvailable, manualStatus } = req.body;
        const provider = await Provider.findOne({ ProviderId: req.params.id });

        if (!provider) {
            return res.status(404).json({ message: "Provider not found" });
        }

        if (manualStatus !== undefined) {
            provider.manualStatus = manualStatus;
            if (manualStatus === "Available") provider.isAvailable = true;
            else if (manualStatus === "Unavailable") provider.isAvailable = false;
            else if (manualStatus === "Auto") provider.isAvailable = true;
        } else if (isAvailable !== undefined) {
            provider.isAvailable = Boolean(isAvailable);
            provider.manualStatus = provider.isAvailable ? "Available" : "Unavailable";
        } else {
            // Toggle
            const nextState = provider.isAvailable === false ? true : false;
            provider.isAvailable = nextState;
            provider.manualStatus = nextState ? "Available" : "Unavailable";
        }

        await provider.save();

        const updated = provider.toObject();
        delete updated.passwordHash;

        res.json({
            message: `Status updated to ${provider.isAvailable ? 'Available' : 'Unavailable'}`,
            isAvailable: provider.isAvailable,
            manualStatus: provider.manualStatus,
            provider: updated
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
