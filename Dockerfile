# Use an official Node.js runtime as the base image
FROM node:22

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of your application code to the container
COPY src/ ./src/
COPY tsconfig.json .

# build the application
RUN npm run build

# Specify the command to run your Node.js application
CMD ["npm", "start"]