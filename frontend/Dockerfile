# Use official Node.js image as a base image with Node.js version 18
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend for production
RUN npm run build

# Expose the frontend port
EXPOSE 3000

# Command to run the frontend server
CMD ["npm", "start"]