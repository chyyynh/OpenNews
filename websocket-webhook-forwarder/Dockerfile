# Use an official Node.js runtime as a parent image
    # Using LTS (Long Term Support) version is generally recommended
    FROM node:20-alpine AS builder

    # Set the working directory in the container
    WORKDIR /app

    # Install pnpm
    RUN npm install -g pnpm

    # Copy package.json and pnpm-lock.yaml first to leverage Docker cache
    COPY package.json pnpm-lock.yaml ./

    # Install dependencies using pnpm
    RUN pnpm install --frozen-lockfile

    # Copy the rest of the application code
    COPY . .

    # Build the TypeScript code
    RUN pnpm run build

    # --- Production Stage ---
    FROM node:20-alpine

    WORKDIR /app

    # Install pnpm for running the start command if needed, or just copy node_modules
    RUN npm install -g pnpm

    # Copy built code and necessary files from the builder stage
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    # If you have other static assets needed at runtime, copy them here

    # Expose the port the app runs on (if it were a web server, not strictly needed for this script)
    # EXPOSE 3000

    # Define the command to run the application
    # Uses the "start" script defined in package.json (node dist/index.js)
    CMD ["pnpm", "start"]
