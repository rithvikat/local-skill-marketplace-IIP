const express = require("express");
const Provider = require("../models/provider");

const router = express.Router();

// Helper to escape regex special characters
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Strict Location-Based Provider Search
router.get("/providers", async (req, res) => {
    try {
        const { state, district, area, skill, service, search, customerId } = req.query;

        const conditions = [];

        // 1. Strict State Filter
        const stateTrimmed = (state || "").trim();
        if (stateTrimmed && stateTrimmed !== "All" && stateTrimmed !== "All States") {
            const escaped = escapeRegex(stateTrimmed);
            conditions.push({
                state: {
                    $type: "string",
                    $regex: new RegExp("^\\s*" + escaped + "\\s*$", "i")
                }
            });
        }

        // 2. Strict District Filter
        const districtTrimmed = (district || "").trim();
        if (districtTrimmed && districtTrimmed !== "All" && districtTrimmed !== "All Districts") {
            const escaped = escapeRegex(districtTrimmed);
            conditions.push({
                district: {
                    $type: "string",
                    $regex: new RegExp("^\\s*" + escaped + "\\s*$", "i")
                }
            });
        }

        // 3. Strict Area Filter
        const areaTrimmed = (area || "").trim();
        if (areaTrimmed && areaTrimmed !== "All" && areaTrimmed !== "All Areas") {
            const escaped = escapeRegex(areaTrimmed);
            conditions.push({
                area: {
                    $type: "string",
                    $regex: new RegExp("^\\s*" + escaped + "\\s*$", "i")
                }
            });
        }

        // 4. Service / Skill Filter (supports skill & service params and common suffixes)
        const rawSkill = (skill || service || "").trim();
        if (rawSkill && rawSkill !== "All" && rawSkill !== "All Services" && rawSkill !== "All Skills") {
            const skillNorm = rawSkill.toLowerCase();
            let skillPattern;
            if (skillNorm === "plumber" || skillNorm === "plumbing") {
                skillPattern = "^\\s*(Plumber|Plumbing)\\s*$";
            } else if (skillNorm === "electrician" || skillNorm === "electrical") {
                skillPattern = "^\\s*(Electrician|Electrical)\\s*$";
            } else if (skillNorm === "painter" || skillNorm === "painting") {
                skillPattern = "^\\s*(Painter|Painting)\\s*$";
            } else if (skillNorm === "carpenter" || skillNorm === "carpentry") {
                skillPattern = "^\\s*(Carpenter|Carpentry)\\s*$";
            } else if (skillNorm === "cleaner" || skillNorm === "cleaning" || skillNorm === "home cleaning") {
                skillPattern = "^\\s*(Cleaner|Cleaning|Home Cleaning)\\s*$";
            } else {
                skillPattern = "^\\s*" + escapeRegex(rawSkill) + "\\s*$";
            }
            conditions.push({
                services: { $regex: new RegExp(skillPattern, "i") }
            });
        }

        // 5. General search bar keyword (if provided)
        const searchTrimmed = (search || "").trim();
        if (searchTrimmed) {
            const escaped = escapeRegex(searchTrimmed);
            conditions.push({
                $or: [
                    { name: { $regex: escaped, $options: "i" } },
                    { services: { $regex: escaped, $options: "i" } }
                ]
            });
        }

        // 6. Optional customerId narrowing ONLY IF no explicit location filters were selected
        const hasLocationFilter = Boolean(stateTrimmed || districtTrimmed || areaTrimmed);
        if (!hasLocationFilter && customerId && customerId.trim()) {
            const Customer = require("../models/customer");
            const customer = await Customer.findOne({ CustomerID: customerId.trim() });
            if (customer && customer.area && customer.area.trim()) {
                const escaped = escapeRegex(customer.area.trim());
                conditions.push({
                    area: {
                        $type: "string",
                        $regex: new RegExp("^\\s*" + escaped + "\\s*$", "i")
                    }
                });
            }
        }

        // Combine all conditions using AND logic
        let query = {};
        if (conditions.length === 1) {
            query = conditions[0];
        } else if (conditions.length > 1) {
            query = { $and: conditions };
        }

        const providers = await Provider.find(query)
            .select("-passwordHash")
            .lean();

        res.json(providers);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

// Get Location Hierarchy from real database records (no invented or default locations)
router.get("/locations", async (req, res) => {
    try {
        const providers = await Provider.find({}, "state district area").lean();
        const hierarchy = {};

        providers.forEach(p => {
            const st = (p.state || "").trim();
            const dt = (p.district || "").trim();
            const ar = (p.area || "").trim();

            if (!st || !dt || !ar) return;

            if (!hierarchy[st]) hierarchy[st] = {};
            if (!hierarchy[st][dt]) hierarchy[st][dt] = [];
            if (!hierarchy[st][dt].includes(ar)) {
                hierarchy[st][dt].push(ar);
            }
        });

        // Alphabetically sort states, districts, and areas
        const sortedHierarchy = {};
        Object.keys(hierarchy).sort().forEach(st => {
            sortedHierarchy[st] = {};
            Object.keys(hierarchy[st]).sort().forEach(dt => {
                sortedHierarchy[st][dt] = hierarchy[st][dt].sort();
            });
        });

        res.json(sortedHierarchy);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;
