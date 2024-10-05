// blog.ts
import { PrismaClient } from "@prisma/client/extension";
import { withAccelerate } from "@prisma/extension-accelerate";
import { Hono } from "hono";
import { verify } from "hono/jwt";

export const blogRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
  };
  Variables: {
    userId: string;
  };
}>();

blogRouter.use("/*", async (c, next) => {
  const header = c.req.header("authorization");

  if (!header || !header.startsWith("Bearer ")) {
    c.status(403);
    return c.json({
      error: "Unauthorized: Missing or malformed authorization header",
    });
  }

  const token = header.split(" ")[1];

  try {
    const response: any = await verify(token, c.env.JWT_SECRET);
    if (response && response.id) {
      c.set("userId", response.id);
      await next();
    } else {
      c.status(403);
      return c.json({
        error: "Unauthorized",
      });
    }
  } catch (err) {
    c.status(403);
    return c.json({
      error: "Invalid or expired token",
    });
  }
});

// POST: Create a new blog post
blogRouter.post("/", async (c) => {
  const body = await c.req.json();
  const authorId = c.get("userId");

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  // Validate the input
  if (!body.title || !body.content) {
    c.status(400);
    return c.json({
      error: "Title and content are required.",
    });
  }

  // Create a new blog post in the database
  const blog = await prisma.post.create({
    data: {
      title: body.title,
      content: body.content,
      authorId: authorId, // Ensure authorId is a string
    },
  });

  return c.json({
    id: blog.id,
    title: blog.title,
    content: blog.content,
    authorId: blog.authorId,
    message: "Blog created successfully.",
  });
});

// PUT: Update an existing blog post
blogRouter.put("/", async (c) => {
  const body = await c.req.json();
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const blog = await prisma.post.update({
      where: {
        id: body.id,
      },
      data: {
        title: body.title,
        content: body.content,
      },
    });

    return c.json({
      id: blog.id,
      title: blog.title,
      content: blog.content,
      message: "Blog updated successfully.",
    });
  } catch (e) {
    c.status(404);
    return c.json({
      message: "Blog post not found.",
    });
  }
});

// GET: Retrieve a blog post by ID
blogRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  try {
    const blog = await prisma.post.findUnique({
      where: {
        id: id,
      },
    });

    if (!blog) {
      c.status(404);
      return c.json({
        message: "Blog not found.",
      });
    }

    return c.json(blog); // Return the full blog object
  } catch (e) {
    c.status(500);
    return c.json({
      message: "Error while fetching blog post.",
    });
  }
});

// GET: Retrieve all blog posts (Bulk)
blogRouter.get("/bulk", async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const posts = await prisma.post.findMany();
  return c.json(posts);
});
