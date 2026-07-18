import cors from "cors";
import dotenv from "dotenv";
import express, {
    type Request,
    type Response,
} from "express";
import {
    MongoClient,
    ObjectId,
    ServerApiVersion,
} from "mongodb";

dotenv.config();

const app = express();

const port = Number(process.env.PORT) || 5000;
const uri = process.env.MONGODB_URL;

if (!uri) {
    throw new Error(
        "MONGODB_URL is missing from environment variables",
    );
}

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
        await client.connect();

        const db = client.db("findback");

        const itemsCollection = db.collection("items");
        const usersCollection = db.collection("user");

        await db.command({ ping: 1 });

        console.log("Connected to MongoDB");

        // Server health check
        app.get(
            "/",
            (_req: Request, res: Response) => {
                res.status(200).send(
                    "FindBack server is running",
                );
            },
        );

        // Get all items
        app.get(
            "/api/items",
            async (req: Request, res: Response) => {
                try {
                    const search =
                        typeof req.query.search === "string"
                            ? req.query.search
                            : "";

                    const location =
                        typeof req.query.location === "string"
                            ? req.query.location
                            : "";

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

                    const items = await itemsCollection
                        .find(query)
                        .sort({
                            createdAt: -1,
                        })
                        .toArray();

                    res.status(200).json(items);
                } catch (error) {
                    console.error(
                        "GET ITEMS ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message: "Failed to get items",
                    });
                }
            },
        );

        // Add a new item
        app.post(
            "/api/items",
            async (req: Request, res: Response) => {
                try {
                    const itemInfo = req.body;

                    const newItem = {
                        ...itemInfo,
                        status: "open",
                        createdAt:
                            new Date().toISOString(),
                    };

                    const result =
                        await itemsCollection.insertOne(
                            newItem,
                        );

                    res.status(201).json({
                        message:
                            "Item added successfully",
                        insertedId:
                            result.insertedId,
                    });
                } catch (error) {
                    console.error(
                        "ADD ITEM ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message: "Failed to add item",
                    });
                }
            },
        );

        // Get items reported by a specific user
        app.get(
            "/api/my-items/:email",
            async (req: Request, res: Response) => {
                try {
                    const { email: emailParam } =
                        req.params as {
                            email: string;
                        };

                    const email =
                        decodeURIComponent(emailParam);

                    const items = await itemsCollection
                        .find({
                            userEmail: email,
                        })
                        .sort({
                            createdAt: -1,
                        })
                        .toArray();

                    res.status(200).json(items);
                } catch (error) {
                    console.error(
                        "GET USER ITEMS ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to get user reports",
                    });
                }
            },
        );

        // Get one item by ID
        app.get(
            "/api/items/:id",
            async (req: Request, res: Response) => {
                try {
                    const { id } = req.params as {
                        id: string;
                    };

                    if (!ObjectId.isValid(id)) {
                        res.status(400).json({
                            message:
                                "Invalid item ID",
                        });

                        return;
                    }

                    const item =
                        await itemsCollection.findOne({
                            _id: new ObjectId(id),
                        });

                    if (!item) {
                        res.status(404).json({
                            message:
                                "Item not found",
                        });

                        return;
                    }

                    res.status(200).json(item);
                } catch (error) {
                    console.error(
                        "GET SINGLE ITEM ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to get item",
                    });
                }
            },
        );

        // Update an item using item ID and user email
        app.patch(
            "/api/items/:id",
            async (req: Request, res: Response) => {
                try {
                    const { id } = req.params as {
                        id: string;
                    };

                    const email =
                        typeof req.query.email ===
                            "string"
                            ? req.query.email
                            : "";

                    if (!ObjectId.isValid(id)) {
                        res.status(400).json({
                            message:
                                "Invalid item ID",
                        });

                        return;
                    }

                    if (!email) {
                        res.status(400).json({
                            message:
                                "User email is required",
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
                        updatedAt:
                            new Date().toISOString(),
                    };

                    const result =
                        await itemsCollection.updateOne(
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
                            message:
                                "Item not found or you cannot edit this item",
                        });

                        return;
                    }

                    res.status(200).json({
                        message:
                            "Item updated successfully",
                        modifiedCount:
                            result.modifiedCount,
                    });
                } catch (error) {
                    console.error(
                        "UPDATE ITEM ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to update item",
                    });
                }
            },
        );

        // Delete an item
        app.delete(
            "/api/items/:id",
            async (req: Request, res: Response) => {
                try {
                    const { id } = req.params as {
                        id: string;
                    };

                    if (!ObjectId.isValid(id)) {
                        res.status(400).json({
                            message:
                                "Invalid item ID",
                        });

                        return;
                    }

                    const result =
                        await itemsCollection.deleteOne({
                            _id: new ObjectId(id),
                        });

                    if (result.deletedCount === 0) {
                        res.status(404).json({
                            message:
                                "Item not found",
                        });

                        return;
                    }

                    res.status(200).json({
                        message:
                            "Item deleted successfully",
                    });
                } catch (error) {
                    console.error(
                        "DELETE ITEM ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to delete item",
                    });
                }
            },
        );

        // Admin dashboard data
        app.get(
            "/api/admin/dashboard",
            async (
                _req: Request,
                res: Response,
            ) => {
                try {
                    const totalUsers =
                        await usersCollection.countDocuments(
                            {
                                role: {
                                    $ne: "admin",
                                },
                            },
                        );

                    const totalItems =
                        await itemsCollection.countDocuments();

                    const lostItems =
                        await itemsCollection.countDocuments(
                            {
                                type: "lost",
                            },
                        );

                    const foundItems =
                        await itemsCollection.countDocuments(
                            {
                                type: "found",
                            },
                        );

                    const openItems =
                        await itemsCollection.countDocuments(
                            {
                                status: "open",
                            },
                        );

                    const recoveredItems =
                        await itemsCollection.countDocuments(
                            {
                                status: "recovered",
                            },
                        );

                    const recentItems =
                        await itemsCollection
                            .find()
                            .sort({
                                createdAt: -1,
                            })
                            .limit(5)
                            .toArray();

                    const recentUsers =
                        await usersCollection
                            .find({
                                role: {
                                    $ne: "admin",
                                },
                            })
                            .sort({
                                createdAt: -1,
                            })
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
                    console.error(
                        "ADMIN DASHBOARD ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to load admin dashboard",
                    });
                }
            },
        );

        // Get all regular users
        app.get(
            "/api/admin/users",
            async (
                _req: Request,
                res: Response,
            ) => {
                try {
                    const users =
                        await usersCollection
                            .find({
                                role: {
                                    $ne: "admin",
                                },
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
                    console.error(
                        "GET USERS ERROR:",
                        error,
                    );

                    res.status(500).json({
                        message:
                            "Failed to load users",
                    });
                }
            },
        );
    } catch (error) {
        console.error(
            "MONGODB CONNECTION ERROR:",
            error,
        );

        throw error;
    }
}

run()
    .then(() => {
        if (process.env.NODE_ENV !== "production") {
            app.listen(port, () => {
                console.log(
                    `Server is running on http://localhost:${port}`,
                );
            });
        }
    })
    .catch((error) => {
        console.error(
            "SERVER STARTUP ERROR:",
            error,
        );
    });

export default app;