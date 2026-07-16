import express, {
    type Request,
    type Response,
} from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
    MongoClient,
    ObjectId,
    ServerApiVersion,
} from "mongodb";

dotenv.config();

const app = express();

const port = Number(process.env.PORT) || 5000;
const uri = process.env.MONGODB_URL as string;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        const db = client.db("findback");
        const itemsCollection = db.collection("items");

        // Get all items
        app.get("/api/items", async (req: Request, res: Response) => {
            try {
                const search = req.query.search as string;
                const location = req.query.location as string;

                const query: {
                    title?: {
                        $regex: string;
                        $options: string;
                    };
                    location?: {
                        $regex: string;
                        $options: string;
                    };
                } = {};

                if (search) {
                    query.title = {
                        $regex: search,
                        $options: "i",
                    };
                }

                if (location) {
                    query.location = {
                        $regex: location,
                        $options: "i",
                    };
                }

                const result = await itemsCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                res.json(result);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to get items",
                });
            }
        });

        // Add a new item
        app.post("/api/items", async (req: Request, res: Response) => {
            try {
                const itemInfo = req.body;

                const newItem = {
                    ...itemInfo,
                    status: "open",
                    createdAt: new Date().toISOString(),
                };

                const result = await itemsCollection.insertOne(newItem);

                res.status(201).json(result);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to add item",
                });
            }
        });

        // items by userId
        // Get all items reported by a specific user email
        app.get("/api/my-items/:email", async (req, res) => {
            try {
                const email = decodeURIComponent(req.params.email);

                const result = await itemsCollection
                    .find({ userEmail: email })
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json(result);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to get user reports",
                });
            }
        });

        app.get("/api/items/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    res.status(400).json({
                        message: "Invalid item ID",
                    });

                    return;
                }

                const item = await itemsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!item) {
                    res.status(404).json({
                        message: "Item not found",
                    });

                    return;
                }

                res.status(200).json(item);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to load item",
                });
            }
        });

        // Delete an item using item ID and user email
        app.delete("/api/items/:id", async (req, res) => {
            try {
                const { id } = req.params;

                if (!ObjectId.isValid(id)) {
                    res.status(400).json({
                        message: "Invalid item ID",
                    });

                    return;
                }

                const result = await itemsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                if (result.deletedCount === 0) {
                    res.status(404).json({
                        message: "Item not found",
                    });

                    return;
                }

                res.status(200).json({
                    message: "Item deleted successfully",
                });
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to delete item",
                });
            }
        });


        // Get one item for editing
        app.get("/api/items/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const email = req.query.email as string;

                if (!ObjectId.isValid(id)) {
                    res.status(400).json({
                        message: "Invalid item ID",
                    });

                    return;
                }

                if (!email) {
                    res.status(400).json({
                        message: "User email is required",
                    });

                    return;
                }

                const result = await itemsCollection.findOne({
                    _id: new ObjectId(id),
                    userEmail: email,
                });

                if (!result) {
                    res.status(404).json({
                        message: "Item not found",
                    });

                    return;
                }

                res.status(200).json(result);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to get item",
                });
            }
        });


        // Edit an item using item ID and user email
        app.patch("/api/items/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const email = req.query.email as string;

                if (!ObjectId.isValid(id)) {
                    res.status(400).json({
                        message: "Invalid item ID",
                    });

                    return;
                }

                if (!email) {
                    res.status(400).json({
                        message: "User email is required",
                    });

                    return;
                }

                const {
                    title,
                    category,
                    description,
                    location,
                    date,
                    image,
                    type,
                    status,
                } = req.body;

                const updatedItem = {
                    title,
                    category,
                    description,
                    location,
                    date,
                    image,
                    type,
                    status,
                    updatedAt: new Date().toISOString(),
                };

                const result = await itemsCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                        userEmail: email,
                    },
                    {
                        $set: updatedItem,
                    },
                );

                if (result.matchedCount === 0) {
                    res.status(404).json({
                        message: "Item not found or you cannot edit this item",
                    });

                    return;
                }

                res.status(200).json({
                    message: "Item updated successfully",
                });
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to update item",
                });
            }
        });


        app.get("/api/admin/dashboard", async (req, res) => {
            try {
                const usersCollection = db.collection("user");

                const totalUsers = await usersCollection.countDocuments({
                    role: { $ne: "admin" },
                });

                const totalItems =
                    await itemsCollection.countDocuments();

                const lostItems =
                    await itemsCollection.countDocuments({
                        type: "lost",
                    });

                const foundItems =
                    await itemsCollection.countDocuments({
                        type: "found",
                    });

                const openItems =
                    await itemsCollection.countDocuments({
                        status: "open",
                    });

                const recoveredItems =
                    await itemsCollection.countDocuments({
                        status: "recovered",
                    });

                const recentItems = await itemsCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .toArray();

                const recentUsers = await usersCollection
                    .find({
                        role: { $ne: "admin" },
                    })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .project({
                        name: 1,
                        email: 1,
                        role: 1,
                        image: 1,
                        createdAt: 1,
                    })
                    .toArray();

                res.status(200).json({
                    totalUsers,
                    totalItems,
                    lostItems,
                    foundItems,
                    openItems,
                    recoveredItems,
                    recentItems,
                    recentUsers,
                });
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to load admin dashboard",
                });
            }
        });

        app.get("/api/admin/users", async (req, res) => {
            try {
                const usersCollection = db.collection("user");

                const users = await usersCollection
                    .find({
                        role: { $ne: "admin" },
                    })
                    .sort({
                        createdAt: -1,
                    })
                    .project({
                        name: 1,
                        email: 1,
                        image: 1,
                        role: 1,
                        isBlocked: 1,
                        createdAt: 1,
                    })
                    .toArray();

                res.status(200).json(users);
            } catch (error) {
                console.log(error);

                res.status(500).json({
                    message: "Failed to load users",
                });
            }
        });

        console.log("Connected to MongoDB");
    } catch (error) {
        console.log(error);
    }
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
    res.send("FindBack server is running");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});