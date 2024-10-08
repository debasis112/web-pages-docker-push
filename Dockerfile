# Use an official Node.js runtime as a parent image
FROM node:18

# Set environment variables from build arguments
ARG SQL_USER_ID
ARG SQL_DB_PASS
ARG SQL_DB_HOST
ARG SQL_DB_NAME
ARG SQL_DB_ENCRYPT

# Create environment variables from the arguments
ENV SQL_USER_ID=$SQL_USER_ID
ENV SQL_DB_PASS=$SQL_DB_PASS
ENV SQL_DB_HOST=$SQL_DB_HOST
ENV SQL_DB_NAME=$SQL_DB_NAME
ENV SQL_DB_ENCRYPT=$SQL_DB_ENCRYPT

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files to the container
# COPY package*.json ./
COPY src/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
# COPY . .
COPY src/ .

# Expose the port that your app will run on
EXPOSE 3000

# Define the command to run your app
CMD ["node", "app.js"]
