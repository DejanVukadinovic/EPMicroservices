import Fastify from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { sequelize } from "./config/database.js";
import { User, ROLES } from "./models/User.js";
import { authenticated, admin, thisUser } from "./middleware/middleware.js";
import { connectRabbit } from "./rabbitmq/connection.js";
import { consume } from "./rabbitmq/consumer.js";
import {
    createTenantAdminFromApprovedTenant
} from "./services/tenantUserService.js";

const app = Fastify({ logger: true });

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function signUser(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "2h" }
    );
}

async function createUser({ id, email, password, role }) {
    if (!email || !password) {
        throw new Error("Email and password are required");
    }

    if (!Object.values(ROLES).includes(role)) {
        throw new Error("Invalid role");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return User.create({
        id,
        email,
        passwordHash,
        role
    });
}

async function seedAdmin() {
    const adminEmail = "admin@epos.local";

    const existing = await User.findOne({
        where: { email: adminEmail }
    });

    if (!existing) {
        await createUser({
            email: adminEmail,
            password: "admin123",
            role: ROLES.EPOS_ADMIN
        });

        app.log.info("Seeded admin: admin@epos.local / admin123");
    }
}

app.get("/api/auth/health", async () => {
    return { service: "auth-service", status: "ok" };
});

app.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
        return reply.code(400).send({ message: "Email and password are required" });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
        return reply.code(401).send({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
        return reply.code(401).send({ message: "Invalid credentials" });
    }

    return {
        token: signUser(user),
        user: {
            id: user.id,
            email: user.email,
            role: user.role
        }
    };
});


app.post("/api/auth/register", { preHandler: admin }, async (request, reply) => {
    const { id, email, password, role } = request.body || {};

    try {
        const user = await createUser({ id, email, password, role });

        return reply.code(201).send({
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt
        });
    } catch (error) {
        if (error.name === "SequelizeUniqueConstraintError") {
            return reply.code(409).send({ message: "User already exists" });
        }

        return reply.code(400).send({ message: error.message });
    }
});

app.get("/api/auth/me", { preHandler: authenticated }, async (request) => {
    return { user: request.user };
});

app.get(
    "/api/auth/users/:id",
    { preHandler: thisUser("id") },
    async (request, reply) => {
        const user = await User.findByPk(request.params.id, {
            attributes: ["id", "email", "role", "createdAt", "updatedAt"]
        });

        if (!user) {
            return reply.code(404).send({ message: "User not found" });
        }

        return user;
    }
);

try {
    await sequelize.authenticate();
    await sequelize.sync({ force: true });

    await seedAdmin();
    await connectRabbit(app);

    await consume(
        process.env.AUTH_TENANT_APPROVED_QUEUE,
        async (payload) => {
            const user = await createTenantAdminFromApprovedTenant(payload);

            app.log.info(
                {
                    userId: user.id,
                    email: user.email
                },
                "Tenant admin ensured from approved tenant"
            );
        },
        app
    );

    await app.listen({
        port: 3000,
        host: "0.0.0.0"
    });
} catch (error) {
    app.log.error(error);
    process.exit(1);
}